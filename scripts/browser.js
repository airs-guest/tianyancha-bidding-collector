import puppeteer from 'puppeteer-core';
import { execFile } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { logger } from './utils/logger.js';

// ─── Chrome 路径检测 ───────────────────────────────────────────

/**
 * 检测当前平台的 Chrome 可执行文件路径
 * @returns {string|null}
 */
function findChromePath() {
  const platform = os.platform();

  if (platform === 'darwin') {
    const p = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    return fs.existsSync(p) ? p : null;
  }

  if (platform === 'win32') {
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

  // Linux
  const linuxCandidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const p of linuxCandidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ─── Chrome 启动 ───────────────────────────────────────────────

/**
 * 获取 Chrome 用户数据目录（远程调试专用，避免与日常浏览器冲突）
 */
function getDebugUserDataDir() {
  const platform = os.platform();
  if (platform === 'win32') {
    return path.join(os.tmpdir(), 'chrome_debug_profile');
  }
  return '/tmp/chrome_debug_profile';
}

/**
 * 以远程调试模式启动 Chrome
 * @returns {Promise<void>}
 */
function launchChromeWithDebugging(chromePath) {
  return new Promise((resolve, reject) => {
    const userDataDir = getDebugUserDataDir();
    const args = [
      `--remote-debugging-port=9222`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
    ];

    logger.info(`正在启动 Chrome: ${chromePath}`);
    const child = execFile(chromePath, args, { stdio: 'ignore' }, (err) => {
      // Chrome 退出时的回调，启动阶段不需要处理
      if (err && !child.killed) {
        logger.warn(`Chrome 进程退出: ${err.message}`);
      }
    });
    child.unref();

    // 等待调试端口就绪
    const maxWait = 15000;
    const interval = 500;
    let waited = 0;

    const check = async () => {
      try {
        const res = await fetch('http://127.0.0.1:9222/json/version');
        if (res.ok) {
          logger.info('Chrome 远程调试端口已就绪');
          resolve();
          return;
        }
      } catch {
        // 端口未就绪，继续等待
      }
      waited += interval;
      if (waited >= maxWait) {
        reject(new Error('Chrome 启动超时：远程调试端口 9222 未能在 15 秒内就绪'));
        return;
      }
      setTimeout(check, interval);
    };
    setTimeout(check, interval);
  });
}

// ─── 对外接口 ──────────────────────────────────────────────────

/**
 * 连接到 Chrome 浏览器
 * 优先连接已运行的实例；如果未运行，自动启动 Chrome 并连接
 */
export async function connectBrowser() {
  // 1. 尝试连接已运行的 Chrome
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: null,
    });
    logger.info('成功连接到已运行的 Chrome 浏览器');
    return browser;
  } catch {
    logger.info('未检测到运行中的 Chrome 远程调试实例，尝试自动启动...');
  }

  // 2. 检测 Chrome 安装路径
  const chromePath = findChromePath();
  if (!chromePath) {
    throw new Error(
      '未找到 Chrome 浏览器。请安装 Google Chrome 后重试。\n' +
      '下载地址: https://www.google.com/chrome/'
    );
  }

  // 3. 自动启动 Chrome
  await launchChromeWithDebugging(chromePath);

  // 4. 连接到刚启动的 Chrome
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: null,
    });
    logger.info('成功连接到 Chrome 浏览器');
    return browser;
  } catch (err) {
    throw new Error(`Chrome 已启动但连接失败: ${err.message}`);
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
