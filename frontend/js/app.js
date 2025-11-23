// TideWatch Frontend JavaScript

// Configuration
const API_BASE = window.location.origin;

// State management
const state = {
    config: null,
    currentView: 0,
    tideData: null,
    weatherData: null,
    astronomyData: null,
    lastUpdate: null
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌊 TideWatch initializing...');
    initApp();
});

// Main initialization
async function initApp() {
    // Start clock
    updateClock();
    setInterval(updateClock, 1000);
    
    // Load configuration
    await loadConfig();
    
    // Check server health
    await checkHealth();
    
    // Set up swipe functionality
    initSwipe();

    // Load weather data
    await loadWeatherData();
    
    // Load placeholder data
    loadPlaceholderData();
    
    // Draw initial tide dial
    updateTideDial(0.65, true); // 65% of tide cycle, rising
    
    console.log('✅ TideWatch ready!');
}

// Update clock display
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    
    const timeElement = document.getElementById('current-time');
    if (timeElement) {
        timeElement.textContent = timeString;
    }
}

// Load configuration from backend
async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE}/api/config`);
        const data = await response.json();
        state.config = data;
        
        const locationElement = document.getElementById('location-name');
        if (locationElement && data.location) {
            locationElement.textContent = data.location.name;
        }
        
        console.log('📍 Location loaded:', data.location.name);
    } catch (error) {
        console.error('❌ Failed to load config:', error);
        updateConnectionStatus(false);
    }
}

// Check server health
async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE}/api/health`);
        const data = await response.json();
        
        if (data.status === 'ok') {
            updateConnectionStatus(true);
            console.log('💚 Server healthy');
        }
    } catch (error) {
        console.error('❌ Health check failed:', error);
        updateConnectionStatus(false);
    }
}

// Update connection status indicator
function updateConnectionStatus(isConnected) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = isConnected ? '🟢 Connected' : '🔴 Disconnected';
    }
}

// Load placeholder data for testing
function loadPlaceholderData() {
    // Placeholder tide data
    document.getElementById('current-height').textContent = '7.8 ft';
    document.getElementById('next-low').textContent = '7:34 PM';
    document.getElementById('next-high').textContent = '9:08 AM';
    document.getElementById('high-time').textContent = '9:08 AM';
    document.getElementById('low-time').textContent = '7:34 PM';
    
    // // Placeholder weather data
    // document.getElementById('wind-speed').textContent = '54 mph';
    // document.getElementById('weather-temp').textContent = '28°F';
    // document.getElementById('visibility').textContent = '10 mi';
    
    // Placeholder astronomy data
    document.getElementById('moon-rise').textContent = '6:45 AM';
    document.getElementById('moon-set').textContent = '4:32 PM';
    document.getElementById('sunrise').textContent = '7:52 AM';
    document.getElementById('sunset').textContent = '4:18 PM';
    
    // Create simple tide chart
    createTideChart();
    
    // Create tide table
    createTideTable();
    
    updateLastUpdateTime();
}

// Draw tide dial arc
function updateTideDial(percentage, isRising) {
    const svg = document.querySelector('.tide-dial');
    const arc = document.getElementById('tide-arc');
    const directionText = document.getElementById('tide-direction');
    const statusText = document.getElementById('tide-status');
    
    // Calculate arc path
    const centerX = 100;
    const centerY = 100;
    const radius = 80;
    
    // Start from bottom (270 degrees) and go clockwise
    const startAngle = 270;
    const endAngle = startAngle + (percentage * 360);
    
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    
    const largeArc = percentage > 0.5 ? 1 : 0;
    
    const pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    arc.setAttribute('d', pathData);
    
    // Set color based on rising/falling
    arc.setAttribute('stroke', isRising ? '#ff4444' : '#4444ff');
    
    // Update text
    if (directionText && statusText) {
        if (isRising) {
            directionText.textContent = 'Rising';
            statusText.textContent = '↑';
        } else {
            directionText.textContent = 'Falling';
            statusText.textContent = '↓';
        }
    }
}

// Create simple tide chart using Canvas
function createTideChart() {
    const canvas = document.getElementById('tide-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Generate sample tide data (sine wave)
    const points = [];
    const numPoints = 48; // 48 half-hours in a day
    for (let i = 0; i < numPoints; i++) {
        const x = padding + (i / (numPoints - 1)) * (width - 2 * padding);
        const y = height / 2 + Math.sin((i / numPoints) * Math.PI * 2 - Math.PI / 2) * (height / 3);
        points.push({ x, y });
    }
    
    // Draw grid lines
    ctx.strokeStyle = '#3a4555';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + (i / 4) * (height - 2 * padding);
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }
    
    // Draw tide curve
    ctx.strokeStyle = '#00a8e8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    
    // Draw current time indicator (vertical line)
    const currentHour = new Date().getHours();
    const currentX = padding + (currentHour / 24) * (width - 2 * padding);
    ctx.strokeStyle = '#ffa500';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(currentX, padding);
    ctx.lineTo(currentX, height - padding);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Add labels
    ctx.fillStyle = '#a0b5c0';
    ctx.font = '12px sans-serif';
    ctx.fillText('12 AM', padding, height - 10);
    ctx.fillText('6 AM', padding + (width - 2 * padding) * 0.25, height - 10);
    ctx.fillText('12 PM', padding + (width - 2 * padding) * 0.5, height - 10);
    ctx.fillText('6 PM', padding + (width - 2 * padding) * 0.75, height - 10);
}

