// Aerofly FS4 Web Interface - Main JavaScript File
//
// This file provides the frontend functionality for the Aerofly FS4 to SayIntentionsAI bridge.
// It includes radio management, moving map display, route planning, and real-time aircraft tracking.
//
// Key Features:
// - Radio frequency management (COM1/COM2)
// - Interactive moving map with airport data
// - Route planning between airports
// - Real-time aircraft position tracking
// - WebSocket communication with Python backend

// Radio state management - stores current frequencies and power states for COM1 and COM2
const radioState = {
  com1: {
    active: '118.000',    // Currently active frequency
    standby: '118.500',   // Standby frequency ready to swap
    power: false          // Radio power state (on/off)
  },
  com2: {
    active: '118.500',
    standby: '118.000',
    power: false
  }
};



// COM toggle function - handle COM1/COM2 power state
function toggleCom(com) {
  const checkbox = document.getElementById(com + '-toggle');
  radioState[com].power = checkbox.checked;
  
  // Update display based on power state
  const activeDisplay = document.getElementById(com + '-active');
  const standbyDisplay = document.getElementById(com + '-standby');
  const swapButton = activeDisplay.parentElement.querySelector('.swap-button');
  
  if (radioState[com].power) {
    // COM is ON
    activeDisplay.style.opacity = '1';
    standbyDisplay.style.opacity = '1';
    swapButton.disabled = false;
  } else {
    // COM is OFF
    activeDisplay.style.opacity = '0.5';
    standbyDisplay.style.opacity = '0.5';
    swapButton.disabled = true;
  }
  
  updateSimAPI();
}

// Airport frequency panel functions
function showAirportFrequencies(airport) {
  const panel = document.getElementById('airport-frequency-panel');
  const title = document.getElementById('airport-panel-title');
  const frequencyList = document.getElementById('frequency-list');
  
  // Set panel title and add SkyVector link
  title.innerHTML = `
    <div>${airport.icao} - ${airport.name}</div>
    <div style="margin-top: 5px; font-size: 12px;">
      <a href="${createSkyVectorUrl(airport)}" target="_blank" style="color: white; text-decoration: underline;">
        📍 View on SkyVector
      </a>
    </div>
  `;
  
  // Clear existing frequencies
  frequencyList.innerHTML = '';
  
  // Note: We no longer hide airspace rings from previous airports
  // Each airport's rings remain visible until their checkbox is unchecked
  
  // Add frequencies to panel
  if (airport.freq && airport.freq.length > 0) {
    airport.freq.forEach(freq => {
      const frequencyItem = document.createElement('div');
      frequencyItem.className = 'frequency-item';
      
      frequencyItem.innerHTML = `
        <div class="frequency-info">
          <div class="frequency-description">${freq.description}</div>
          <div class="frequency-value">${freq.frequency_mhz} MHz</div>
        </div>
        <div class="frequency-links">
          <button class="frequency-link" onclick="setFrequency('com1', '${freq.frequency_mhz}')">COM1</button>
          <button class="frequency-link" onclick="setFrequency('com2', '${freq.frequency_mhz}')">COM2</button>
        </div>
      `;
      
      frequencyList.appendChild(frequencyItem);
    });
  } else {
    // No frequencies available
    const noFreqItem = document.createElement('div');
    noFreqItem.className = 'frequency-item';
    noFreqItem.innerHTML = '<div class="frequency-info"><div class="frequency-description">No frequencies available</div></div>';
    frequencyList.appendChild(noFreqItem);
  }
  
  // Add route action buttons
  addRouteActionsToPanel(airport);
  
  // Show the panel
  panel.style.display = 'block';
}

function closeAirportPanel() {
  const panel = document.getElementById('airport-frequency-panel');
  panel.style.display = 'none';
  
  // Note: We no longer hide airspace rings when panel is closed
  // Each airport's rings remain visible until their checkbox is unchecked
}

function setFrequency(com, frequency) {
  // Set as standby frequency regardless of power state
  radioState[com].standby = frequency;
  updateDisplay(com);
  updateSimAPI();
}

// Radio functions - handle frequency management and radio operations

