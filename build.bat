@echo off
REM ============================================================
REM LabTool-V3 构建生产包
REM ============================================================
REM 产出 dist/ 目录下的：
REM   - LabTool-V3-x.y.z-portable.exe    绿色单文件
REM   - LabTool-V3-x.y.z-setup.exe       NSIS 安装包
REM   - win-unpacked/                     解包目录
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

REM 询问构建类型
echo 请选择构建目标：
echo   1^) 仅绿色版 portable ^(单 exe，~67 MB^)
echo   2^) 仅安装版 nsis ^(带卸载器，~67 MB^)
echo   3^) 同时打两种
echo   4^) 仅构建 ^(electron-vite build^)，不打包
echo.
set "CHOICE="
set /p CHOICE="请输入 [1/2/3/4]: "

if "%CHOICE%"=="" set "CHOICE=1"

if "%CHOICE%"=="1" (
    set "CMD=npm run pack:portable"
    set "DESC=portable 单 exe"
)
if "%CHOICE%"=="2" (
    set "CMD=npm run pack:nsis"
    set "DESC=NSIS 安装包"
)
if "%CHOICE%"=="3" (
    set "CMD=npm run pack"
    set "DESC=portable + nsis"
)
if "%CHOICE%"=="4" (
    set "CMD=npm run build"
    set "DESC=electron-vite build"
)

echo.
echo [LabTool-V3] 目标: %DESC%
echo [LabTool-V3] 命令: %CMD%
echo.

if not exist "node_modules" (
    echo [ERROR] 依赖未安装，请先运行 start.bat
    pause
    exit /b 1
)

call %CMD%
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
if "%CHOICE%"=="3" goto :showboth
if "%CHOICE%"=="1" goto :showportable
if "%CHOICE%"=="2" goto :shownsis
if "%CHOICE%"=="4" goto :showbuild
goto :end

:showboth
if exist "dist\LabTool-V3-*-portable.exe" echo   绿色版: dist\LabTool-V3-*-portable.exe
if exist "dist\LabTool-V3-*-setup.exe"    echo   安装版: dist\LabTool-V3-*-setup.exe
if exist "dist\win-unpacked"              echo   解包目录: dist\win-unpacked\
goto :end

:showportable
if exist "dist\LabTool-V3-*-portable.exe" echo   绿色版: dist\LabTool-V3-*-portable.exe
goto :end

:shownsis
if exist "dist\LabTool-V3-*-setup.exe" echo   安装版: dist\LabTool-V3-*-setup.exe
goto :end

:showbuild
if exist "out" echo   中间产物: out\
goto :end

:end
echo.
pause
endlocal
