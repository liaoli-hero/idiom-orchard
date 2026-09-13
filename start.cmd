@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   成语果园 · 正在启动本地服务器...
echo   浏览器会打开 http://localhost:8765/index.html
echo   关掉这个黑窗口就是关掉服务器。
echo.
start "" http://localhost:8765/index.html
node "tools\serve.mjs" 8765
