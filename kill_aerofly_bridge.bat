@echo off
title Kill Aerofly Bridge
echo Stopping Aerofly Bridge...

echo Shutting down all related processes and windows...

REM Kill all Python processes
taskkill /IM python.exe /F 2>nul

REM Kill all command prompt windows (nuclear option)
echo Closing all command prompt windows...
taskkill /IM cmd.exe /F 2>nul

echo.
echo Aerofly Bridge shutdown complete.
echo.
echo This window will close automatically in 3 seconds...
timeout /t 3 /nobreak >nul
exit
