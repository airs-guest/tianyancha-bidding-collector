# tianyancha-bidding-collector

天眼查招投标数据采集 AI Skill —— 批量搜索企业全称并下载招投标/中标记录，输出结构化 CSV。

## 目录结构

```
tianyancha-bidding-collector/
├── SKILL.md                          # AI Skill 定义（Claude Code 自动加载）
├── README.md                         # 本文件
├── assets/
│   └── 具身智能中游企业数据库.md        # 默认企业名单
├── scripts/
│   ├── package.json                   # npm 依赖
│   ├── settings.json                  # 浏览器与采集配置
│   ├── step1_search_companies.js      # Step 1: 企业搜索确认
│   ├── step2_download_bidding.js      # Step 2: 招投标下载
│   ├── browser.js                     # Puppeteer 浏览器连接
│   ├── modules/
│   │   ├── parseCompanyList.js        # MD 企业名单解析
│   │   ├── companySearch.js           # 天眼查企业搜索（含反爬检测）
│   │   └── biddingDownload.js         # 招投标记录下载
│   └── utils/
│       ├── excel.js                   # CSV/Excel 读写
│       ├── logger.js                  # 日志（Winston）
│       └── retry.js                   # 重试与验证码等待
└── data/                              # 运行时输出（自动创建）
    ├── company_list.csv               # Step 1 输出
    ├── bidding_records.csv            # Step 2 输出
    └── step2_progress.json            # 断点续传进度
```

## 前置条件

- **Node.js** >= 18
- **Google Chrome** 浏览器
- **天眼查账号**（需登录后使用）

## 安装

```bash
cd ~/.claude/skills/tianyancha-bidding-collector/scripts
npm install
```

## 使用方式

### 方式一：通过 Claude Code 自然语言触发（推荐）

在 Claude Code 中直接用自然语言描述需求，Skill 会自动触发：

> "帮我查一下这些企业在天眼查的招投标记录：宇树科技、优必选、智元机器人"
>
> "采集具身智能企业 2026 年 Q1 的中标记录，金额门槛 100 万"
>
> "用默认企业名单跑一下天眼查招投标数据"

### 方式二：手动执行脚本

#### 1. 启动 Chrome 远程调试

**macOS：**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome_dev \
  --no-first-run \
  --no-default-browser-check
```

**Windows CMD：**
```cmd
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --user-data-dir=%TEMP%\chrome_dev ^
  --no-first-run ^
  --no-default-browser-check
```

**Windows PowerShell：**
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir=$env:TEMP\chrome_dev `
  --no-first-run `
  --no-default-browser-check
```

启动后在 Chrome 中打开 https://www.tianyancha.com 并登录。

#### 2. Step 1：企业搜索确认

```bash
cd ~/.claude/skills/tianyancha-bidding-collector/scripts

# 使用内置默认企业名单
node step1_search_companies.js

# 使用自定义企业名单
node step1_search_companies.js --company-file /path/to/custom_list.md
```

输出：`data/company_list.csv`

#### 3. Step 2：招投标记录下载

```bash
node step2_download_bidding.js --start-date 2026-01-01 --end-date 2026-03-31 --min-amount 0
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--start-date` | 开始日期 (YYYY-MM-DD) | `2026-01-01` |
| `--end-date` | 结束日期 (YYYY-MM-DD) | `2026-03-31` |
| `--min-amount` | 最低金额（万元），0=无门槛 | `0` |

输出：`data/bidding_records.csv`

## 自定义企业名单格式

MD 文件需包含如下 Markdown 表格：

```markdown
| 索引 | 企业名称 | 所属领域 | 产品名称 | 城市 |
| --- | --- | --- | --- | --- |
| 1 | 宇树科技 | 人形机器人 | Unitree H1 | 杭州 |
| 2 | 优必选 | 人形机器人 | Walker S2 | 深圳 |
```

- 海外/港澳台企业（城市含美国、英国、香港等关键词）会自动跳过
- 所属领域、产品名称、城市可填 `-` 占位

## 反爬与验证码处理

脚本内置了反爬检测机制：
- 检测验证码弹窗（`.verify-modal`、`.captcha` 等）
- 检测页面跳转到反爬页面（URL 含 `antirobot`/`verify`）
- 触发时会在终端输出醒目提示，等待用户在 Chrome 中手动完成验证
- 验证通过后自动继续（最多等待 5 分钟）
- 支持断点续传：Step 2 中断后重新运行会跳过已处理的企业

## 跨平台支持

| 特性 | macOS | Windows |
|------|-------|---------|
| Chrome 启动 | 支持 | CMD / PowerShell 均支持 |
| 端口检测 | `lsof` | `netstat` / `Get-NetTCPConnection` |
| 路径分隔符 | Node.js `path` 模块自动处理 | 同左 |
| npm / Node.js | 支持 | 支持 |
