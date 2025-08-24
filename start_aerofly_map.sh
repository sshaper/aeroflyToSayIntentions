#!/bin/bash

# Function to cleanup on exit
cleanup() {
    echo -e "\nReceived interrupt signal, cleaning up..."
    if [ ! -z "$UDP_PID" ]; then
        kill -TERM $UDP_PID 2>/dev/null
    fi
    if [ ! -z "$HTTP_PID" ]; then
        kill -TERM $HTTP_PID 2>/dev/null
    fi
    sleep 1
    if [ ! -z "$UDP_PID" ]; then
        kill -KILL $UDP_PID 2>/dev/null
    fi
    if [ ! -z "$HTTP_PID" ]; then
        kill -KILL $HTTP_PID 2>/dev/null
    fi
    echo "Cleanup complete."
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

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
echo "Press Enter to stop the servers..."
read

# Gracefully stop the servers
echo "Stopping servers gracefully..."
kill -TERM $UDP_PID $HTTP_PID

# Wait a moment for graceful shutdown
sleep 2

# Force kill if still running
if kill -0 $UDP_PID 2>/dev/null; then
    echo "Force stopping UDP server..."
    kill -KILL $UDP_PID
fi

if kill -0 $HTTP_PID 2>/dev/null; then
    echo "Force stopping HTTP server..."
    kill -KILL $HTTP_PID
fi

echo "Servers stopped."