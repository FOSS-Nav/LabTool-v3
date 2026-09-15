@echo off
REM ============================================================
REM LabTool-V3 快速开发模式（沙箱兼容）
REM ============================================================

setlocal EnableDelayedExpansion
chcp 65001 > nul
title LabTool-V3 Dev

set "ROOT=%~dp0"
cd /d "%ROOT%"

if not exist "node_modules" (
    echo [ERROR] node_modules 不存在，请先运行 install-deps.bat
    pause
    exit /b 1
)

REM 如果 Electron 二进制未下载，补装
if not exist "node_modules\electron\dist\electron.exe" (
    echo [WARN] Electron 二进制未下载，正在补装 ...
    if not exist ".electron-cache" mkdir .electron-cache
    set "ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/"
    set "ELECTRON_CUSTOM_DIR={{ version }}"
    set "ELECTRON_SKIP_BINARY_DOWNLOAD=0"
    set "electron_config_cache=%CD%\.electron-cache"
    pushd node_modules\electron
    call node install.js
    popd
)

REM 确保 sucrase 已装（dev-launcher 依赖）
if not exist "node_modules\sucrase" (
    echo [INFO] 安装 sucrase ^(dev-launcher 依赖^) ...
    call npm install --no-save --ignore-scripts sucrase
)

echo [LabTool-V3] 启动 dev-launcher ...
call node scripts\dev-launcher.mjs
endlocal
