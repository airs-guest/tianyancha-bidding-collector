import { logger } from './logger.js';

// 反爬检测的 URL 关键词
const ANTI_CRAWL_URL_KEYWORDS = [
  'antirobot', 'verify', 'captcha', 'login', 'passport',
  'security-check', 'challenge', 'blocked',
];

// 反爬检测的页面元素选择器
const ANTI_CRAWL_SELECTORS = [
  '.verify-modal',
  '.captcha',
  '[class*="verify-wrap"]',
  '[class*="verify-modal"]',
  '[class*="captcha"]',
  '[class*="login-modal"]',
  '[class*="login-dialog"]',
  '[class*="login-box"]',
  '[class*="login-panel"]',
  '[class*="login-popup"]',
  '[class*="qrcode-login"]',
  '#login-box',
  '#login-modal',
  '.modal .login',
  '[class*="slide-verify"]',
  '[class*="geetest"]',
];

// 反爬检测的页面文本特征
const ANTI_CRAWL_TEXT_PATTERNS = [
  '请登录后查看',
  '登录查看更多',
  '请先登录',
  '请输入验证码',
  '请完成安全验证',
  '拖动滑块',
  '操作过于频繁',
  '访问频率过高',
  '您的访问行为异常',
  '网络异常',
  '系统检测到',
];

/**
 * 检测页面是否触发了反爬机制（登录弹窗、验证码、跳转等）
 *
 * @param {import('puppeteer-core').Page} page
 * @param {Object} [options]
 * @param {string} [options.expectedUrlPattern] - 期望的 URL 关键词，如 '/search'、'/toubiao'
 * @returns {Promise<{blocked: boolean, reason: string}>}
 */
export async function detectAntiCrawl(page, options = {}) {
  const { expectedUrlPattern } = options;

  try {
    const currentUrl = page.url();

    // 1. URL 跳转检测
    if (expectedUrlPattern && !currentUrl.includes(expectedUrlPattern)) {
      const hitKeyword = ANTI_CRAWL_URL_KEYWORDS.find(kw => currentUrl.includes(kw));
      if (hitKeyword) {
        return { blocked: true, reason: `页面被重定向到反爬页面 (${hitKeyword})` };
      }
      // 检查是否跳转到了登录页
      if (currentUrl.includes('login') || currentUrl.includes('passport')) {
        return { blocked: true, reason: '页面被重定向到登录页' };
      }
    }

    // 2. 弹窗/元素检测
    const popupResult = await page.evaluate((selectors) => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          // 检查元素是否可见（display !== none, visibility !== hidden, 有尺寸）
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0) {
            return { found: true, selector: sel };
          }
        }
      }
      return { found: false };
    }, ANTI_CRAWL_SELECTORS).catch(() => ({ found: false }));

    if (popupResult.found) {
      return { blocked: true, reason: `检测到登录/验证弹窗 (${popupResult.selector})` };
    }

    // 3. 文本特征检测
    const textResult = await page.evaluate((patterns) => {
      const bodyText = document.body?.innerText || '';
      for (const pattern of patterns) {
        if (bodyText.includes(pattern)) {
          return { found: true, text: pattern };
        }
      }
      return { found: false };
    }, ANTI_CRAWL_TEXT_PATTERNS).catch(() => ({ found: false }));

    if (textResult.found) {
      return { blocked: true, reason: `页面出现提示: "${textResult.text}"` };
    }

    return { blocked: false, reason: '' };
  } catch (err) {
    // 检测本身出错不算被拦截
    return { blocked: false, reason: '' };
  }
}

/**
 * 检测反爬并等待用户手动处理
 *
 * 如果检测到反爬，会在终端打印醒目提示，然后轮询等待用户完成操作。
 *
 * @param {import('puppeteer-core').Page} page
 * @param {Object} [options]
 * @param {string} [options.context] - 当前操作上下文，如 "搜索'华为'"
 * @param {string} [options.expectedUrlPattern] - 期望 URL 包含的关键词
 * @param {number} [options.timeoutMs=300000] - 等待超时毫秒数（默认 5 分钟）
 * @returns {Promise<boolean>} - true 表示已恢复正常，false 表示超时
 */
export async function handleAntiCrawl(page, options = {}) {
  const { context = '', expectedUrlPattern, timeoutMs = 300000 } = options;

  const detection = await detectAntiCrawl(page, { expectedUrlPattern });
  if (!detection.blocked) {
    return true; // 未被拦截
  }

  // ===== 打印醒目提示 =====
  const separator = '='.repeat(60);
  logger.warn('');
  logger.warn(separator);
  logger.warn('⚠️  天眼查反爬机制已触发！需要您手动操作');
  logger.warn(separator);
  if (context) {
    logger.warn(`  当前操作: ${context}`);
  }
  logger.warn(`  触发原因: ${detection.reason}`);
  logger.warn('');
  logger.warn('  👉 请在 Chrome 浏览器中完成以下操作：');
  logger.warn('     1. 查看浏览器中的天眼查页面');
  logger.warn('     2. 如果出现登录弹窗 → 扫码或账号密码登录');
  logger.warn('     3. 如果出现验证码/滑块 → 完成验证');
  logger.warn('     4. 如果页面异常 → 手动刷新页面');
  logger.warn('');
  logger.warn(`  ⏳ 完成后脚本将自动继续（最多等待 ${Math.round(timeoutMs / 60000)} 分钟）`);
  logger.warn(separator);
  logger.warn('');

  // ===== 轮询等待用户操作完成 =====
  const startTime = Date.now();
  const pollInterval = 3000; // 每 3 秒检查一次
  let lastLogTime = 0;

  while (Date.now() - startTime < timeoutMs) {
    await new Promise(r => setTimeout(r, pollInterval));

    const recheck = await detectAntiCrawl(page, { expectedUrlPattern });
    if (!recheck.blocked) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      logger.info(`✅ 反爬验证已通过！(用户操作耗时 ${elapsed} 秒)`);
      // 给页面一点加载时间
      await new Promise(r => setTimeout(r, 2000));
      return true;
    }

    // 每 30 秒提醒一次
    const now = Date.now();
    if (now - lastLogTime > 30000) {
      const remaining = Math.round((timeoutMs - (now - startTime)) / 60000);
      logger.warn(`  ⏳ 仍在等待手动操作... (剩余 ${remaining} 分钟)`);
      lastLogTime = now;
    }
  }

  // 超时
  logger.error('');
  logger.error(separator);
  logger.error(`❌ 等待超时 (${Math.round(timeoutMs / 60000)} 分钟)`);
  logger.error('  脚本将跳过当前企业，继续处理下一家');
  logger.error('  您可以稍后重新运行脚本来补充处理失败的企业');
  logger.error(separator);
  logger.error('');
  return false;
}
