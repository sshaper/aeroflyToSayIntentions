# Aerofly FS4 to SayIntentionsAI Bridge
#
# This script acts as a bridge between Aerofly FS4 flight simulator and SayIntentionsAI.
# It receives UDP telemetry data from Aerofly FS4, converts it to SimAPI format,
# and provides a WebSocket interface for real-time data streaming to web clients.  
# It also manages the radio state from the web interface along with a moving map.
#
# Key Features:
# - UDP server to receive telemetry data from Aerofly FS4
# - WebSocket server for real-time data streaming to web interface
# - Converts Aerofly data format to SimAPI format for SayIntentionsAI
# - Manages radio state from web interface
# - Provides moving map position data

# Very important to have the following modules installed:  If you have to install them, you can do so with the following command:
# pip install websockets asyncio socket json time os
#
# Or to do one at a time you can use the following command:
# pip install websockets
# pip install asyncio
# pip install socket
# pip install json
# pip install time
# pip install os

import asyncio
import websockets
import socket
import json
import time
import os
import signal

# Network configuration
UDP_PORT = 49002  # Port to receive UDP telemetry from Aerofly FS4
WS_PORT = 8765    # Port for WebSocket server

# Shutdown event for graceful termination
shutdown_event = asyncio.Event()

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    print(f"\nReceived signal {signum}, shutting down gracefully...")
    shutdown_event.set()

def cleanup():
    """Clean up resources before shutdown"""
    print("Cleaning up resources...")
    try:
        sock.close()
        print("UDP socket closed")
    except Exception as e:
        print(f"Error closing UDP socket: {e}")
    
    print("Cleanup complete")

# Set up signal handlers
signal.signal(signal.SIGINT, signal_handler)   # Ctrl+C
signal.signal(signal.SIGTERM, signal_handler)  # Termination signal

# Global variables to store WebSocket connections for status updates
websocket_clients = set()

# Connection monitoring
last_data_time = time.time()
CONNECTION_TIMEOUT = 5.0  # Consider disconnected after 5 seconds of no data

async def monitor_connection_status():
    """Monitor connection status and update UI when no data is received"""
    global last_data_time
    last_status = False  # Track last status sent to avoid spam
    
    while not shutdown_event.is_set():
        try:
            await asyncio.sleep(2.0)  # Check every 2 seconds instead of 1
            
            # Only monitor if we have active WebSocket clients
            if not websocket_clients:
                print("No WebSocket clients connected, skipping status update")
                await asyncio.sleep(2.0)  # Wait longer when no clients
                if shutdown_event.is_set():
                    break
                continue
            
            # Only update status if it's different from last sent
            current_status = (time.time() - last_data_time) <= CONNECTION_TIMEOUT
            
            if current_status != last_status:
                # Connection status changed (debug output removed)
                await send_status_update(sim_connected=current_status)
                last_status = current_status
            else:
                # Connection status unchanged (debug output removed)
                pass
                
        except Exception as e:
            print(f"Error in connection monitor: {e}")

async def send_status_update(sim_connected=None, file_writing=None):
    """Send status updates to all connected WebSocket clients"""
    if not websocket_clients:
        print("No WebSocket clients to send status update to")
        return
    
    status_data = {"type": "status_update"}
    if sim_connected is not None:
        status_data["sim_connected"] = sim_connected
    if file_writing is not None:
        status_data["file_writing"] = file_writing
    
    # Send to all connected clients
    disconnected_clients = set()
    for websocket in websocket_clients:
        try:
            await websocket.send(json.dumps(status_data))
        except websockets.exceptions.ConnectionClosed:
            disconnected_clients.add(websocket)
        except Exception as e:
            print(f"Error sending status update: {e}")
            disconnected_clients.add(websocket)
    
    # Remove disconnected clients
    websocket_clients.difference_update(disconnected_clients)
    
    # Log if all clients were disconnected
    if disconnected_clients:
        print(f"Removed {len(disconnected_clients)} disconnected WebSocket clients")
        if not websocket_clients:
            print("All WebSocket clients disconnected, stopping status updates")

# Constants for unit conversions (Aerofly uses metric, SimAPI uses imperial)
METERS_TO_FEET = 3.28084      # Convert meters to feet
MPS_TO_KTS = 1.94384          # Convert meters per second to knots
MPS_TO_FPM = 196.85           # Convert meters per second to feet per minute