// Swap active and standby frequencies for a given radio
function swapFrequencies(com) {
  // Only swap if COM is powered on
  if (!radioState[com].power) {
    return;
  }
  
  const temp = radioState[com].active;
  radioState[com].active = radioState[com].standby;
  radioState[com].standby = temp;
  updateDisplay(com);
  updateSimAPI();
}



// Update the radio display with current active and standby frequencies
function updateDisplay(com) {
  const activeDisplay = document.getElementById(com + '-active');
  const standbyDisplay = document.getElementById(com + '-standby');
  activeDisplay.textContent = radioState[com].active;
  standbyDisplay.textContent = radioState[com].standby;
}

// Send radio state updates to the Python backend via WebSocket
function updateSimAPI() {
  console.log('📡 Sending radio update:', radioState);
  // Send radio state to the WebSocket server to update the JSON file
  if (window.radioWebSocket && window.radioWebSocket.readyState === WebSocket.OPEN) {
    window.radioWebSocket.send(JSON.stringify({
      type: 'radio_update',
      data: radioState
    }));
  }
}

// Initialize radio displays
updateDisplay('com1');
updateDisplay('com2');

// Map functionality - Leaflet.js map setup and management

// Initialize the map centered on Ann Arbor, MI with zoom level 12
const map = L.map('map').setView([42.2451, -83.5354], 12);

// Default tile layer (OpenStreetMap)
let currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Map tile switching function - allows users to change map styles
function changeMapTile() {
  const selectedTile = document.querySelector('input[name="map-tile"]:checked').value;
  
  // Remove current tile layer
  if (currentTileLayer) {
    map.removeLayer(currentTileLayer);
  }
  
  // Add new tile layer based on user selection
  switch(selectedTile) {
    case 'OpenStreetMap':
      currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      break;
    case 'OpenTopoMap':
      currentTileLayer = L.tileLayer.provider('OpenTopoMap').addTo(map);
      break;
    case 'Esri.WorldImagery':
      currentTileLayer = L.tileLayer.provider('Esri.WorldImagery').addTo(map);
      break;
    default:
      currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
  }
}

// Function to create SkyVector search URL from airport name
// Provides direct links to SkyVector for flight planning
function createSkyVectorUrl(airport) {
  // Check if airport.link exists and is not "unavailable"
  if (airport.link && airport.link.trim().toLowerCase() !== "unavailable") {
    return airport.link;
  } else {
    // Fallback to search by airport name
    const encodedName = encodeURIComponent(airport.name || "");
    return `https://skyvector.com/search/site/${encodedName}`;
  }
}

// Global variables for airport management and route planning
let allAirportMarkers = [];        // Array to store all airport markers for visibility control
let routeLine = null;              // Current route line on the map
let routeMarkers = [];             // Markers for route endpoints
let selectedFromAirport = null;    // Currently selected "FROM" airport
let selectedToAirport = null;      // Currently selected "TO" airport
let allAirportsData = [];          // Store airport data in memory for route planning
let isDirectToMode = false;        // Track if we're in direct-to mode (from current position)
let currentAircraftPosition = null; // Store current aircraft position for direct-to calculations

