@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
  )
)

echo Building app...
call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

echo Starting app in browser...
echo Press Ctrl+C in this window to stop the app server.
call npm run browser-app
