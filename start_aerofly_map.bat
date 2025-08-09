@echo off
title Aerofly Moving Map Launcher
echo Starting Aerofly Moving Map...
echo.


REM Start the UDP to WebSocket server in a new window
echo Starting UDP to WebSocket server...
start "UDP to WebSocket Server" cmd /k python python/udp_to_websocket.py

REM Wait a moment for the first server to start
timeout /t 2 /nobreak >nul

REM Start the HTTP server in a new window
echo Starting HTTP server...
start "HTTP Server" cmd /k python -m http.server 8080

REM Wait a moment for the HTTP server to start
timeout /t 3 /nobreak >nul

REM Open the browser
echo Opening browser...
start http://localhost:8080/index.html

REM Open sayintentions
echo Opening say intentions
start "" "C:\Users\sshaper\AppData\Roaming\SayIntentionsAI\SayIntentionsAI\SayIntentionsAI.exe"


REM Open SteamVR
echo Opening SteamVR...
start "" "C:\Program Files (x86)\Steam\steamapps\common\SteamVR\bin\win64\vrstartup.exe"


echo.
echo Aerofly Moving Map is starting up!
echo.
echo The following windows should now be open:
echo 1. UDP to WebSocket Server (receives data from Aerofly FS 4)
echo 2. HTTP Server (serves the web page)
echo 3. Browser with the moving map
echo.
echo To stop the servers, close the command windows.
echo.
pause