// Load and display airports from JSON data file
fetch('data/all_airports.json?cacheBust=' + Date.now())
.then(response => response.json())
.then(airports => {
  // Store airport data in memory for route planning
  allAirportsData = airports;
  
  airports.forEach(airport => {
    // Choose icon based on airport type
    let iconHtml = '🏢'; // Default airport icon
    if (airport.type === 'Heliport') {
      iconHtml = '🚁'; // Heliport icon
    }
    
    // Create custom airport icon
    const airportIcon = L.divIcon({
      html: iconHtml,
      className: 'airport-icon',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    // Create airport marker and add to map
    const marker = L.marker([airport.lat, airport.lon], { icon: airportIcon })
      .addTo(map)
      .on('click', () => {
        // Show airport frequencies in panel instead of popup
        showAirportFrequencies(airport);
      });
    
    // Store marker reference for visibility control
    allAirportMarkers.push(marker);
  });
})
.catch(error => console.error('Error loading airports:', error));

// Function to toggle airport visibility on/off
function toggleAirports() {
  const checkbox = document.getElementById('airport-toggle');
  const isVisible = checkbox.checked;
  
  allAirportMarkers.forEach(marker => {
    if (isVisible) {
      marker.addTo(map);
    } else {
      marker.remove();
    }
  });
}

// Function to toggle aircraft following mode
function toggleAircraftFollow() {
  const checkbox = document.getElementById('aircraft-follow-toggle');
  window.followAircraft = checkbox.checked;
}

// Function to set airport as FROM destination
function setAsFrom(icao) {
  selectedFromAirport = icao;
  document.getElementById('route-from-display').textContent = icao;
  document.getElementById('route-from-display').classList.add('filled');
  updateRouteButton();
}

// Function to set airport as TO destination
function setAsTo(icao) {
  selectedToAirport = icao;
  document.getElementById('route-to-display').textContent = icao;
  document.getElementById('route-to-display').classList.add('filled');
  updateRouteButton();
}

// Function to set direct-to airport from current aircraft position
function directToAirport(icao) {
  if (!currentAircraftPosition) {
    alert('Aircraft position not available. Please wait for position data.');
    return;
  }
  
  // Clear any existing route
  clearRoute();
  
  // Set direct-to mode
  isDirectToMode = true;
  selectedToAirport = icao;
  
  // Find the airport data
  const toAirport = allAirportsData.find(a => a.icao === icao);
  if (!toAirport) {
    alert(`Airport ${icao} not found`);
    return;
  }
  
  // Update route planner display
  document.getElementById('route-from-display').textContent = 'Current Position';
  document.getElementById('route-from-display').classList.add('filled');
  document.getElementById('route-to-display').textContent = icao;
  document.getElementById('route-to-display').classList.add('filled');
  
  // Calculate bearing and distance from current position to airport
  const bearing = calculateBearing(currentAircraftPosition.lat, currentAircraftPosition.lon, toAirport.lat, toAirport.lon);
  const distance = calculateDistance(currentAircraftPosition.lat, currentAircraftPosition.lon, toAirport.lat, toAirport.lon);
  
  // Create route line from current position to airport
  routeLine = L.polyline([
    [currentAircraftPosition.lat, currentAircraftPosition.lon],
    [toAirport.lat, toAirport.lon]
  ], {
    color: 'blue',
    weight: 3,
    opacity: 0.8,
    dashArray: '10, 5'
  }).addTo(map);
  
  // Display route info
  document.getElementById('route-bearing').textContent = `${bearing.toFixed(1)}°`;
  document.getElementById('route-distance').textContent = `${distance.toFixed(1)} nm`;
  document.getElementById('route-info').style.display = 'block';
  
  // Create route endpoint markers
  const routeIcon = L.divIcon({
    html: '📍',
    className: 'route-marker',
    iconSize: [25, 25],
    iconAnchor: [12, 25]
  });
  
  const fromMarker = L.marker([currentAircraftPosition.lat, currentAircraftPosition.lon], { icon: routeIcon })
    .addTo(map)
    .bindPopup(`<b>Current Position</b><br>FROM`);
    
  const toMarker = L.marker([toAirport.lat, toAirport.lon], { icon: routeIcon })
    .addTo(map)
    .bindPopup(`<b>${toAirport.icao}</b><br>${toAirport.name}<br><b>TO</b>`);
  
  routeMarkers.push(fromMarker, toMarker);
  
  // Fit map to show both points
  map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
}

// Function to update route button state (enabled/disabled)
function updateRouteButton() {
  const routeButton = document.getElementById('route-button');
  if (selectedFromAirport && selectedToAirport) {
    routeButton.disabled = false;
  } else {
    routeButton.disabled = true;
  }
}

// Function to draw route between two airports
function drawRoute() {
  if (!selectedFromAirport || !selectedToAirport) {
    alert('Please select both FROM and TO airports');
    return;
  }
  
  // Store airport values before clearing
  const fromIcao = selectedFromAirport;
  const toIcao = selectedToAirport;
  
  // Clear previous route line and markers only (don't clear airport selections)
  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }
  
  // Remove route markers
  routeMarkers.forEach(marker => {
    map.removeLayer(marker);
  });
  routeMarkers = [];
  
  // Hide route info
  document.getElementById('route-info').style.display = 'none';
  
  // Restore the selected airports
  selectedFromAirport = fromIcao;
  selectedToAirport = toIcao;
  
  // Find airports in the stored data
  const fromAirport = allAirportsData.find(a => a.icao === fromIcao);
  const toAirport = allAirportsData.find(a => a.icao === toIcao);
  
  if (!fromAirport) {
    alert(`Airport ${fromIcao} not found`);
    return;
  }
  
  if (!toAirport) {
    alert(`Airport ${toIcao} not found`);
    return;
  }
  
  // Restore the ICAO codes in the display fields
  document.getElementById('route-from-display').textContent = fromIcao;
  document.getElementById('route-from-display').classList.add('filled');
  document.getElementById('route-to-display').textContent = toIcao;
  document.getElementById('route-to-display').classList.add('filled');
 
  // Calculate bearing and distance between airports
  const bearing = calculateBearing(fromAirport.lat, fromAirport.lon, toAirport.lat, toAirport.lon);
  const distance = calculateDistance(fromAirport.lat, fromAirport.lon, toAirport.lat, toAirport.lon);
  
  // Create route line on map
  routeLine = L.polyline([
    [fromAirport.lat, fromAirport.lon],
    [toAirport.lat, toAirport.lon]
  ], {
    color: 'red',
    weight: 3,
    opacity: 0.8,
    dashArray: '10, 5'
  }).addTo(map);
  
  // Display route info in the interface
  document.getElementById('route-bearing').textContent = `${bearing.toFixed(1)}°`;
  document.getElementById('route-distance').textContent = `${distance.toFixed(1)} nm`;
  document.getElementById('route-info').style.display = 'block';

  // Create route endpoint markers
  const routeIcon = L.divIcon({
    html: '📍',
    className: 'route-marker',
    iconSize: [25, 25],
    iconAnchor: [12, 25]
  });
  
  const fromMarker = L.marker([fromAirport.lat, fromAirport.lon], { icon: routeIcon })
    .addTo(map)
    .bindPopup(`<b>${fromAirport.icao}</b><br>${fromAirport.name}<br><b>FROM</b>`);
    
  const toMarker = L.marker([toAirport.lat, toAirport.lon], { icon: routeIcon })
    .addTo(map)
    .bindPopup(`<b>${toAirport.icao}</b><br>${toAirport.name}<br><b>TO</b>`);
  
  routeMarkers.push(fromMarker, toMarker);
  
  // Fit map to show both airports
  map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
}

// Function to calculate bearing between two points using great circle navigation
function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  
  const dLon = (lon2 - lon1) * toRad;
  const lat1Rad = lat1 * toRad;
  const lat2Rad = lat2 * toRad;
  
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  
  let bearing = Math.atan2(y, x) * toDeg;
  bearing = (bearing + 360) % 360; // Normalize to 0-360 degrees
  
  return bearing;
}