# SimAPI file paths - SayIntentionsAI reads from a specific location
def get_local_appdata_path():
    # Get the local appdata directory path where SayIntentionsAI expects SimAPI files
    # Cross-platform support for Windows and macOS
    if os.name == 'nt':  # Windows
        return os.path.join(os.environ.get('LOCALAPPDATA', ''), 'SayIntentionsAI')
    else:  # macOS/Linux
        # Use ~/Library/Application Support for macOS
        home = os.path.expanduser('~')
        return os.path.join(home, 'Library', 'Application Support', 'SayIntentionsAI')

def ensure_simapi_dir():
    # Ensure the SayIntentionsAI directory exists in local appdata
    path = get_local_appdata_path()
    os.makedirs(path, exist_ok=True)
    return path

def get_simapi_input_path():
    # Get the path for the simAPI_input.json file that SayIntentionsAI reads
    return os.path.join(get_local_appdata_path(), 'simAPI_input.json')

# Data classes for parsed messages from Aerofly FS4
class XGPSData:
    # Represents GPS/position data from Aerofly FS4
    # Contains position, altitude, track, and ground speed information
    def __init__(self, sim_name, longitude, latitude, alt_msl_meters, track_deg, ground_speed_mps):
        self.sim_name = sim_name
        self.longitude = longitude
        self.latitude = latitude
        self.alt_msl_meters = alt_msl_meters
        self.track_deg = track_deg
        self.ground_speed_mps = ground_speed_mps

class XATTData:
    # Represents attitude data from Aerofly FS4
    # Contains heading, pitch, and roll information
    def __init__(self, sim_name, heading_deg, pitch_deg, roll_deg):
        self.sim_name = sim_name
        self.heading_deg = heading_deg
        self.pitch_deg = pitch_deg
        self.roll_deg = roll_deg

# Global variables to store latest data from Aerofly FS4
latest_xgps = None      # Latest GPS/position data
latest_xatt = None      # Latest attitude data
last_simapi_write = 0   # Timestamp of last SimAPI file write (for rate limiting)
pending_radio_update = None  # Radio state update waiting to be applied

# Radio state from web interface - manages COM1 and COM2 frequencies and power
radio_state = {
    'com1': {
        'active': '118.000',   # Active frequency
        'standby': '118.500',  # Standby frequency
        'power': False         # Radio power state
    },
    'com2': {
        'active': '118.500',
        'standby': '118.000',
        'power': False
    },
    'transponder': {
        'code': '1200',        # Current transponder code
        'power': False         # Transponder power state
    }
}

# Set up UDP socket to receive telemetry data from Aerofly FS4
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)  # Allow reuse of address
sock.bind(('', UDP_PORT))  # Bind to all interfaces
sock.setblocking(False)    # Non-blocking mode for async operation

print(f"UDP server listening on port {UDP_PORT}")
print(f"WebSocket server will run on port {WS_PORT}")

