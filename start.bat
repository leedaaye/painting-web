@echo off
chcp 65001 >nul
echo ========================================
echo   Painting Web 一键启动脚本
echo ========================================
echo.

:: 检查 node_modules 是否存在
if not exist "node_modules" (
    echo [1/3] 首次运行，正在安装依赖...
    call pnpm install
    if errorlevel 1 (
        echo 依赖安装失败！请检查是否已安装 pnpm
        pause
        exit /b 1
    )
) else (
    echo [1/3] 依赖已存在，跳过安装
)

:: 检查数据库是否需要初始化
if not exist "prisma\dev.db" (
    echo [2/3] 初始化数据库...
    call npx prisma generate
    call npx prisma db push
    if errorlevel 1 (
        echo 数据库初始化失败！
        pause
        exit /b 1
    )
) else (
    echo [2/3] 数据库已存在，跳过初始化
)

echo [3/3] 启动开发服务器...
echo.
echo 服务器将在 http://localhost:3000 启动
echo 按 Ctrl+C 可停止服务器
echo.
call pnpm dev