// Function to calculate distance between two points in nautical miles using great circle formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const R = 3440.065; // Earth's radius in nautical miles
  
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
}

// Function to clear current route and reset all route-related displays
function clearRoute() {
  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }
  
  // Remove route markers
  routeMarkers.forEach(marker => {
    map.removeLayer(marker);
  });
  routeMarkers = [];
  
  // Clear selected airports
  selectedFromAirport = null;
  selectedToAirport = null;
  
  // Reset direct-to mode
  isDirectToMode = false;
  
  // Reset display fields
  document.getElementById('route-from-display').textContent = 'Click airport';
  document.getElementById('route-from-display').classList.remove('filled');
  document.getElementById('route-to-display').textContent = 'Click airport';
  document.getElementById('route-to-display').classList.remove('filled');
  
  // Hide route info
  document.getElementById('route-info').style.display = 'none';
  
  // Disable route button
  updateRouteButton();
}

// Add route action buttons to airport frequency panel
function addRouteActionsToPanel(airport) {
  const frequencyList = document.getElementById('frequency-list');
  
  // Add route action buttons
  const routeActions = document.createElement('div');
  routeActions.className = 'frequency-item';
  routeActions.style.borderTop = '2px solid #007bff';
  routeActions.style.marginTop = '10px';
  routeActions.style.paddingTop = '10px';
  
  // Check if this airport already has airspace rings visible
  const hasRings = hasAirspaceRings(airport.icao);
  
  routeActions.innerHTML = `
    <div class="frequency-info">
      <div class="frequency-description">Route Actions</div>
    </div>
    <div class="frequency-links">
      <button class="frequency-link" onclick="setAsFrom('${airport.icao}')" style="background-color: #28a745;">FROM</button>
      <button class="frequency-link" onclick="setAsTo('${airport.icao}')" style="background-color: #007bff;">TO</button>
      <button class="frequency-link" onclick="directToAirport('${airport.icao}')" style="background-color: #fd7e14;">Direct</button>
      <label class="airspace-checkbox-label">
        <input type="checkbox" id="airspace-checkbox" onchange="toggleAirspaceRings('${airport.icao}')" ${hasRings ? 'checked' : ''}>
        <span>Airspace</span>
      </label>
    </div>
  `;
  
  frequencyList.appendChild(routeActions);
}

