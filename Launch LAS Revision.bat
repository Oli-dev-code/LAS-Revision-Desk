@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo First run: installing the desktop app dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo Could not install dependencies. Make sure Node.js is installed and try again.
    pause
    exit /b 1
  )
)
call npm start
