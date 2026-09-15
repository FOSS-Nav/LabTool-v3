@echo off
REM ============================================================
REM LabTool-V3 启动脚本（沙箱兼容）
REM ============================================================
REM 优先使用 scripts/dev-launcher.mjs（不依赖 esbuild/Vite）。
REM 也可选择原版 npm run dev（需要本机完整工具链）。
REM ============================================================

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

REM ---------- Node 检测 ----------
where node > nul 2>&1 || (echo [ERROR] 缺少 Node.js 20+ & pause & exit /b 1)
for /f "delims=" %%v in ('node -v') do echo [OK] Node.js %%v
where npm > nul 2>&1 || (echo [ERROR] 缺少 npm & pause & exit /b 1)
for /f "delims=" %%v in ('npm -v') do echo [OK] npm %%v
echo.

REM ---------- 安装依赖 ----------
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

REM ---------- Electron 二进制 ----------
if not exist "node_modules\electron\dist\electron.exe" (
    echo [STEP 2/4] 下载 Electron 二进制...
    if not exist ".electron-cache" mkdir .electron-cache
    set "ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/"
    set "ELECTRON_CUSTOM_DIR={{ version }}"
    set "ELECTRON_SKIP_BINARY_DOWNLOAD=0"
    set "electron_config_cache=%CD%\.electron-cache"
    call node node_modules\electron\install.js
    if errorlevel 1 (
        echo [WARN] Electron 下载失败
        echo        可手动重试：node node_modules\electron\install.js
    ) else (
        echo [OK] Electron 二进制就绪
    )
    echo.
) else (
    echo [SKIP] Electron 二进制已存在
    echo.
)

REM ---------- serialport 原生模块（可选） ----------
if exist "node_modules\serialport\build\Release" (
    echo [OK] serialport 原生模块已编译
) else if exist "node_modules\@serialport\bindings-cpp-prebuilt\build\Release" (
    echo [OK] serialport 原生模块已编译
) else (
    echo [STEP 3/4] serialport 原生模块未编译（串口功能暂不可用）
    echo   如需打开真实串口，请安装 Visual Studio Build Tools + Python 3 后运行：
    echo     npx electron-rebuild -f -w serialport
    echo.
)

REM ---------- 类型检查 ----------
echo [STEP 4/4] 类型检查...
call npm run typecheck > nul 2>&1 && (echo [OK] 类型检查通过) || (echo [WARN] 类型检查未通过)
echo.

REM ---------- 启动方式选择 ----------
echo ============================================================
echo   启动方式选择：
echo     1^) dev-launcher ^（沙箱兼容，无需 esbuild/Vite^）
echo     2^) npm run dev ^（原版 electron-vite^）
echo ============================================================
echo.
set "MODE="
set /p MODE="请选择 [1/2] (默认 1): "
if "%MODE%"=="" set "MODE=1"

if "%MODE%"=="2" (
    echo.
    call npm run dev
) else (
    if not exist "node_modules\sucrase" (
        echo [WARN] sucrase 未安装，自动安装...
        call npm install --no-save --ignore-scripts sucrase
    )
    echo.
    call node scripts\dev-launcher.mjs
)

endlocal
