#!/bin/bash
# Node.js 环境检测与自动安装脚本
# 支持 macOS 和 Linux

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Node.js 版本配置
NODE_VERSION="20.20.0"  # LTS 版本

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检测系统类型
detect_os() {
    OS=$(uname -s)
    ARCH=$(uname -m)
    
    case "$OS" in
        Darwin)
            PLATFORM="macos"
            ;;
        Linux)
            PLATFORM="linux"
            ;;
        *)
            log_error "不支持的操作系统: $OS"
            exit 1
            ;;
    esac
    
    case "$ARCH" in
        x86_64)
            ARCH_TYPE="x64"
            ;;
        arm64|aarch64)
            ARCH_TYPE="arm64"
            ;;
        *)
            log_error "不支持的架构: $ARCH"
            exit 1
            ;;
    esac
    
    log_info "检测到系统: $OS ($ARCH)"
}

# 检查 Node.js 是否已安装
check_node() {
    if command -v node &> /dev/null; then
        NODE_CURRENT=$(node --version 2>/dev/null | sed 's/v//')
        NPM_CURRENT=$(npm --version 2>/dev/null)
        log_success "Node.js 已安装: v$NODE_CURRENT"
        log_success "npm 已安装: v$NPM_CURRENT"
        return 0
    else
        return 1
    fi
}

# 使用 nvm 安装 Node.js
install_with_nvm() {
    log_info "使用 nvm 安装 Node.js..."
    
    # 检查 nvm 是否已安装
    if [ -z "$NVM_DIR" ] || ! command -v nvm &> /dev/null; then
        log_info "nvm 未安装，正在安装 nvm..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        
        # 加载 nvm
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi
    
    # 安装 Node.js
    nvm install $NODE_VERSION
    nvm use $NODE_VERSION
    nvm alias default $NODE_VERSION
    
    log_success "Node.js v$NODE_VERSION 安装完成！"
}

# 直接下载安装 Node.js
install_direct() {
    log_info "直接下载安装 Node.js..."
    
    # 创建临时目录
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    
    NODE_PACKAGE="node-v${NODE_VERSION}-${PLATFORM}-${ARCH_TYPE}"
    
    if [ "$PLATFORM" = "macos" ]; then
        NODE_TARBALL="${NODE_PACKAGE}.pkg"
        DOWNLOAD_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}"
        
        log_info "下载: $DOWNLOAD_URL"
        curl -O "$DOWNLOAD_URL"
        
        log_info "安装 Node.js..."
        sudo installer -pkg "$NODE_TARBALL" -target /
    else
        NODE_TARBALL="${NODE_PACKAGE}.tar.xz"
        DOWNLOAD_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}"
        
        log_info "下载: $DOWNLOAD_URL"
        curl -O "$DOWNLOAD_URL"
        
        log_info "解压并安装 Node.js..."
        sudo tar -C /usr/local --strip-components=1 -xJf "$NODE_TARBALL"
    fi
    
    # 清理
    cd -
    rm -rf "$TEMP_DIR"
    
    log_success "Node.js v$NODE_VERSION 安装完成！"
}

# 主逻辑
main() {
    echo "========================================"
    echo "  Node.js 环境检测与安装脚本"
    echo "========================================"
    echo
    
    detect_os
    
    if check_node; then
        echo
        log_success "Node.js 环境已就绪，无需安装"
        node --version
        npm --version
        exit 0
    fi
    
    echo
    log_warn "Node.js 未安装，准备自动安装..."
    echo
    
    # 询问安装方式
    echo "请选择安装方式:"
    echo "  1) 使用 nvm (推荐，方便版本管理)"
    echo "  2) 直接安装"
    read -p "请输入选项 [1-2]: " choice
    
    case "$choice" in
        1)
            install_with_nvm
            ;;
        2)
            install_direct
            ;;
        *)
            log_error "无效选项"
            exit 1
            ;;
    esac
    
    echo
    echo "========================================"
    if check_node; then
        log_success "Node.js 安装成功！"
        node --version
        npm --version
    else
        log_error "Node.js 安装失败，请手动安装"
        exit 1
    fi
    echo "========================================"
}

main "$@"
