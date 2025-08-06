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

// Frequency input state - manages the digit-by-digit frequency entry system
const freqInput = {
  com1: {
    currentPos: 0,                    // Current cursor position (0-5)
    digits: ['1', '1', '8', '0', '0', '0']  // Individual frequency digits
  },
  com2: {
    currentPos: 0,
    digits: ['1', '1', '8', '5', '0', '0']
  }
};

// Page navigation system - handles switching between different interface pages
function showPage(pageName) {
  // Hide all pages first
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  // Show the selected page
  document.getElementById(pageName + '-page').classList.add('active');
  
  // Update navigation button states
  document.querySelectorAll('.nav-button').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // Show/hide map controls based on current page
  const mapControls = document.getElementById('map-controls');
  if (pageName === 'map') {
    mapControls.classList.add('active');
    // Restore route display if airports are selected (even without a drawn route)
    if (selectedFromAirport && selectedToAirport) {
      document.getElementById('route-from-display').textContent = selectedFromAirport;
      document.getElementById('route-from-display').classList.add('filled');
      document.getElementById('route-to-display').textContent = selectedToAirport;
      document.getElementById('route-to-display').classList.add('filled');
      
      // Show route info if route is actually drawn
      if (routeLine) {
        document.getElementById('route-info').style.display = 'block';
      }
      updateRouteButton();
    }
  } else {
    mapControls.classList.remove('active');
  }
}

// Radio functions - handle frequency management and radio operations

// Swap active and standby frequencies for a given radio
function swapFrequencies(com) {
  const temp = radioState[com].active;
  radioState[com].active = radioState[com].standby;
  radioState[com].standby = temp;
  updateDisplay(com);
  updateSimAPI();
  
}

// Handle digit key presses for frequency entry
function pressKey(com, key) {
  const input = freqInput[com];
  if (input.currentPos < 6) {
    input.digits[input.currentPos] = key;
    input.currentPos++;
    updateFreqInput(com);
  }
}

// Clear frequency input and reset to zeros
function clearFreq(com) {
  const input = freqInput[com];
  input.currentPos = 0;
  input.digits = ['0', '0', '0', '0', '0', '0'];
  updateFreqInput(com);
}

// Enter the current frequency input as the standby frequency
function enterFreq(com) {
  const input = freqInput[com];
  const freq = input.digits.join('');
  const formattedFreq = freq.substring(0, 3) + '.' + freq.substring(3, 6);
  
  // Validate frequency range (118.000 to 137.000 for COM frequencies)
  const freqNum = parseFloat(formattedFreq);
  if (freqNum >= 118.0 && freqNum <= 137.0) {
    radioState[com].standby = formattedFreq;
    updateDisplay(com);
    updateSimAPI();
    
    // Reset input to current standby frequency
    input.currentPos = 0;
    input.digits = formattedFreq.replace('.', '').split('');
    updateFreqInput(com);
  } else {
    // Invalid frequency - reset to current standby
    const currentFreq = radioState[com].standby.replace('.', '');
    input.digits = currentFreq.split('');
    input.currentPos = 0;
    updateFreqInput(com);
  }
}

// Update the frequency input display with current digits and cursor position
function updateFreqInput(com) {
  const input = freqInput[com];
  for (let i = 0; i < 6; i++) {
    const digitElement = document.getElementById(com + '-digit' + (i + 1));
    digitElement.value = input.digits[i] || '0';
    
    // Highlight current cursor position
    if (i === input.currentPos) {
      digitElement.style.backgroundColor = '#fff3cd';
      digitElement.style.borderColor = '#ffc107';
    } else {
      digitElement.style.backgroundColor = '#f8f9fa';
      digitElement.style.borderColor = '#007bff';
    }
  }
}