// Aircraft tracking and WebSocket communication

// Create a custom aircraft icon for the moving map
const aircraftIcon = L.divIcon({
  html: '✈️',
  className: 'aircraft-icon',
  iconSize: [15, 15],
  iconAnchor: [7.5, 7.5]
});

let marker = null; // Aircraft marker on the map

// Global variables for airspace rings - now supports multiple airports
let airspaceRings = new Map(); // Map of airport ICAO to their rings

// Function to toggle airspace rings around an airport
function toggleAirspaceRings(icao) {
  const checkbox = document.getElementById('airspace-checkbox');
  
  if (checkbox.checked) {
    // Show airspace rings for this specific airport
    showAirspaceRings(icao);
  } else {
    // Hide airspace rings for this specific airport
    hideAirspaceRings(icao);
  }
}

// Function to show airspace rings
function showAirspaceRings(icao) {
  // Find the airport data
  const airport = allAirportsData.find(a => a.icao === icao);
  if (!airport) return;
  
  // Convert nautical miles to meters (1 nm = 1852 meters)
  const fiveNMMeters = 5 * 1852;
  const tenNMMeters = 10 * 1852;
  
  // Create 5nm ring (green)
  const fiveNMRing = L.circle([airport.lat, airport.lon], {
    radius: fiveNMMeters,
    color: '#28a745',
    fillColor: '#28a745',
    fillOpacity: 0.1,
    weight: 2
  }).addTo(map);
  
  // Create 10nm ring (blue)
  const tenNMRing = L.circle([airport.lat, airport.lon], {
    radius: tenNMMeters,
    color: '#007bff',
    fillColor: '#007bff',
    fillOpacity: 0.1,
    weight: 2
  }).addTo(map);
  
  // Store references to rings for this specific airport
  airspaceRings.set(icao, {
    fiveNM: fiveNMRing,
    tenNM: tenNMRing
  });
}

// Function to hide airspace rings for a specific airport
function hideAirspaceRings(icao) {
  const rings = airspaceRings.get(icao);
  if (rings) {
    if (rings.fiveNM) {
      map.removeLayer(rings.fiveNM);
    }
    if (rings.tenNM) {
      map.removeLayer(rings.tenNM);
    }
    airspaceRings.delete(icao);
  }
}

// Function to check if an airport has airspace rings visible
function hasAirspaceRings(icao) {
  return airspaceRings.has(icao);
}

// Function to clear all airspace rings (for cleanup)
function clearAllAirspaceRings() {
  airspaceRings.forEach((rings, icao) => {
    hideAirspaceRings(icao);
  });
}

