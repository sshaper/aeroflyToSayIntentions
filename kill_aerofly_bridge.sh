#!/bin/bash

echo "Stopping Aerofly Bridge..."
echo

echo "Shutting down all related processes..."

# Kill Python processes related to the application (force kill)
echo "Stopping Python servers..."
pkill -9 -f "python.*udp_to_websocket.py" 2>/dev/null
pkill -9 -f "python.*http.server" 2>/dev/null

# Kill any remaining Python processes (force kill)
echo "Stopping all Python processes..."
pkill -9 -f python 2>/dev/null

# Kill any processes using the relevant ports
echo "Stopping processes on ports 8080 and 8765..."
lsof -ti:8080 | xargs kill -9 2>/dev/null
lsof -ti:8765 | xargs kill -9 2>/dev/null

# Nuclear option: Kill terminal processes (equivalent to Windows cmd.exe kill)
echo "Closing all terminal windows (nuclear option)..."
pkill -9 -f "start_aerofly_map.sh" 2>/dev/null
pkill -9 -f "bash.*start_aerofly_map" 2>/dev/null
pkill -9 -f "zsh.*start_aerofly_map" 2>/dev/null

# Kill any remaining shell processes that might be running the script
echo "Killing any remaining shell processes..."
pkill -9 -f "python.*http.server" 2>/dev/null
pkill -9 -f "python.*udp_to_websocket" 2>/dev/null

echo
echo "Aerofly Bridge shutdown complete."
exit 0
