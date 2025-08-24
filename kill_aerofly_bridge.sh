#!/bin/bash

echo "Stopping Aerofly Bridge..."
echo

echo "Shutting down all related processes..."

# Kill Python processes related to the application
echo "Stopping Python servers..."
pkill -f "python.*udp_to_websocket.py" 2>/dev/null
pkill -f "python.*http.server" 2>/dev/null

# Kill any remaining Python processes (more aggressive)
echo "Stopping all Python processes..."
pkill -f python 2>/dev/null

# Kill any processes using the relevant ports
echo "Stopping processes on ports 8080 and 8765..."
lsof -ti:8080 | xargs kill -9 2>/dev/null
lsof -ti:8765 | xargs kill -9 2>/dev/null

echo
echo "Aerofly Bridge shutdown complete."
echo
echo "This window will close automatically in 3 seconds..."
sleep 3
exit 0