// Function to establish WebSocket connection with Python backend
function connectWebSocket() {
  const socket = new WebSocket("ws://localhost:8765");

  //If you want to run this program on a tablet comment out the line above and uncomment the line below that reads:
  //const socket = new WebSocket("ws://enter your computer local network ip address here:8765")

  // Then enter your local computer network ip address where it reads enter your computer local network ip address here.
  // For example, if your local network ip address is 192.168.1.100, you would enter:
  // const socket = new WebSocket("ws://192.168.1.100:8765")

  // You can find your local network ip address by opening a command dialog box and entering ipconfig.  The output will look like this:
  // 192.168.1.100
  // 192.168.1.101
  // 192.168.1.102
  // 192.168.1.103
  // 192.168.1.104
  // 192.168.1.105
  
  //const socket = new WebSocket("ws://enter your computer local network ip address here:8765")
  window.radioWebSocket = socket; // Make it globally accessible for radio updates

  socket.onopen = () => {
    console.log("  Connected to WebSocket");
  };

  socket.onmessage = (event) => {
    // Handle position data from Aerofly FS4 (format: "lat,lon,heading")
    const [lat, lon, heading] = event.data.split(',').map(Number);
    
    // Store current aircraft position for direct-to functionality
    currentAircraftPosition = { lat, lon };
    
    // Create aircraft marker if it doesn't exist
    if (!marker) {
      marker = L.marker([lat, lon], {icon: aircraftIcon}).addTo(map);
      marker.setZIndexOffset(1000); // Ensure aircraft appears above other markers
    } else {
      // Update existing marker position
      marker.setLatLng([lat, lon]);
    }

    // Rotate aircraft icon based on heading
    if (marker && heading !== undefined) {
      let rotation = heading - 50; // Adjust for icon orientation
      if (rotation < 0) {
        rotation += 360;
      }
      
      marker.setRotationAngle(rotation);
    }

    // Update direct-to line and route info if in direct-to mode
    if (isDirectToMode && selectedToAirport && currentAircraftPosition) {
      const toAirport = allAirportsData.find(a => a.icao === selectedToAirport);
      if (toAirport && routeLine) {
        // Update the route line to current position
        routeLine.setLatLngs([
          [currentAircraftPosition.lat, currentAircraftPosition.lon],
          [toAirport.lat, toAirport.lon]
        ]);
        
        // Recalculate and update bearing and distance
        const bearing = calculateBearing(currentAircraftPosition.lat, currentAircraftPosition.lon, toAirport.lat, toAirport.lon);
        const distance = calculateDistance(currentAircraftPosition.lat, currentAircraftPosition.lon, toAirport.lat, toAirport.lon);
        
        // Update route box display
        document.getElementById('route-bearing').textContent = `${bearing.toFixed(1)}°`;
        document.getElementById('route-distance').textContent = `${distance.toFixed(1)} nm`;
      }
    }

    // Only center map on aircraft if follow mode is enabled
    if (window.followAircraft !== false) {
      map.setView([lat, lon]);
    }
  };

  socket.onclose = () => {
    console.warn("⚠️ WebSocket connection closed. Reconnecting in 2 seconds...");
    setTimeout(connectWebSocket, 2000); // Auto-reconnect after 2 seconds
  };

  socket.onerror = (err) => {
    console.error("WebSocket error", err);
    socket.close();
  };
}

// Initialize aircraft follow setting (default: enabled)
window.followAircraft = true;

// Search functionality
function searchAirport() {
  const searchInput = document.getElementById('airport-search');
  const icao = searchInput.value.trim().toUpperCase();
  
  if (!icao) {
    alert('Please enter an airport ICAO code');
    return;
  }
  
  // Search for airport in the loaded data
  const airport = allAirportsData.find(a => a.icao === icao);
  
  if (airport) {
    // Found the airport - center map on it
    map.setView([airport.lat, airport.lon], 12);
    
    // Uncheck follow aircraft to prevent returning to aircraft position
    const followCheckbox = document.getElementById('aircraft-follow-toggle');
    if (followCheckbox.checked) {
      followCheckbox.checked = false;
      toggleAircraftFollow();
    }
    
    // Clear the search input
    searchInput.value = '';
    
    // Hide VR keyboard if it's open
    hideVRKeyboard();
    
    console.log(`Found airport: ${airport.icao} - ${airport.name}`);
  } else {
    // Airport not found - keep keyboard open, clear field, and focus
    alert('Airport not found');
    searchInput.value = '';
    searchInput.focus();
    // Don't hide the keyboard - let user try again
  }
}

