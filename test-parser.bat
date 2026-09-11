@echo off
REM ============================================================
REM LabTool-V3 解析器单元测试
REM ============================================================

setlocal EnableDelayedExpansion
chcp 65001 > nul
title LabTool-V3 Parser Test

set "ROOT=%~dp0"
cd /d "%ROOT%"

if not exist "node_modules" (
    echo [ERROR] node_modules 不存在，请先运行 install-deps.bat
    pause
    exit /b 1
)

REM 检测是否已装 tsx
where tsx > nul 2>&1
if errorlevel 1 (
    echo [STEP] 安装 tsx（首次运行）...
    call npm install -g tsx --no-audit --no-fund
    if errorlevel 1 (
        echo [ERROR] tsx 安装失败
        pause
        exit /b 1
    )
)

echo [LabTool-V3] 运行解析器测试...
echo.
call npx tsx tests/parser.test.ts
if errorlevel 1 (
    echo.
    echo [FAIL] 解析器测试失败
) else (
    echo.
    echo [PASS] 解析器测试全部通过
)
echo.
pause
endlocal
