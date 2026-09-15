@echo off
REM ============================================================
REM LabTool-V3 构建生产包
REM ============================================================
REM 产出 dist/ 目录下的：
REM   - LabTool-V3-x.y.z-x64-portable.exe   绿色单文件 64 位
REM   - LabTool-V3-x.y.z-ia32-portable.exe  绿色单文件 32 位
REM   - LabTool-V3-x.y.z-x64-setup.exe      NSIS 安装包 64 位
REM   - LabTool-V3-x.y.z-ia32-setup.exe     NSIS 安装包 32 位
REM   - win-unpacked/                        解包目录（每个 arch 一份）
REM ============================================================

setlocal EnableDelayedExpansion
chcp 65001 > nul
title LabTool-V3 Build

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ============================================================
echo   LabTool-V3 构建脚本
echo ============================================================
echo.

REM ---------- 架构选择 ----------
echo 请选择架构：
echo   1^) x64   ^(64 位，主流 Windows^)
echo   2^) ia32  ^(32 位，老机器兼容^)
echo   3^) 全部  ^(同时打 x64 + ia32^)
echo.
set "ARCH="
set /p ARCH="请输入 [1/2/3] (默认 3): "
if "%ARCH%"=="" set "ARCH=3"

if "%ARCH%"=="1" (
    set "ARCH_FLAG=--x64"
    set "ARCH_DESC=64 位 (x64)"
)
if "%ARCH%"=="2" (
    set "ARCH_FLAG=--ia32"
    set "ARCH_DESC=32 位 (ia32)"
)
if "%ARCH%"=="3" (
    set "ARCH_FLAG=--x64 --ia32"
    set "ARCH_DESC=64 位 + 32 位"
)

echo.
echo 架构: %ARCH_DESC%
echo.

REM ---------- 构建类型 ----------
echo 请选择构建目标：
echo   1^) 仅绿色版 portable ^(单 exe，不安装^)
echo   2^) 仅安装版 nsis   ^(带卸载器/快捷方式^)
echo   3^) 同时打两种
echo   4^) 仅构建 ^(electron-vite build^)，不打包
echo.
set "CHOICE="
set /p CHOICE="请输入 [1/2/3/4]: "
if "%CHOICE%"=="" set "CHOICE=3"

if "%CHOICE%"=="1" (
    set "TYPE_FLAG=portable"
    set "DESC=portable 单 exe"
)
if "%CHOICE%"=="2" (
    set "TYPE_FLAG=nsis"
    set "DESC=NSIS 安装包"
)
if "%CHOICE%"=="3" (
    set "TYPE_FLAG=portable nsis"
    set "DESC=portable + nsis"
)
if "%CHOICE%"=="4" (
    set "TYPE_FLAG="
    set "DESC=electron-vite build"
)

echo.
echo 目标: %DESC%
echo 命令: npx electron-builder --win %ARCH_FLAG% %TYPE_FLAG% --publish=never
echo.

if not exist "node_modules" (
    echo [ERROR] 依赖未安装，请先运行 start.bat 或 install-deps.bat
    pause
    exit /b 1
)

REM ---------- 执行 ----------
call npx --no-install electron-builder --win %ARCH_FLAG% %TYPE_FLAG% --publish=never
if errorlevel 1 (
    echo.
    echo [ERROR] 构建失败
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   [OK] 构建完成
echo ============================================================
echo.
echo 产物列表：
if exist "dist\LabTool-V3-*-x64-portable.exe"   echo   绿色 64 位: dist\LabTool-V3-*-x64-portable.exe
if exist "dist\LabTool-V3-*-ia32-portable.exe"  echo   绿色 32 位: dist\LabTool-V3-*-ia32-portable.exe
if exist "dist\LabTool-V3-*-x64-setup.exe"      echo   安装 64 位: dist\LabTool-V3-*-x64-setup.exe
if exist "dist\LabTool-V3-*-ia32-setup.exe"     echo   安装 32 位: dist\LabTool-V3-*-ia32-setup.exe
if exist "dist\win-unpacked"                    echo   解包 64 位: dist\win-unpacked\
if exist "dist\win-ia32-unpacked"               echo   解包 32 位: dist\win-ia32-unpacked\
echo.
pause
endlocal
