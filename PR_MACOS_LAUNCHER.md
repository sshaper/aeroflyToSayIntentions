# Pull Request: Add macOS Launcher Compatibility

## Summary
This PR adds macOS support for the Aerofly Moving Map application, enabling macOS users to run the application with proper server startup and path handling.

## Problem
- Application was Windows-only with `.bat` launcher script
- Python script used Windows-specific paths for SimAPI files
- macOS users couldn't run the application without manual configuration
- No equivalent launcher script for macOS

## Solution
- **Cross-Platform Path Handling**: Updated Python script to support both Windows and macOS paths
- **macOS Launcher Script**: Created `start_aerofly_map.sh` equivalent to Windows batch file
- **Proper Path Detection**: Automatic detection of operating system for correct file paths

## Changes Made

### `python/udp_to_websocket.py`
- Added cross-platform path detection for SimAPI files
- Windows: Uses `LOCALAPPDATA` environment variable
- macOS: Uses `~/Library/Application Support/` directory
- Maintains backward compatibility with existing Windows installations

### `start_aerofly_map.sh` (New File)
- macOS equivalent to `start_aerofly_map.bat`
- Starts UDP to WebSocket server in background
- Starts HTTP server on port 8080
- Automatically opens browser to application
- Proper process management and cleanup

## Technical Details

### Path Handling
```python
# Windows: %LOCALAPPDATA%/SayIntentionsAI/
# macOS: ~/Library/Application Support/SayIntentionsAI/
```

### Launcher Features
- Background server startup
- Automatic browser opening
- Process ID tracking for cleanup
- Error handling and status reporting

## Testing
- ✅ Tested on macOS (Python 3.12.5)
- ✅ Verified SimAPI file creation in correct macOS location
- ✅ Confirmed HTTP server starts on port 8080
- ✅ Tested WebSocket server functionality
- ✅ Verified backward compatibility with Windows paths

## Benefits
- **macOS Support**: Enables macOS users to run the application
- **Cross-Platform**: Single codebase supports both Windows and macOS
- **User-Friendly**: Simple `./start_aerofly_map.sh` command
- **Maintainable**: Clean separation of platform-specific logic

## Files Changed
- `python/udp_to_websocket.py` - 8 lines modified, 1 line added
- `start_aerofly_map.sh` - 40 lines (new file)

## Usage
```bash
# Make executable
chmod +x start_aerofly_map.sh

# Run application
./start_aerofly_map.sh
```

## Dependencies
- Python 3.7+ (already required)
- `websockets` package (already required)
- No additional dependencies needed

## Notes
- Maintains full backward compatibility with Windows
- No changes to existing Windows functionality
- SimAPI files created in platform-appropriate locations
- Launcher script follows macOS conventions
