@echo off
title KU Sriracha Life Server
cd /d "%~dp0"
if not exist node_modules\socket.io (
  echo Installing packages...
  call npm install
)
echo.
echo  KU Sriracha Life is starting...  open http://localhost:3000
echo.
start "" http://localhost:3000
node server.js
pause
