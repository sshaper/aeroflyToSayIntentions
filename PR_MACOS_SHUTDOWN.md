# Pull Request: Add macOS Shutdown Script and Cross-Platform Shutdown Handling

## Summary
This PR adds macOS shutdown functionality to complement the existing Windows shutdown script, enabling the "Exit Application" button to work properly on macOS systems.

## Problem
- The original repository added an "Exit Application" button that calls `kill_aerofly_bridge.bat` for Windows
- macOS users couldn't use the Exit Application button as there was no equivalent shutdown script
- The Python script was hardcoded to only execute Windows batch files

## Solution
- **macOS Shutdown Script**: Created `kill_aerofly_bridge.sh` equivalent to Windows batch file
- **Cross-Platform Detection**: Updated Python script to detect operating system and use appropriate shutdown script
- **Backward Compatibility**: Maintains full compatibility with existing Windows functionality

## Changes Made

### `kill_aerofly_bridge.sh` (New File)
- macOS equivalent to `kill_aerofly_bridge.bat`
- Stops Python servers and processes on ports 8080 and 8765
- Uses macOS/Linux commands (`pkill`, `lsof`, `kill`)
- Nuclear option: Kills terminal processes running the launcher script
- Force kill with SIGKILL (-9) for immediate termination
- Proper error handling and user feedback

### `python/udp_to_websocket.py`
- Added platform detection using `platform.system()`
- Supports Windows (.bat), macOS (.sh), and Linux (.sh) shutdown scripts
- Automatic script selection based on operating system
- Non-blocking script execution using `subprocess.Popen()` to prevent deadlock
- Enhanced error handling and logging

## Technical Details

### Platform Detection
```python
system = platform.system().lower()
if system == "windows":
    script_name = "kill_aerofly_bridge.bat"
elif system == "darwin":  # macOS
    script_name = "kill_aerofly_bridge.sh"
else:  # Linux or other Unix-like systems
    script_name = "kill_aerofly_bridge.sh"
```

### Non-Blocking Execution
```python
# Use Popen instead of run to avoid deadlock
process = subprocess.Popen([script_path], shell=False,
                         stdout=subprocess.PIPE, 
                         stderr=subprocess.PIPE)
```

### Shutdown Script Features
- **Process Management**: Kills Python processes related to the application
- **Port Cleanup**: Stops processes on ports 8080 and 8765
- **Nuclear Option**: Kills terminal processes running the launcher script
- **Force Termination**: Uses SIGKILL (-9) for immediate shutdown
- **Error Handling**: Graceful handling of missing processes
- **User Feedback**: Clear status messages during shutdown

## Testing
- ✅ Tested on macOS (Python 3.12.5)
- ✅ Verified shutdown script executes properly
- ✅ Confirmed process termination on relevant ports
- ✅ Tested platform detection logic
- ✅ Verified backward compatibility with Windows
- ✅ Confirmed Exit Application button works correctly
- ✅ Tested non-blocking script execution (no deadlock)
- ✅ Verified nuclear option kills terminal processes

## Benefits
- **macOS Support**: Enables Exit Application button on macOS
- **Cross-Platform**: Single codebase supports Windows, macOS, and Linux
- **User Experience**: Consistent shutdown behavior across platforms
- **Immediate Shutdown**: Force termination prevents hanging or delays
- **Complete Cleanup**: Nuclear option ensures all processes are terminated
- **Maintainable**: Clean separation of platform-specific logic

## Files Changed
- `kill_aerofly_bridge.sh` - 36 lines (new file)
- `python/udp_to_websocket.py` - 59 lines modified

## Usage
```bash
# Make executable
chmod +x kill_aerofly_bridge.sh

# Manual execution
./kill_aerofly_bridge.sh

# Or use the Exit Application button in the web interface
```

## Integration
- Works seamlessly with existing "Exit Application" button
- No changes required to web interface
- Automatic platform detection and script selection
- Maintains existing Windows functionality

## Notes
- Maintains full backward compatibility with Windows
- No changes to existing Windows functionality
- Shutdown script follows macOS/Linux conventions
- Enhanced error handling and logging for better debugging
- Nuclear option matches Windows approach for complete shutdown
- Non-blocking execution prevents deadlock scenarios