function clearSearch() {
  const searchInput = document.getElementById('airport-search');
  searchInput.value = '';
  hideVRKeyboard();
}

// VR Keyboard functionality
let vrKeyboardVisible = false;

function showVRKeyboard() {
  const keyboard = document.getElementById('vr-keyboard');
  const keyboardGrid = document.getElementById('keyboard-grid');
  
  // Generate keyboard keys if not already done
  if (keyboardGrid.children.length === 0) {
    generateKeyboardKeys();
  }
  
  keyboard.style.display = 'block';
  vrKeyboardVisible = true;
}

function hideVRKeyboard() {
  const keyboard = document.getElementById('vr-keyboard');
  keyboard.style.display = 'none';
  vrKeyboardVisible = false;
}

function generateKeyboardKeys() {
  const keyboardGrid = document.getElementById('keyboard-grid');
  
  // Define the keys for ICAO codes and frequencies (letters, numbers, and period)
  const keys = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
    'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3',
    '4', '5', '6', '7', '8', '9', '.'
  ];
  
  // Clear existing keys
  keyboardGrid.innerHTML = '';
  
  // Create key elements
  keys.forEach(key => {
    const keyElement = document.createElement('div');
    keyElement.className = 'keyboard-key';
    keyElement.textContent = key;
    keyElement.onclick = () => typeKey(key);
    keyboardGrid.appendChild(keyElement);
  });
  
  // Add backspace key
  const backspaceKey = document.createElement('div');
  backspaceKey.className = 'keyboard-key backspace';
  backspaceKey.textContent = '⌫';
  backspaceKey.onclick = () => backspace();
  keyboardGrid.appendChild(backspaceKey);

  // Add COM 1 button
  const com1Key = document.createElement('div');
  com1Key.className = 'keyboard-key com-button';
  com1Key.textContent = 'com 1';
  com1Key.onclick = () => setComFrequency('com1');
  keyboardGrid.appendChild(com1Key);
  
  // Add COM 2 button
  const com2Key = document.createElement('div');
  com2Key.className = 'keyboard-key com-button';
  com2Key.textContent = 'com 2';
  com2Key.onclick = () => setComFrequency('com2');
  keyboardGrid.appendChild(com2Key);
  
  
}

function typeKey(key) {
  const searchInput = document.getElementById('airport-search');
  const currentValue = searchInput.value;
  
  // Allow up to 7 characters for frequencies (e.g., 118.500)
  if (currentValue.length < 7) {
    searchInput.value = currentValue + key;
  }
}

function backspace() {
  const searchInput = document.getElementById('airport-search');
  const currentValue = searchInput.value;
  
  if (currentValue.length > 0) {
    searchInput.value = currentValue.slice(0, -1);
  }
}

function setComFrequency(com) {
  const searchInput = document.getElementById('airport-search');
  const frequency = searchInput.value.trim();
  
  if (!frequency) {
    alert('Please enter a frequency first');
    return;
  }
  
  // Set the frequency as standby for the specified COM
  radioState[com].standby = frequency;
  updateDisplay(com);
  
  // Clear the input and keep focus
  searchInput.value = '';
  searchInput.focus();
  
  console.log(`Set ${com} standby frequency to ${frequency}`);
}

// Close keyboard when clicking outside
document.addEventListener('click', function(event) {
  const keyboard = document.getElementById('vr-keyboard');
  const searchInput = document.getElementById('airport-search');
  
  if (vrKeyboardVisible && 
      !keyboard.contains(event.target) && 
      !searchInput.contains(event.target)) {
    hideVRKeyboard();
  }
});

// Close keyboard when pressing Enter or Escape
document.addEventListener('keydown', function(event) {
  if (vrKeyboardVisible) {
    if (event.key === 'Enter' || event.key === 'Escape') {
      hideVRKeyboard();
    }
  }
});

// Start WebSocket connection
connectWebSocket();