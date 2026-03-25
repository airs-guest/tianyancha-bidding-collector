import { delay } from '../browser.js';
import { logger } from '../utils/logger.js';
import { withRetry, waitForUserAction } from '../utils/retry.js';

/**
 * 在天眼查搜索企业名称，获取全称和链接
 * @param {import('puppeteer-core').Page} page 
 * @param {string} companyName - 企业简称
 * @returns {Promise<{fullName: string, url: string, status: string}>}
 */
export async function searchCompanyOnTianyancha(page, companyName) {
  return withRetry(async () => {
    // 访问天眼查搜索页
    const searchUrl = `https://www.tianyancha.com/search?key=${encodeURIComponent(companyName)}`;
    logger.info(`搜索企业: ${companyName} → ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000, 4000);

    // 检查是否被跳转到反爬/验证页面
    const currentUrl = page.url();
    const isAntiCrawl = !currentUrl.includes('/search') ||
      currentUrl.includes('antirobot') || currentUrl.includes('verify');

    // 检查页面内是否有验证码弹窗
    const hasVerifyPopup = await page.evaluate(() => {
      return !!document.querySelector('.verify-modal, .captcha, [class*="verify-wrap"], [class*="captcha"]');
    }).catch(() => false);

    if (isAntiCrawl || hasVerifyPopup) {
      logger.warn(`\n${'='.repeat(50)}`);
      logger.warn(`⚠️  搜索 "${companyName}" 时触发了反爬验证`);
      logger.warn(`请在 Chrome 浏览器中完成验证码/人机认证`);
      logger.warn(`完成后脚本将自动继续（最多等待 5 分钟）`);
      logger.warn(`${'='.repeat(50)}\n`);

      const resolved = await waitForUserAction(page, '请完成验证码认证', 300000);
      if (resolved) {
        // 验证通过后重新加载搜索页
        logger.info(`验证已通过，重新搜索 "${companyName}"...`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(2000, 4000);
      } else {
        throw new Error('验证码等待超时（5分钟），请手动完成后重试');
      }
    }

    // 获取搜索结果列表中的第一个企业
    const result = await page.evaluate(() => {
      // 天眼查搜索结果的选择器 - 多种可能的选择器
      const selectors = [
        '.search-result-single .header a[href*="/company/"]',
        '.result-list .search-result-single .header a',
        '.search_result_single .header a[href*="/company/"]',
        'a[href*="/company/"].name',
        '.result-list a[href*="/company/"]',
      ];
      
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          return {
            fullName: el.textContent.replace(/<[^>]+>/g, '').trim(),
            url: el.href,
          };
        }
      }
      
      // 尝试更宽泛的匹配
      const allLinks = document.querySelectorAll('a[href*="/company/"]');
      for (const link of allLinks) {
        const text = link.textContent.trim();
        if (text.length > 2 && text.length < 50) {
          return {
            fullName: text,
            url: link.href,
          };
        }
      }
      
      return null;
    });

    if (!result) {
      logger.warn(`未找到企业 "${companyName}" 的搜索结果`);
      return { fullName: '', url: '', status: '未找到' };
    }

    // 清理全称中可能的 HTML 标签残留
    const cleanName = result.fullName
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, '')
      .trim();

    logger.info(`✅ ${companyName} → ${cleanName}`);
    
    return {
      fullName: cleanName,
      url: result.url,
      status: '已确认',
    };
  }, { maxRetries: 2, delayMs: 5000, label: `搜索${companyName}` });
}
