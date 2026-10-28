@echo off
chcp 65001 >nul
title KU Sriracha Life Server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org then run this file again.
  pause
  exit /b 1
)
if not exist node_modules\socket.io (
  echo Installing packages...
  call npm install
)
rem The database is built in: Node.js 22.13+ has SQLite included. Older Node gets the better-sqlite3 driver once.
node tools\check-driver.js
if errorlevel 3 (
  echo Your Node.js is older than 22.13 - installing the SQLite driver once...
  call npm install better-sqlite3 --no-save
)
echo.
echo  KU Sriracha Life is starting...  open http://localhost:3000
echo  Your save database: data\kusl.db   (backups: data\backups)
echo  Close this window or press Ctrl+C to stop the server safely.
echo.
start "" http://localhost:3000
node server.js
pause
