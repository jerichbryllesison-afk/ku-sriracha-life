@echo off
cd /d "%~dp0"
title KU Sriracha Life - public link
if not exist node_modules (echo Installing packages... & call npm install)
if not exist tools\cloudflared.exe (
  echo Downloading Cloudflare Tunnel - one time only...
  curl -L -o tools\cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
)
start "KU Sriracha Life server" cmd /k node server.js
timeout /t 3 >nul
echo.
echo ============================================================
echo  Your public link appears below: https://xxxx.trycloudflare.com
echo  Send it to friends. Keep BOTH windows open while they play.
echo  Close this window to stop sharing.
echo ============================================================
echo.
tools\cloudflared.exe tunnel --url http://localhost:3000
pause