async def write_simapi_file():
    # Write the SimAPI input file with current flight data
    #
    # This function converts Aerofly FS4 data to the SimAPI format that SayIntentionsAI expects.
    # It includes position, attitude, radio state, and other required variables.
    # Rate limited to prevent excessive file writes.
    global latest_xgps, latest_xatt, last_simapi_write, radio_state
    
    # Only write if we have WebSocket clients connected and data available
    if not websocket_clients or not latest_xgps or time.time() - last_simapi_write < 0.75:
        return
    
    try:
        # Send file writing status update
        await send_status_update(file_writing=True)
        
        # Ensure directory exists
        ensure_simapi_dir()
        
        # Create the data structure with default values
        variables = {
            # Basic SimVars with default values (required by SayIntentionsAI)
            "PLANE LATITUDE": 0.0,
            "PLANE LONGITUDE": 0.0,
            "PLANE ALTITUDE": 0.0,  # In feet
            "GROUND VELOCITY": 0.0,  # In knots
            "PLANE HEADING DEGREES TRUE": 0.0,
            "PLANE PITCH DEGREES": 0.0,
            "PLANE BANK DEGREES": 0.0,
            "VERTICAL SPEED": 0.0,  # In feet per minute
            "AIRSPEED INDICATED": 0.0,  # In knots (estimated from ground speed)
            
            # Radio stack - use values from web interface
            "COM ACTIVE FREQUENCY:1": float(radio_state['com1']['active']),
            "COM STANDBY FREQUENCY:1": float(radio_state['com1']['standby']),
            "COM ACTIVE FREQUENCY:2": float(radio_state['com2']['active']),
            "COM STANDBY FREQUENCY:2": float(radio_state['com2']['standby']),
            "COM TRANSMIT:1": 1 if radio_state['com1']['power'] else 0,
            "COM TRANSMIT:2": 1 if radio_state['com2']['power'] else 0,
            "COM RECEIVE:1": 1 if radio_state['com1']['power'] else 0,
            "COM RECEIVE:2": 1 if radio_state['com2']['power'] else 0,
            "CIRCUIT COM ON:1": 1 if radio_state['com1']['power'] else 0,
            "CIRCUIT COM ON:2": 1 if radio_state['com2']['power'] else 0,
            "NAV ACTIVE FREQUENCY:1": 110.0,
            "NAV STANDBY FREQUENCY:1": 110.5,
            "NAV ACTIVE FREQUENCY:2": 111.0,
            "NAV STANDBY FREQUENCY:2": 111.5,
            "TRANSPONDER CODE:1": int(radio_state['transponder']['code']),
            "TRANSPONDER STATE:1": 4 if radio_state['transponder']['power'] else 0,
            
            # Other required variables for SayIntentionsAI
            "ATC ID": "N250VB",
            "PLANE ALT ABOVE GROUND": 0.0,  # AGL in feet
            "SIM ON GROUND": 1  # 1 for on ground, 0 for in air
        }
        
        # Update with XGPS data (position, altitude, speed, track)
        if latest_xgps:
            variables.update({
                "PLANE LATITUDE": latest_xgps.latitude,
                "PLANE LONGITUDE": latest_xgps.longitude,
                "PLANE ALTITUDE": latest_xgps.alt_msl_meters * METERS_TO_FEET,  # Convert to feet
                "GROUND VELOCITY": latest_xgps.ground_speed_mps * MPS_TO_KTS,   # Convert to knots
                "PLANE HEADING DEGREES TRUE": latest_xgps.track_deg % 360.0,    # Normalize to 0-360
                "AIRSPEED INDICATED": latest_xgps.ground_speed_mps * MPS_TO_KTS, # Estimate from ground speed
                
                # Determine if on ground based on altitude and speed
                "SIM ON GROUND": 1 if (latest_xgps.alt_msl_meters < 10 and latest_xgps.ground_speed_mps < 1) else 0,
                
                # Estimate AGL (crude approximation - subtract 50 feet for ground level)
                "PLANE ALT ABOVE GROUND": max(0, (latest_xgps.alt_msl_meters * METERS_TO_FEET) - 50)
            })
        
        # Update with XATT data (heading, pitch, roll)
        if latest_xatt:
            variables.update({
                "PLANE HEADING DEGREES TRUE": latest_xatt.heading_deg % 360.0,  # Normalize to 0-360
                "PLANE PITCH DEGREES": latest_xatt.pitch_deg,
                "PLANE BANK DEGREES": latest_xatt.roll_deg
            })
            
            # Estimate vertical speed from pitch angle and ground speed
            if latest_xgps:
                pitch_radians = latest_xatt.pitch_deg * (3.14159 / 180.0)  # Convert to radians
                vertical_component = latest_xgps.ground_speed_mps * max(-1, min(1, pitch_radians))  # Clamp to reasonable range
                variables["VERTICAL SPEED"] = vertical_component * MPS_TO_FPM  # Convert to feet per minute
        
        # Create the complete SimAPI structure expected by SayIntentionsAI
        simapi_data = {
            "sim": {
                "variables": variables,
                "exe": "aerofly_fs_4.exe",
                "simapi_version": "1.0",
                "name": "AeroflyFS4",
                "version": "7.0.0",
                "adapter_version": "1.0.0"
            }
        }
        
        # Write to file using atomic update to prevent corruption
        input_file_path = get_simapi_input_path()
        temp_path = f"{input_file_path}.tmp"
        
        # Write to temporary file first
        with open(temp_path, 'w') as f:
            json.dump(simapi_data, f, indent=2)
        
        # Atomic update on Windows (replace old file with new one)
        if os.path.exists(input_file_path):
            os.remove(input_file_path)
        os.rename(temp_path, input_file_path)
        
        last_simapi_write = time.time()
        
        # Send file writing complete status update
        await send_status_update(file_writing=False)
        
    except Exception as e:
        print(f"Error writing SimAPI file: {e}")
        # Send error status
        await send_status_update(file_writing=False)

