# Node.js 环境检测与自动安装脚本 (Windows PowerShell)
# 以管理员身份运行

$NODE_VERSION = "20.20.0"  # LTS 版本

function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# 检查 Node.js 是否已安装
function Test-NodeInstalled {
    try {
        $nodeVersion = node --version 2>$null
        $npmVersion = npm --version 2>$null
        if ($nodeVersion) {
            Write-Success "Node.js 已安装: $nodeVersion"
            Write-Success "npm 已安装: v$npmVersion"
            return $true
        }
    } catch {}
    return $false
}

# 使用 nvm-windows 安装
function Install-WithNVM {
    Write-Info "使用 nvm-windows 安装 Node.js..."
    
    # 检查 nvm 是否已安装
    $nvmPath = "$env:ProgramData\nvm"
    if (-not (Test-Path $nvmPath)) {
        Write-Info "nvm-windows 未安装，正在下载安装..."
        
        $nvmInstaller = "$env:TEMP\nvm-setup.exe"
        $nvmUrl = "https://github.com/coreybutler/nvm-windows/releases/latest/download/nvm-setup.exe"
        
        Invoke-WebRequest -Uri $nvmUrl -OutFile $nvmInstaller
        Start-Process -FilePath $nvmInstaller -Wait
        
        # 刷新环境变量
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    }
    
    # 安装 Node.js
    nvm install $NODE_VERSION
    nvm use $NODE_VERSION
    
    Write-Success "Node.js v$NODE_VERSION 安装完成！"
}

# 直接下载安装 Node.js
function Install-Direct {
    Write-Info "直接下载安装 Node.js..."
    
    $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
    $installer = "node-v${NODE_VERSION}-$arch.msi"
    $downloadUrl = "https://nodejs.org/dist/v${NODE_VERSION}/$installer"
    $downloadPath = "$env:TEMP\$installer"
    
    Write-Info "下载: $downloadUrl"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $downloadPath
    
    Write-Info "安装 Node.js..."
    Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", "`"$downloadPath`"", "/quiet", "/norestart" -Wait
    
    # 刷新环境变量
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    
    Remove-Item $downloadPath -Force
    Write-Success "Node.js v$NODE_VERSION 安装完成！"
}

# 主逻辑
Write-Host "========================================" -ForegroundColor Blue
Write-Host "  Node.js 环境检测与安装脚本 (Windows)" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host

if (Test-NodeInstalled) {
    Write-Host
    Write-Success "Node.js 环境已就绪，无需安装"
    exit 0
}

Write-Host
Write-Warn "Node.js 未安装，准备自动安装..."
Write-Host

# 选择安装方式
Write-Host "请选择安装方式:"
Write-Host "  1) 使用 nvm-windows (推荐，方便版本管理)"
Write-Host "  2) 直接安装 MSI 包"
$choice = Read-Host "请输入选项 [1-2]"

switch ($choice) {
    "1" { Install-WithNVM }
    "2" { Install-Direct }
    default {
        Write-Error "无效选项"
        exit 1
    }
}

Write-Host
Write-Host "========================================" -ForegroundColor Blue
if (Test-NodeInstalled) {
    Write-Success "Node.js 安装成功！"
} else {
    Write-Error "Node.js 安装失败，请手动安装"
    exit 1
}
Write-Host "========================================" -ForegroundColor Blue
