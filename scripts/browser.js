import puppeteer from 'puppeteer-core';
import os from 'os';
import fs from 'fs';
import { logger } from './utils/logger.js';

/**
 * 连接到已运行的 Chrome 浏览器（需要以 --remote-debugging-port=9222 启动）
 *
 * 启动命令:
 * macOS: /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
 * Windows: "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
 */

/**
 * 检测 Windows 上 Chrome 的安装路径
 * 按优先级依次检查常见安装位置
 */
function findWindowsChromePath() {
  const candidates = [
    process.env['PROGRAMFILES'] && `${process.env['PROGRAMFILES']}\\Google\\Chrome\\Application\\chrome.exe`,
    process.env['PROGRAMFILES(X86)'] && `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
    process.env['LOCALAPPDATA'] && `${process.env['LOCALAPPDATA']}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'D:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * 获取当前平台的 Chrome 启动提示信息
 */
function getChromeHint() {
  const platform = os.platform();
  if (platform === 'darwin') {
    return '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222';
  }
  if (platform === 'win32') {
    const found = findWindowsChromePath();
    if (found) {
      return `"${found}" --remote-debugging-port=9222`;
    }
    return [
      'Chrome 未在常见路径找到，请手动指定路径启动:',
      '  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222',
      '  或检查 D 盘、用户本地目录等其他安装位置',
    ].join('\n');
  }
  // Linux
  return 'google-chrome --remote-debugging-port=9222';
}

export async function connectBrowser() {
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: null,
    });
    logger.info('成功连接到 Chrome 浏览器');
    return browser;
  } catch (err) {
    logger.error('无法连接 Chrome。请确保已用以下命令启动:');
    logger.error(getChromeHint());
    throw err;
  }
}

/**
 * 在浏览器中打开新标签页
 */
export async function openNewPage(browser) {
  const page = await browser.newPage();
  // 设置较长的超时时间
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);
  return page;
}

/**
 * 安全等待 - 随机延迟避免反爬
 */
export function delay(minMs = 2000, maxMs = 5000) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, ms));
}
