@echo off
REM ============================================================
REM LabTool-V3 一键启动脚本（修复版）
REM ============================================================
REM 流程：
REM   1. 检测 Node.js / npm
REM   2. npm install --ignore-scripts（避开 serialport 编译 EPERM）
REM   3. 手动跑 electron postinstall（用 npmmirror 下载二进制）
REM   4. 可选：electron-rebuild serialport（如需串口）
REM   5. 启动 npm run dev

setlocal EnableDelayedExpansion
chcp 65001 > nul
title LabTool-V3 Launcher

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo.
echo ============================================================
echo   LabTool-V3 Launcher
echo   Root: %ROOT%
echo ============================================================
echo.

REM ---------- 1) Node.js / npm 检测 ----------
where node > nul 2>&1 || (echo [ERROR] 缺少 Node.js 20+ & pause & exit /b 1)
for /f "delims=" %%v in ('node -v') do echo [OK] Node.js %%v
where npm > nul 2>&1 || (echo [ERROR] 缺少 npm & pause & exit /b 1)
for /f "delims=" %%v in ('npm -v') do echo [OK] npm %%v
echo.

REM ---------- 2) 安装依赖 ----------
if not exist "node_modules" (
    echo [STEP 1/4] 首次安装依赖（约 5-10 分钟）...
    call npm install --ignore-scripts --no-audit --no-fund
    if errorlevel 1 (echo [ERROR] 依赖安装失败 & pause & exit /b 1)
    echo [OK] 依赖安装完成
    echo.
) else (
    echo [SKIP] node_modules 已存在
    echo.
)

REM ---------- 3) 下载 Electron 二进制 ----------
if not exist "node_modules\electron\dist\electron.exe" (
    echo [STEP 2/4] 下载 Electron 二进制（约 100MB）...
    if not exist ".electron-cache" mkdir .electron-cache
    set "ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/"
    set "ELECTRON_CUSTOM_DIR={{ version }}"
    set "ELECTRON_SKIP_BINARY_DOWNLOAD=0"
    set "electron_config_cache=%CD%\.electron-cache"
    call node node_modules\electron\install.js
    if errorlevel 1 (
        echo [WARN] Electron 二进制下载失败
        echo        可手动重试：node node_modules\electron\install.js
    ) else (
        echo [OK] Electron 二进制就绪
    )
    echo.
) else (
    echo [SKIP] Electron 二进制已存在
    echo.
)

REM ---------- 4) 可选：serialport 原生模块 ----------
if not exist "node_modules\@serialport\bindings-cpp-prebuilt\build\Release" (
    if not exist "node_modules\serialport\build\Release" (
        echo [STEP 3/4] serialport 原生模块未编译（串口功能暂不可用）
        echo   如需串口功能，请安装 Visual Studio Build Tools + Python 3 后运行：
        echo     npx electron-rebuild -f -w serialport
        echo   否则 UI、解析、文件落盘仍可演示。
        echo.
    )
) else (
    echo [SKIP] serialport 原生模块已编译
    echo.
)

REM ---------- 5) 类型检查 ----------
echo [STEP 4/4] 类型检查...
call npm run typecheck > nul 2>&1 && (echo [OK] 类型检查通过) || (echo [WARN] 类型检查未通过，详情：npm run typecheck)
echo.

REM ---------- 6) 启动 ----------
echo ============================================================
echo   启动开发模式 ^(npm run dev^)
echo   关闭此窗口或 Ctrl+C 可退出
echo ============================================================
echo.
call npm run dev
endlocal
