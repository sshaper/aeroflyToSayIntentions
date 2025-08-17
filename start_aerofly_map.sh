#!/bin/bash

echo "Starting Aerofly Moving Map..."
echo

# Start the UDP to WebSocket server in the background
echo "Starting UDP to WebSocket server..."
python3 python/udp_to_websocket.py &
UDP_PID=$!

# Wait a moment for the first server to start
sleep 2

# Start the HTTP server in the background
echo "Starting HTTP server..."
python3 -m http.server 8080 &
HTTP_PID=$!

# Wait a moment for the HTTP server to start
sleep 3

# Open the browser
echo "Opening browser..."
open http://localhost:8080/index.html

echo
echo "Aerofly Moving Map is starting up!"
echo
echo "The following servers should now be running:"
echo "1. UDP to WebSocket Server (receives data from Aerofly FS 4) - PID: $UDP_PID"
echo "2. HTTP Server (serves the web page) - PID: $HTTP_PID"
echo "3. Browser with the moving map"
echo
echo "To stop the servers, press Ctrl+C or run: kill $UDP_PID $HTTP_PID"
echo

# Wait for user input to stop
read -p "Press Enter to stop the servers..."
kill $UDP_PID $HTTP_PID
echo "Servers stopped."
