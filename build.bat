@echo off
REM ============================================================
REM LabTool-V3 Production Build
REM ============================================================
REM Outputs to dist/:
REM   - LabTool-V3-x.y.z-x64-portable.exe  Single-file green 64-bit
REM   - LabTool-V3-x.y.z-ia32-portable.exe Single-file green 32-bit
REM   - LabTool-V3-x.y.z-x64-setup.exe     NSIS installer 64-bit
REM   - LabTool-V3-x.y.z-ia32-setup.exe    NSIS installer 32-bit
REM   - win-unpacked/                      Unpacked dir (per arch)
REM ============================================================
REM
REM NOTE: This file is intentionally English-only. cmd.exe on
REM Chinese Windows reads BAT files as GBK/CP936 and will mangle
REM UTF-8 characters (even after `chcp 65001`), breaking if-block
REM pairing and producing "is not recognized as a command" errors.
REM See README.md "Building" section for details.
REM ============================================================

setlocal EnableDelayedExpansion
chcp 65001 > nul
title LabTool-V3 Build

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ============================================================
echo   LabTool-V3 Build Script
echo ============================================================
echo.

REM ---------- Architecture selection ----------
echo Select architecture:
echo   1^) x64   (64-bit, mainstream Windows^)
echo   2^) ia32  (32-bit, legacy machines^)
echo   3^) both  (build x64 + ia32^)
echo.
set "ARCH="
set /p ARCH="Enter [1/2/3] (default 3): "
if "%ARCH%"=="" set "ARCH=3"

if "%ARCH%"=="1" (
    set "ARCH_FLAG=--x64"
    set "ARCH_DESC=64-bit (x64)"
)
if "%ARCH%"=="2" (
    set "ARCH_FLAG=--ia32"
    set "ARCH_DESC=32-bit (ia32)"
)
if "%ARCH%"=="3" (
    set "ARCH_FLAG=--x64 --ia32"
    set "ARCH_DESC=64-bit + 32-bit"
)

echo.
echo Architecture: %ARCH_DESC%
echo.

REM ---------- Build target selection ----------
echo Select build target:
echo   1^) portable only (single exe, no install^)
echo   2^) nsis only     (installer with uninstaller/shortcuts^)
echo   3^) both
echo   4^) build only    (electron-vite build, no packaging^)
echo.
set "CHOICE="
set /p CHOICE="Enter [1/2/3/4] (default 3): "
if "%CHOICE%"=="" set "CHOICE=3"

if "%CHOICE%"=="1" (
    set "TYPE_FLAG=portable"
    set "DESC=portable single exe"
)
if "%CHOICE%"=="2" (
    set "TYPE_FLAG=nsis"
    set "DESC=NSIS installer"
)
if "%CHOICE%"=="3" (
    set "TYPE_FLAG=portable nsis"
    set "DESC=portable + nsis"
)
if "%CHOICE%"=="4" (
    set "TYPE_FLAG="
    set "DESC=electron-vite build only"
)

echo.
echo Target: %DESC%
echo Command: npx electron-builder --win %ARCH_FLAG% %TYPE_FLAG% --publish=never
echo.

if not exist "node_modules" (
    echo [ERROR] Dependencies not installed. Run start.bat or install-deps.bat first.
    pause
    exit /b 1
)

REM ---------- Execute ----------
call npx --no-install electron-builder --win %ARCH_FLAG% %TYPE_FLAG% --publish=never
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   [OK] Build complete
echo ============================================================
echo.
echo Output files:
if exist "dist\LabTool-V3-*-x64-portable.exe"   echo   Portable 64-bit : dist\LabTool-V3-*-x64-portable.exe
if exist "dist\LabTool-V3-*-ia32-portable.exe"  echo   Portable 32-bit : dist\LabTool-V3-*-ia32-portable.exe
if exist "dist\LabTool-V3-*-x64-setup.exe"      echo   Installer 64-bit: dist\LabTool-V3-*-x64-setup.exe
if exist "dist\LabTool-V3-*-ia32-setup.exe"     echo   Installer 32-bit: dist\LabTool-V3-*-ia32-setup.exe
if exist "dist\win-unpacked"                    echo   Unpacked 64-bit : dist\win-unpacked\
if exist "dist\win-ia32-unpacked"               echo   Unpacked 32-bit : dist\win-ia32-unpacked\
echo.
pause
endlocal