async def broadcast(websocket):
    # Main broadcast function that handles UDP data reception and WebSocket streaming
    #
    # This function:
    # 1. Receives UDP telemetry data from Aerofly FS4
    # 2. Parses different message types (XGPS, XATT, radio updates)
    # 3. Sends position data to WebSocket clients for moving map
    # 4. Triggers SimAPI file updates
    # 5. Handles radio state updates from web interface
    global latest_xgps, latest_xatt, radio_state, pending_radio_update, last_data_time
    print(f"Client connected")
    
    # Update connection status based on whether we've received data recently
    sim_connected = (time.time() - last_data_time) <= CONNECTION_TIMEOUT
    print(f"WebSocket client connected - initial sim status: {sim_connected} (last data: {time.time() - last_data_time:.1f}s ago)")
    await send_status_update(sim_connected=sim_connected)
    
    try:
        while not shutdown_event.is_set():
            try:
                # Check if we should shutdown before processing UDP data
                if shutdown_event.is_set():
                    print("Shutdown signal received, stopping UDP processing")
                    break
                
                # Receive UDP data from Aerofly FS4
                data, addr = sock.recvfrom(1024)
                line = data.decode().strip()
                # UDP data received (debug output removed to reduce console clutter)
                

                # Parse different message types from Aerofly FS4
                if line.startswith("XGPSAerofly"):
                    # Format: XGPSAerofly FS 4,longitude,latitude,altitude,heading,speed
                    parts = line.split(',')
                    if len(parts) >= 6:
                        sim_name = parts[0].replace("XGPSAerofly ", "").strip()
                        lon = float(parts[1])
                        lat = float(parts[2])
                        alt_msl_meters = float(parts[3])
                        heading = float(parts[4])
                        ground_speed_mps = float(parts[5])
                        
                        # Create XGPSData object to store position data
                        latest_xgps = XGPSData(sim_name, lon, lat, alt_msl_meters, heading, ground_speed_mps)
                        
                        # Only process data if we have WebSocket clients connected
                        if websocket_clients:
                            # Check if this is the first data received (simulator just started)
                            was_disconnected = (time.time() - last_data_time) > CONNECTION_TIMEOUT
                            last_data_time = time.time() # Update last data time
                                                         # Updated last_data_time (debug output removed)
                            
                            # If simulator was disconnected and now sending data, update status immediately
                            if was_disconnected:
                                print(f"Simulator reconnected (XGPS) - sending status update: Connected")
                                await send_status_update(sim_connected=True)
                            
                            # Send position data to WebSocket for moving map display
                            position_data = f"{lat},{lon},{heading}"
                            await websocket.send(position_data)
                            
                            # Apply any pending radio updates when we have position data
                            if pending_radio_update:
                                radio_state = pending_radio_update
                                pending_radio_update = None
                                print("Applied pending radio update")
                            
                            # Write to SimAPI file for SayIntentionsAI
                            await write_simapi_file()
                        else:
                            # No clients connected, just update last_data_time silently
                            last_data_time = time.time()
                            # UDP data received but no clients connected - skipping processing
                        
                elif line.startswith("XATTAerofly"):
                    # Format: XATTAerofly FS 4,heading,pitch,roll
                    parts = line.split(',')
                    if len(parts) >= 4:
                        sim_name = parts[0].replace("XATTAerofly ", "").strip()
                        heading = float(parts[1])
                        pitch = float(parts[2])
                        roll = float(parts[3])
                        
                        # Create XATTData object to store attitude data
                        latest_xatt = XATTData(sim_name, heading, pitch, roll)
                        
                        # Only process data if we have WebSocket clients connected
                        if websocket_clients:
                            # Check if this is the first data received (simulator just started)
                            was_disconnected = (time.time() - last_data_time) > CONNECTION_TIMEOUT
                            last_data_time = time.time() # Update last data time
                                                         # Updated last_data_time (debug output removed)
                            
                            # If simulator was disconnected and now sending data, update status update immediately
                            if was_disconnected:
                                print(f"Simulator reconnected (XATT) - sending status update: Connected")
                                await send_status_update(sim_connected=True)
                            
                            # Write to SimAPI file for SayIntentionsAI
                            await write_simapi_file()
                        else:
                            # No clients connected, just update last_data_time silently
                            last_data_time = time.time()
                            # UDP data received but no clients connected - skipping processing

                # Handle radio updates from web interface (JSON format)
                else:
                    # Try to parse as JSON (radio update from web interface)
                    try:
                        data = json.loads(line)
                        if data.get('type') == 'radio_update':
                            pending_radio_update = data['data'] #store for later
                            # Radio update received (debug output removed)
                        elif data.get('type') == 'sim_data': # New type for SimAPI data
                            # This part is not directly related to the UI status update,
                            # but it's a good place to update last_data_time if we receive SimAPI data.
                            last_data_time = time.time()
                    except json.JSONDecodeError:
                        # Not JSON, send as raw data for debugging
                        await websocket.send(line)
                        
            except BlockingIOError:
                # No UDP data available, sleep briefly before checking again
                if shutdown_event.is_set():
                    break
                await asyncio.sleep(0.1)
                
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")
        # Update connection status
        await send_status_update(sim_connected=False)

