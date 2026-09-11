@echo off
REM ============================================================
REM LabTool-V3 单独安装依赖（修复 Electron 二进制未下载）
REM ============================================================

setlocal EnableDelayedExpansion
chcp 65001 > nul
title LabTool-V3 Install

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ============================================================
echo   LabTool-V3 依赖安装
echo ============================================================
echo.

REM ---------- 检查工具 ----------
where node > nul 2>&1 || (echo [ERROR] 缺少 Node.js & pause & exit /b 1)
for /f "delims=" %%v in ('node -v') do echo [OK] Node.js %%v
where npm > nul 2>&1 || (echo [ERROR] 缺少 npm & pause & exit /b 1)
for /f "delims=" %%v in ('npm -v') do echo [OK] npm %%v

REM MSVC
where cl > nul 2>&1 && (echo [OK] MSVC 已安装) || (
    echo [WARN] 未检测到 MSVC ^(cl.exe^)
    echo        serialport 原生模块编译将失败
    echo        仍可启动应用，但串口功能不可用
)

REM Python
where python > nul 2>&1
if not errorlevel 1 (
    for /f "delims=" %%v in ('python --version 2^>^&1') do echo [OK] %%v
) else (
    echo [WARN] 未检测到 Python ^(node-gyp 需要^)
)
echo.

REM ---------- .npmrc ----------
if not exist ".npmrc" (
    (
        echo registry=https://registry.npmmirror.com/
        echo electron_mirror=https://registry.npmmirror.com/-/binary/electron/
        echo electron_builder_binaries_mirror=https://registry.npmmirror.com/-/binary/electron-builder-binaries/
        echo cache=./.npm-cache
    ) > .npmrc
    echo [OK] 已创建 .npmrc ^(使用 npmmirror 镜像^)
    echo.
)

REM ---------- 1) npm install ----------
echo [1/3] npm install --ignore-scripts ...
if not exist "node_modules" (
    call npm install --ignore-scripts --no-audit --no-fund
    if errorlevel 1 (echo [ERROR] 依赖安装失败 & pause & exit /b 1)
) else (
    echo [SKIP] node_modules 已存在
)
echo.

REM ---------- 2) Electron 二进制 ----------
echo [2/3] 下载 Electron 二进制 ...
if not exist "node_modules\electron\dist\electron.exe" (
    if not exist ".electron-cache" mkdir .electron-cache
    set "ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/"
    set "ELECTRON_CUSTOM_DIR={{ version }}"
    set "ELECTRON_SKIP_BINARY_DOWNLOAD=0"
    set "electron_config_cache=%CD%\.electron-cache"
    pushd node_modules\electron
    call node install.js
    set "ERRCODE=%ERRORLEVEL%"
    popd
    if not "%ERRCODE%"=="0" (
        echo.
        echo [WARN] Electron 下载失败
        echo        可手动重试：node node_modules\electron\install.js
    )
) else (
    echo [SKIP] Electron 二进制已存在
)
echo.

REM ---------- 3) 类型检查 ----------
echo [3/3] 类型检查 ...
call npm run typecheck > nul 2>&1 && echo [OK] 类型检查通过 || echo [WARN] 类型检查未通过
echo.

echo ============================================================
echo   安装完成
echo.
echo   下一步：
echo     start.bat    一键启动开发模式
echo     dev.bat      快速启动
echo     build.bat    构建生产包
echo ============================================================
echo.
pause
endlocal