// Toggle radio power on/off
function togglePower(com) {
  radioState[com].power = !radioState[com].power;
  const button = document.getElementById(com + '-power');
  if (radioState[com].power) {
    button.textContent = 'POWER ON';
    button.classList.add('on');
  } else {
    button.textContent = 'POWER OFF';
    button.classList.remove('on');
  }
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

// Initialize radio displays and inputs on page load
updateDisplay('com1');
updateDisplay('com2');
updateFreqInput('com1');
updateFreqInput('com2');

// Map functionality - Leaflet.js map setup and management

// Initialize the map centered on Ann Arbor, MI with zoom level 12
const map = L.map('map').setView([42.2451, -83.5354], 12);

// Default tile layer (OpenStreetMap)
let currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Map tile switching function - allows users to change map styles
function changeMapTile() {
  const selector = document.getElementById('map-tile-selector');
  const selectedTile = selector.value;
  
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
    // Create custom airport icon
    const airportIcon = L.divIcon({
      html: '🏢',
      className: 'airport-icon',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    // Create airport marker and add to map
    const marker = L.marker([airport.lat, airport.lon], { icon: airportIcon })
      .addTo(map)
      .bindPopup(() => {
        // Format frequency list for popup display
        const freqList = airport.freq && airport.freq.length
          ? airport.freq.map(f => `<b>${f.description}:</b> ${f.frequency_mhz} MHz`).join('<br>')
          : 'No frequency data available';

        const skyVectorUrl = createSkyVectorUrl(airport);  // Get SkyVector link

        // Create popup content with airport info and action buttons
        return `
          <b>${airport.icao}</b><br>
          ${airport.name}<br><br>
          ${freqList}<br><br>
          <a href="${skyVectorUrl}" target="_blank" style="color: #007bff; text-decoration: none;">
            View on SkyVector</a><br>               
          <br>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <button onclick="setAsFrom('${airport.icao}')" style="padding: 8px 12px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
              Set as FROM
            </button>
            <button onclick="setAsTo('${airport.icao}')" style="padding: 8px 12px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
              Set as TO
            </button>
            <button onclick="directToAirport('${airport.icao}')" style="padding: 8px 12px; background-color: #fd7e14; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
              Direct To
            </button>
          </div>`;
      })
      .bindTooltip(() => {
        // Create tooltip with airport info
        const freqList = airport.freq && airport.freq.length
          ? airport.freq.map(f => `${f.description}: ${f.frequency_mhz}`).join('<br>')
          : 'No frequency data';

        return `
          <b>${airport.icao}</b><br>
          ${airport.name}<br>
          ${freqList}`;
      }, {
        permanent: false,
        direction: 'top',
        offset: [0, -10]
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
  
  // Close the popup
  map.closePopup();
}

// Function to set airport as TO destination
function setAsTo(icao) {
  selectedToAirport = icao;
  document.getElementById('route-to-display').textContent = icao;
  document.getElementById('route-to-display').classList.add('filled');
  updateRouteButton();
  
  // Close the popup
  map.closePopup();
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
  
  // Update radio page with direct-to information
  updateDirectToRadioInfo(toAirport);
  
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
  
  // Close the popup
  map.closePopup();
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
  
  // Clear previous route
  clearRoute();
  
  // Restore the selected airports after clearing
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
  
  // Update radio page route information
  updateRadioRouteInfo(fromAirport, toAirport);

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

// Function to update radio page with route information for FROM and TO airports
function updateRadioRouteInfo(fromAirport, toAirport) {
  // Show the route info display
  document.getElementById('route-info-display').style.display = 'flex';
  
  // Update FROM airport information
  document.getElementById('radio-from-icao').textContent = fromAirport.icao;
  document.getElementById('radio-from-name').textContent = fromAirport.name;
  
  // Format frequencies for FROM airport
  if (fromAirport.freq && fromAirport.freq.length > 0) {
    const freqHtml = formatFrequenciesForDisplay(fromAirport.freq);
    document.getElementById('radio-from-freq').innerHTML = freqHtml;
    document.getElementById('radio-from-freq').className = fromAirport.freq.length > 6 ? 'frequencies multi-column' : 'frequencies';
  } else {
    document.getElementById('radio-from-freq').textContent = 'No freq listed';
    document.getElementById('radio-from-freq').className = 'frequencies no-freq';
  }
  
  // Update TO airport information
  document.getElementById('radio-to-icao').textContent = toAirport.icao;
  document.getElementById('radio-to-name').textContent = toAirport.name;
  
  // Format frequencies for TO airport
  if (toAirport.freq && toAirport.freq.length > 0) {
    const freqHtml = formatFrequenciesForDisplay(toAirport.freq);
    document.getElementById('radio-to-freq').innerHTML = freqHtml;
    document.getElementById('radio-to-freq').className = toAirport.freq.length > 6 ? 'frequencies multi-column' : 'frequencies';
  } else {
    document.getElementById('radio-to-freq').textContent = 'No freq listed';
    document.getElementById('radio-to-freq').className = 'frequencies no-freq';
  }
}

// Function to format frequencies for multi-column display when there are many frequencies
function formatFrequenciesForDisplay(frequencies) {
  if (frequencies.length <= 6) {
    // Single column for 6 or fewer frequencies
    return frequencies.map(f => `${f.description}: ${f.frequency_mhz}`).join('<br>');
  } else {
    // Multi-column for more than 6 frequencies
    const midPoint = Math.ceil(frequencies.length / 2);
    const leftColumn = frequencies.slice(0, midPoint);
    const rightColumn = frequencies.slice(midPoint);
    
    const leftHtml = leftColumn.map(f => `${f.description}: ${f.frequency_mhz}`).join('<br>');
    const rightHtml = rightColumn.map(f => `${f.description}: ${f.frequency_mhz}`).join('<br>');
    
    return `<div class="freq-column">${leftHtml}</div><div class="freq-column">${rightHtml}</div>`;
  }
}

// Function to update radio page with direct-to information (from current position)
function updateDirectToRadioInfo(toAirport) {
  // Show the route info display
  document.getElementById('route-info-display').style.display = 'flex';
  
  // Update FROM airport information (Current Position)
  document.getElementById('radio-from-icao').textContent = 'Current Position';
  document.getElementById('radio-from-name').textContent = 'Aircraft Location';
  document.getElementById('radio-from-freq').textContent = 'No frequencies';
  document.getElementById('radio-from-freq').className = 'frequencies no-freq';
  
  // Update TO airport information
  document.getElementById('radio-to-icao').textContent = toAirport.icao;
  document.getElementById('radio-to-name').textContent = toAirport.name;
  
  // Format frequencies for TO airport
  if (toAirport.freq && toAirport.freq.length > 0) {
    const freqHtml = formatFrequenciesForDisplay(toAirport.freq);
    document.getElementById('radio-to-freq').innerHTML = freqHtml;
    document.getElementById('radio-to-freq').className = toAirport.freq.length > 6 ? 'frequencies multi-column' : 'frequencies';
  } else {
    document.getElementById('radio-to-freq').textContent = 'No freq listed';
    document.getElementById('radio-to-freq').className = 'frequencies no-freq';
  }
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
  
  // Hide radio page route information
  document.getElementById('route-info-display').style.display = 'none';
  
  // Disable route button
  updateRouteButton();
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

// Start WebSocket connection
connectWebSocket();