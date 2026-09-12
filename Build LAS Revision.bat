@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\electron-builder\bin\electron-builder.js" (
  echo Installing the packaging tools...
  call npm install
  if errorlevel 1 (
    echo.
    echo Could not install dependencies. Make sure Node.js is installed and try again.
    pause
    exit /b 1
  )
)
call npm run package
if errorlevel 1 pause
