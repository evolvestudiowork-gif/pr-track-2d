@echo off
setlocal
powershell.exe -NoProfile -File "%~dp0scripts\Install.ps1" %*
if errorlevel 1 (
  echo.
  echo Cai dat chua hoan tat. Xem thong bao loi o tren.
  pause
  exit /b 1
)
echo.
pause