async def handler(websocket):
    # WebSocket connection handler
    #
    # This function manages WebSocket connections and handles bidirectional communication:
    # - Receives radio updates from web interface
    # - Streams flight data to web interface
    # - Manages connection lifecycle
    # Add this WebSocket to the clients set
    websocket_clients.add(websocket)
    
    # Handle WebSocket messages in a separate task
    async def handle_websocket_messages():
        try:
            async for message in websocket:
                
                # Try to parse as JSON (radio update from web interface)
                try:
                    data = json.loads(message)
                    if data.get('type') == 'radio_update':
                        global pending_radio_update
                        pending_radio_update = data['data']
                        # Radio update received (debug output removed)
                    elif data.get('type') == 'shutdown':
                        print("  Shutdown request received from web interface")
                        
                        # Execute the batch file to kill this process FIRST
                        print("  Starting batch file execution...")
                        try:
                            import subprocess
                            import os
                            batch_path = os.path.join(os.path.dirname(__file__), '..', 'kill_aerofly_bridge.bat')
                            print(f"  Executing batch file: {batch_path}")
                            
                            # Check if batch file exists
                            if not os.path.exists(batch_path):
                                print(f"  ERROR: Batch file not found at {batch_path}")
                                # Try alternative path
                                alt_path = os.path.join(os.getcwd(), 'kill_aerofly_bridge.bat')
                                print(f"  Trying alternative path: {alt_path}")
                                if os.path.exists(alt_path):
                                    batch_path = alt_path
                                    print(f"  Using alternative path: {batch_path}")
                                else:
                                    print(f"  ERROR: Batch file not found at alternative path either")
                                    raise FileNotFoundError(f"Batch file not found at {batch_path} or {alt_path}")
                            
                            # Execute with better error handling
                            result = subprocess.run([batch_path], shell=True, capture_output=True, text=True)
                            print(f"  Batch file execution result: {result.returncode}")
                            if result.stdout:
                                print(f"  Batch file output: {result.stdout}")
                            if result.stderr:
                                print(f"  Batch file errors: {result.stderr}")
                                
                            if result.returncode == 0:
                                print("  Batch file executed successfully")
                            else:
                                print(f"  Batch file failed with return code: {result.returncode}")
                                
                        except Exception as e:
                            print(f"  Error executing batch file: {e}")
                            import traceback
                            traceback.print_exc()
                        
                        # Send acknowledgment AFTER batch file execution
                        print("  Sending shutdown acknowledgment...")
                        try:
                            await websocket.send(json.dumps({"type": "shutdown_ack"}))
                            print("  Shutdown acknowledgment sent successfully")
                        except Exception as e:
                            print(f"  Error sending shutdown acknowledgment: {e}")
                        
                        # Also trigger shutdown event as backup
                        print("  Setting shutdown event...")
                        shutdown_event.set()
                        print("  Shutdown event set, returning from handler")
                        return
                except json.JSONDecodeError:
                    print(f"  DEBUG: Not JSON, raw message: {message}")
        except websockets.exceptions.ConnectionClosed:
            print(" WebSocket connection closed")
        finally:
            # Remove this WebSocket from the clients set
            websocket_clients.discard(websocket)
            print(f"WebSocket client removed. Total clients: {len(websocket_clients)}")
            
            # If no more clients, stop monitoring connection status
            if not websocket_clients:
                print("All WebSocket clients disconnected. Connection monitoring will pause until new clients connect.")
    
    # Run both UDP broadcast and WebSocket message handling concurrently
    await asyncio.gather(
        broadcast(websocket),
        handle_websocket_messages()
    )

async def main():
    # Main function that starts the WebSocket server
    #
    # This function:
    # 1. Starts the WebSocket server on the specified port
    # 2. Handles incoming WebSocket connections
    # 3. Runs indefinitely until interrupted
    print(f"  WebSocket server running on ws://localhost:{WS_PORT}")
    print(f"  Listening on UDP {UDP_PORT} and streaming to WebSocket")
    print(f"  SimAPI file will be written to: {get_simapi_input_path()}")
    
    async with websockets.serve(handler, "0.0.0.0", WS_PORT):  # Listen on all interfaces
        # Start the connection monitoring task
        monitor_task = asyncio.create_task(monitor_connection_status())
        
        # Don't send initial status until a client connects
        # Status will be sent when the first WebSocket client connects
        
        # Wait for shutdown signal
        await shutdown_event.wait()
        print("Shutdown signal received, cleaning up...")
        # Cancel the monitoring task
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass
        cleanup()
        print("Server shutdown complete")

if __name__ == "__main__":
    # Start the async event loop and run the main function
    asyncio.run(main())
