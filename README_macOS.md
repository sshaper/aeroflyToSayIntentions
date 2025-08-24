# Aerofly Moving Map - macOS Setup Guide

This guide will help you set up the Aerofly Moving Map application on macOS.

## Prerequisites

1. **Python 3.7 or higher** - macOS comes with Python 2.7, but you need Python 3
2. **pip3** - Python package manager

## Installation Steps

### 1. Check Python Installation

First, check if Python 3 is installed:

```bash
python3 --version
```

If Python 3 is not installed, install it using Homebrew:

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Python 3
brew install python3
```

### 2. Install Required Dependencies

Run the dependency checker to see what's missing:

```bash
python3 check_dependencies.py
```

Install the required websockets package:

```bash
pip3 install websockets
```

### 3. Start the Application

Use the macOS launcher script:

```bash
./start_aerofly_map.sh
```

This will:
- Start the UDP to WebSocket server (receives data from Aerofly FS4)
- Start the HTTP server on port 8080
- Open your default browser to `http://localhost:8080/index.html`

### 4. Manual Start (Alternative)

If the launcher script doesn't work, you can start the servers manually:

**Terminal 1 - Start the UDP to WebSocket server:**
```bash
python3 python/udp_to_websocket.py
```

**Terminal 2 - Start the HTTP server:**
```bash
python3 -m http.server 8080
```

**Then open your browser to:** `http://localhost:8080/index.html`

## Troubleshooting

### Emoji Display Issues

If you don't see airport icons (🏢) or aircraft icons (✈️):

1. **Browser Compatibility**: Try using Safari, Chrome, or Firefox
2. **Font Support**: The application now includes fallback text labels (APT, HELI) if emojis don't render
3. **System Fonts**: Make sure your macOS has emoji font support (should be available by default)

### Localhost Access Issues

If you can't access `localhost:8080`:

1. **Check if servers are running**: Look for the Python processes
2. **Firewall**: Make sure macOS firewall isn't blocking the connection
3. **Port conflicts**: Check if port 8080 is already in use:
   ```bash
   lsof -i :8080
   ```

### WebSocket Connection Issues

If the moving map doesn't show aircraft position:

1. **Check WebSocket server**: Make sure the UDP to WebSocket server is running
2. **Browser console**: Open Developer Tools (F12) and check for WebSocket connection errors
3. **Aerofly FS4**: Ensure Aerofly FS4 is configured to send UDP data to port 49002

## File Locations

The application will create SimAPI files in:
```
~/Library/Application Support/SayIntentionsAI/
```

## Stopping the Application

- **If using the launcher script**: Press Enter in the terminal window
- **If running manually**: Press Ctrl+C in each terminal window

## Notes

- The application is designed for VR use with tools like OS Overlay
- It can also be used on a separate tablet or computer
- The Python backend bridges Aerofly FS4 data to SayIntentionsAI
- All emoji icons now have fallback text labels for better compatibility

## Support

If you continue to have issues:

1. Check the browser console for JavaScript errors
2. Verify Python dependencies are installed correctly
3. Ensure Aerofly FS4 is properly configured for UDP output
4. Check that SayIntentionsAI is installed and configured
