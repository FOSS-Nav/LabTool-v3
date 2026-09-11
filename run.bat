@echo off
REM ============================================================
REM LabTool-V3 主菜单（中文引导式）
REM ============================================================

setlocal EnableDelayedExpansion
chcp 65001 > nul
title LabTool-V3 Menu

set "ROOT=%~dp0"
cd /d "%ROOT%"

:menu
cls
echo.
echo ============================================================
echo          LabTool-V3 主菜单
echo ============================================================
echo.
echo   1. start.bat          首次安装 + 一键启动开发模式
echo   2. dev.bat            快速启动开发模式
echo   3. install-deps.bat   仅安装依赖 + 下载 Electron
echo   4. build.bat          构建生产包
echo   0. 退出
echo.
echo ============================================================
echo.

set "OPT="
set /p OPT="请选择 [0-4]: "

if "%OPT%"=="1" (
    call "%ROOT%start.bat"
    goto :menu
)
if "%OPT%"=="2" (
    call "%ROOT%dev.bat"
    goto :menu
)
if "%OPT%"=="3" (
    call "%ROOT%install-deps.bat"
    goto :menu
)
if "%OPT%"=="4" (
    call "%ROOT%build.bat"
    goto :menu
)
if "%OPT%"=="0" exit /b 0

echo 无效选择
timeout /t 2 > nul
goto :menu
