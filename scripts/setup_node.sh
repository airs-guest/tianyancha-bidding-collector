#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Node.js 环境自动检测与安装脚本
# 要求: Node.js >= 18
# 支持: macOS (brew / 官方 pkg) · Linux (nvm / NodeSource) · Windows (Git Bash / MSYS2)
# ─────────────────────────────────────────────────────────────

set -euo pipefail

REQUIRED_MAJOR=18

# ─── 辅助函数 ────────────────────────────────────────────────

log_info()  { printf "\033[32m[INFO]\033[0m  %s\n" "$*"; }
log_warn()  { printf "\033[33m[WARN]\033[0m  %s\n" "$*"; }
log_error() { printf "\033[31m[ERROR]\033[0m %s\n" "$*"; }

# 检查 Node.js 是否已安装且版本满足要求
check_node() {
  if ! command -v node &>/dev/null; then
    return 1
  fi
  local ver
  ver=$(node -v 2>/dev/null | sed 's/^v//')
  local major
  major=$(echo "$ver" | cut -d. -f1)
  if [ "$major" -ge "$REQUIRED_MAJOR" ] 2>/dev/null; then
    log_info "Node.js v${ver} 已安装，满足 >= ${REQUIRED_MAJOR} 的要求"
    return 0
  else
    log_warn "Node.js v${ver} 版本过低（需要 >= ${REQUIRED_MAJOR}）"
    return 1
  fi
}

# ─── macOS 安装 ──────────────────────────────────────────────

install_node_macos() {
  if command -v brew &>/dev/null; then
    log_info "使用 Homebrew 安装 Node.js LTS ..."
    brew install node@22
    brew link --overwrite node@22 2>/dev/null || true
  else
    log_info "使用官方 pkg 安装 Node.js LTS ..."
    local pkg_url="https://nodejs.org/dist/v22.15.0/node-v22.15.0.pkg"
    local tmp_pkg="/tmp/node_install.pkg"
    curl -fSL -o "$tmp_pkg" "$pkg_url"
    sudo installer -pkg "$tmp_pkg" -target /
    rm -f "$tmp_pkg"
  fi
}

# ─── Linux 安装 ──────────────────────────────────────────────

install_node_linux() {
  # 优先用 nvm（不需要 sudo）
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1091
    source "$HOME/.nvm/nvm.sh"
    log_info "使用 nvm 安装 Node.js LTS ..."
    nvm install --lts
    nvm use --lts
    return
  fi

  # 检测包管理器
  if command -v apt-get &>/dev/null; then
    log_info "使用 NodeSource APT 仓库安装 Node.js 22 ..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif command -v dnf &>/dev/null; then
    log_info "使用 NodeSource RPM 仓库安装 Node.js 22 ..."
    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
    sudo dnf install -y nodejs
  elif command -v yum &>/dev/null; then
    log_info "使用 NodeSource RPM 仓库安装 Node.js 22 ..."
    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
    sudo yum install -y nodejs
  else
    log_error "未找到支持的包管理器（apt/dnf/yum），请手动安装 Node.js >= ${REQUIRED_MAJOR}"
    log_error "下载地址: https://nodejs.org/"
    exit 1
  fi
}

# ─── Windows (Git Bash / MSYS2) 安装 ────────────────────────

install_node_windows() {
  # winget（Windows 10 1709+ 内置）
  if command -v winget &>/dev/null; then
    log_info "使用 winget 安装 Node.js LTS ..."
    winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  # choco
  elif command -v choco &>/dev/null; then
    log_info "使用 Chocolatey 安装 Node.js LTS ..."
    choco install nodejs-lts -y
  # scoop
  elif command -v scoop &>/dev/null; then
    log_info "使用 Scoop 安装 Node.js LTS ..."
    scoop install nodejs-lts
  else
    log_error "未找到 winget / choco / scoop，请手动安装 Node.js >= ${REQUIRED_MAJOR}"
    log_error "下载地址: https://nodejs.org/"
    exit 1
  fi

  log_warn "安装完成，可能需要重新打开终端才能使用 node 命令"
}

# ─── 主流程 ──────────────────────────────────────────────────

main() {
  if check_node; then
    return 0
  fi

  log_info "正在自动安装 Node.js ..."

  local platform
  platform=$(uname -s)

  case "$platform" in
    Darwin)
      install_node_macos
      ;;
    Linux)
      install_node_linux
      ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT)
      install_node_windows
      ;;
    *)
      log_error "不支持的平台: $platform，请手动安装 Node.js >= ${REQUIRED_MAJOR}"
      log_error "下载地址: https://nodejs.org/"
      exit 1
      ;;
  esac

  # 刷新 PATH（部分安装方式需要）
  hash -r 2>/dev/null || true

  if check_node; then
    log_info "Node.js 安装成功！"
  else
    log_error "安装后仍未检测到 Node.js，请重新打开终端后重试"
    exit 1
  fi
}

main "$@"