// Create tide table
function createTideTable() {
    const tableDiv = document.getElementById('tide-table');
    if (!tableDiv) return;
    
    // Sample 7-day data
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dates = [23, 24, 25, 26, 27, 28, 29];
    
    let html = '<table><thead><tr><th>Day</th><th>High Tide</th><th>Low Tide</th></tr></thead><tbody>';
    
    for (let i = 0; i < 7; i++) {
        html += `
            <tr>
                <td><strong>${days[i]} ${dates[i]}</strong></td>
                <td>9:${String(i * 5).padStart(2, '0')} AM (${8 + i * 0.3}ft)<br>9:${String(30 + i * 5).padStart(2, '0')} PM (${8.5 + i * 0.2}ft)</td>
                <td>3:${String(i * 7).padStart(2, '0')} AM (${2 - i * 0.2}ft)<br>3:${String(30 + i * 7).padStart(2, '0')} PM (${1.8 - i * 0.15}ft)</td>
            </tr>
        `;
    }
    
    html += '</tbody></table>';
    tableDiv.innerHTML = html;
}

// Initialize swipe functionality
function initSwipe() {
    const container = document.getElementById('swipe-container');
    const indicators = document.querySelectorAll('.indicator');
    
    // Click indicators to switch views
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            switchView(index);
        });
    });
    
    // Touch/swipe support
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    
    container.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        isDragging = true;
    });
    
    container.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
    });
    
    container.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        currentX = e.clientX;
    });
    
    container.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX;
    });
    
    const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        
        const diff = startX - currentX;
        if (Math.abs(diff) > 50) {
            if (diff > 0 && state.currentView < 1) {
                switchView(state.currentView + 1);
            } else if (diff < 0 && state.currentView > 0) {
                switchView(state.currentView - 1);
            }
        }
    };
    
    container.addEventListener('mouseup', endDrag);
    container.addEventListener('touchend', endDrag);
    container.addEventListener('mouseleave', endDrag);
}

// Switch between views
function switchView(index) {
    const panels = document.querySelectorAll('.swipe-panel');
    const indicators = document.querySelectorAll('.indicator');
    
    panels.forEach(panel => panel.classList.remove('active'));
    indicators.forEach(ind => ind.classList.remove('active'));
    
    panels[index].classList.add('active');
    indicators[index].classList.add('active');
    
    state.currentView = index;
    
    // Redraw chart if switching to chart view
    if (index === 0) {
        setTimeout(createTideChart, 100);
    }
}

// Update last update timestamp
function updateLastUpdateTime() {
    state.lastUpdate = new Date();
    const updateElement = document.getElementById('last-update');
    if (updateElement) {
        const timeStr = state.lastUpdate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        updateElement.textContent = `Updated: ${timeStr}`;
    }
}

// Utility: Format date/time
function formatDateTime(date, options = {}) {
    return new Date(date).toLocaleString('en-US', options);
}

// Export functions for use in other scripts if needed
window.TideWatch = {
    updateTideDial,
    createTideChart,
    switchView,
    state
};

// Load weather data from API
async function loadWeatherData() {
    try {
        const response = await fetch(`${API_BASE}/api/weather`);
        const data = await response.json();
        state.weatherData = data;
        console.log('Weather data:', data);
        
        // Display the weather!
        displayWeather(data);
        
        updateLastUpdateTime();
        return data;
    } catch (error) {
        console.error('Failed to load weather data:', error);
        return null;
    }
}

// Display weather data on the page
// Display weather data on the page
function displayWeather(weatherData) {
    if (!weatherData || !weatherData.data) {
        console.log('No weather data to display');
        return;
    }
    
    const weather = weatherData.data;
    
    // Update temperature
    const tempElement = document.getElementById('weather-temp');
    if (tempElement) {
        tempElement.textContent = `${weather.temperature}°${weather.temperature_unit}`;
    }
    
    // Update wind speed and direction
    const windElement = document.getElementById('wind-speed');
    if (windElement) {
        windElement.textContent = `${weather.wind_speed} ${weather.wind_direction}`;
    }
    
    // Update visibility
    const visibilityElement = document.getElementById('visibility');
    if (visibilityElement) {
        visibilityElement.textContent = weather.visibility || 'N/A';
    }
    
    console.log('✅ Weather displayed:', weather.temperature, weather.wind_speed, weather.wind_direction, 'Vis:', weather.visibility);
}