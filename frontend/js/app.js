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
    lastUpdate: null,
    isConnected: false
};

// Set initial placeholder values
function setPlaceholders() {
    // Tide placeholders
    document.getElementById('current-height').textContent = '--.- ft';
    document.getElementById('next-high').textContent = '--:--';
    document.getElementById('next-low').textContent = '--:--';
    document.getElementById('high-time').textContent = '--:--';
    document.getElementById('low-time').textContent = '--:--';
    document.getElementById('tide-direction').textContent = '--';
    document.getElementById('tide-status').textContent = '';
    
    // Weather placeholders
    document.getElementById('weather-temp').textContent = '--°F';
    document.getElementById('wind-speed').textContent = '-- mph';
    document.getElementById('visibility').textContent = '-- mi';
    
    // Astronomy placeholders
    document.getElementById('sunrise').textContent = '--:--';
    document.getElementById('sunset').textContent = '--:--';
    document.getElementById('moon-rise').textContent = '--:--';
    document.getElementById('moon-set').textContent = '--:--';
    
    // Update status
    document.getElementById('last-update').textContent = 'Connecting...';
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌊 TideWatch initializing...');
    setPlaceholders();
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
    
    // Load astronomy data
    await loadAstronomyData();
    
    // Load tide data
    await loadTideData();
    
    // Refresh tide data every 6 minutes
    setInterval(loadTideData, 360000);
    
    // Refresh astronomy data every hour
    setInterval(loadAstronomyData, 3600000);
    
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
        } else {
            updateConnectionStatus(false);
        }
    } catch (error) {
        console.error('❌ Health check failed:', error);
        updateConnectionStatus(false);
    }
}

// Update connection status indicator
function updateConnectionStatus(isConnected) {
    state.isConnected = isConnected;
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = isConnected ? '🟢 Connected' : '🔴 Disconnected';
    }
    
    // Update last update text based on connection
    if (!isConnected) {
        const updateElement = document.getElementById('last-update');
        if (updateElement) {
            updateElement.textContent = 'Connection Lost';
        }
    }
}

// Load tide data from API
async function loadTideData() {
    try {
        const response = await fetch(`${API_BASE}/api/tide`);
        const result = await response.json();
        
        if (result.status === 'ok') {
            state.tideData = result.data;
            state.isConnected = true;
            console.log('🌊 Tide data loaded:', result.data);
            
            // Display the tide data
            displayTideData(result.data);
            
            updateLastUpdateTime();
        } else {
            console.error('Failed to load tide data:', result.message);
            setTidePlaceholders();
        }
    } catch (error) {
        console.error('Error loading tide data:', error);
        state.isConnected = false;
        updateConnectionStatus(false);
        setTidePlaceholders();
    }
}

// Set tide-related placeholders
function setTidePlaceholders() {
    document.getElementById('current-height').textContent = '--.- ft';
    document.getElementById('next-high').textContent = '--:--';
    document.getElementById('next-low').textContent = '--:--';
    document.getElementById('high-time').textContent = '--:--';
    document.getElementById('low-time').textContent = '--:--';
    document.getElementById('tide-direction').textContent = '--';
    document.getElementById('tide-status').textContent = '';
    
    // Clear chart
    const canvas = document.getElementById('tide-chart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // Clear table
    const tableDiv = document.getElementById('tide-table');
    if (tableDiv) {
        tableDiv.innerHTML = '<p style="text-align: center; color: #a0b5c0; padding: 2rem;">No tide data available</p>';
    }
}

// Display tide data on the page
function displayTideData(tideData) {
    if (!tideData) {
        setTidePlaceholders();
        return;
    }
    
    // Current height
    const heightElement = document.getElementById('current-height');
    if (heightElement) {
        if (tideData.current && tideData.current.height != null) {
            heightElement.textContent = `${tideData.current.height} ft`;
        } else {
            heightElement.textContent = '--.- ft';
        }
    }
    
    // Next high tide
    const nextHighElement = document.getElementById('next-high');
    const highTimeElement = document.getElementById('high-time');
    if (tideData.next_high) {
        const highTime = tideData.next_high.time_12hr || formatTime(tideData.next_high.time);
        if (nextHighElement) nextHighElement.textContent = highTime;
        if (highTimeElement) highTimeElement.textContent = highTime;
    } else {
        if (nextHighElement) nextHighElement.textContent = '--:--';
        if (highTimeElement) highTimeElement.textContent = '--:--';
    }
    
    // Next low tide
    const nextLowElement = document.getElementById('next-low');
    const lowTimeElement = document.getElementById('low-time');
    if (tideData.next_low) {
        const lowTime = tideData.next_low.time_12hr || formatTime(tideData.next_low.time);
        if (nextLowElement) nextLowElement.textContent = lowTime;
        if (lowTimeElement) lowTimeElement.textContent = lowTime;
    } else {
        if (nextLowElement) nextLowElement.textContent = '--:--';
        if (lowTimeElement) lowTimeElement.textContent = '--:--';
    }
    
    // Tide status (rising/falling) and dial
    if (tideData.status && tideData.status.has_predictions !== false) {
        updateTideDial(
            tideData.status.percentage,
            tideData.status.is_rising
        );
    } else {
        // Reset dial if no status
        document.getElementById('tide-direction').textContent = '--';
        document.getElementById('tide-status').textContent = '';
    }
    
    // Create tide chart with real data
    if (tideData.predictions && tideData.predictions.length > 0) {
        createTideChart(tideData.predictions, tideData.current);
    } else {
        // Clear chart if no predictions
        const canvas = document.getElementById('tide-chart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    // Create tide table with real data
    if (tideData.predictions && tideData.predictions.length > 0) {
        createTideTable(tideData.predictions);
    } else {
        const tableDiv = document.getElementById('tide-table');
        if (tableDiv) {
            tableDiv.innerHTML = '<p style="text-align: center; color: #a0b5c0; padding: 2rem;">No tide data available</p>';
        }
    }
    
    console.log('✅ Tide data displayed');
}

// Format time from NOAA format to display format (12-hour with AM/PM)
function formatTime(timeString) {
    // Handle null/undefined
    if (!timeString) {
        return '--:--';
    }
    
    // If already in 12-hour format (has AM/PM), return as-is
    if (timeString.includes('AM') || timeString.includes('PM')) {
        return timeString;
    }
    
    try {
        // NOAA format: "2025-11-28 14:30"
        const date = new Date(timeString);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return '--:--';
        }
        
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch (e) {
        return '--:--';
    }
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

// Create tide chart using real NOAA data
function createTideChart(predictions, currentLevel) {
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
    
    // Filter today's predictions
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    const todaysPredictions = predictions.filter(pred => {
        const predTime = new Date(pred.time);
        return predTime >= todayStart && predTime < todayEnd;
    });
    
    if (todaysPredictions.length === 0) return;
    
    // Find min/max heights for scaling
    const heights = todaysPredictions.map(p => p.height);
    const minHeight = Math.min(...heights) - 1;
    const maxHeight = Math.max(...heights) + 1;
    const heightRange = maxHeight - minHeight;
    
    // Convert predictions to canvas coordinates
    const points = todaysPredictions.map(pred => {
        const predTime = new Date(pred.time);
        const hours = predTime.getHours() + predTime.getMinutes() / 60;
        
        const x = padding + (hours / 24) * (width - 2 * padding);
        const y = height - padding - ((pred.height - minHeight) / heightRange) * (height - 2 * padding);
        
        return { x, y, time: predTime, height: pred.height, type: pred.type };
    });
    
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
    
    // Draw smooth curve through high/low points
    if (points.length >= 2) {
        ctx.strokeStyle = '#00a8e8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        // Create smooth curve using quadratic bezier
        ctx.moveTo(points[0].x, points[0].y);
        
        for (let i = 0; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];
            const midX = (current.x + next.x) / 2;
            const midY = (current.y + next.y) / 2;
            
            ctx.quadraticCurveTo(current.x, current.y, midX, midY);
        }
        
        // Last segment
        const lastPoint = points[points.length - 1];
        ctx.lineTo(lastPoint.x, lastPoint.y);
        ctx.stroke();
        
        // Draw points for high/low tides
        points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = point.type === 'H' ? '#ff4444' : '#4444ff';
            ctx.fill();
        });
    }
    
    // Draw current time indicator
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const currentX = padding + (currentHour / 24) * (width - 2 * padding);
    ctx.strokeStyle = '#ffa500';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(currentX, padding);
    ctx.lineTo(currentX, height - padding);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Add time labels
    ctx.fillStyle = '#a0b5c0';
    ctx.font = '12px sans-serif';
    ctx.fillText('12 AM', padding, height - 10);
    ctx.fillText('6 AM', padding + (width - 2 * padding) * 0.25, height - 10);
    ctx.fillText('12 PM', padding + (width - 2 * padding) * 0.5, height - 10);
    ctx.fillText('6 PM', padding + (width - 2 * padding) * 0.75, height - 10);
}

// Create tide table with real data
function createTideTable(predictions) {
    const tableDiv = document.getElementById('tide-table');
    if (!tableDiv) return;
    
    // Group predictions by day
    const dayGroups = {};
    
    predictions.forEach(pred => {
        const predDate = new Date(pred.time);
        const dateKey = predDate.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
        
        if (!dayGroups[dateKey]) {
            dayGroups[dateKey] = {
                highs: [],
                lows: []
            };
        }
        
        if (pred.type === 'H') {
            dayGroups[dateKey].highs.push(pred);
        } else {
            dayGroups[dateKey].lows.push(pred);
        }
    });
    
    // Build table HTML
    let html = '<table><thead><tr><th>Day</th><th>High Tide</th><th>Low Tide</th></tr></thead><tbody>';
    
    Object.keys(dayGroups).slice(0, 7).forEach(dateKey => {
        const day = dayGroups[dateKey];
        
        // Use pre-formatted 12hr times if available
        const highsHtml = day.highs.map(h => 
            `${h.time_12hr || formatTime(h.time)} (${h.height}ft)`
        ).join('<br>');
        
        const lowsHtml = day.lows.map(l => 
            `${l.time_12hr || formatTime(l.time)} (${l.height}ft)`
        ).join('<br>');
        
        html += `
            <tr>
                <td><strong>${dateKey}</strong></td>
                <td>${highsHtml || 'N/A'}</td>
                <td>${lowsHtml || 'N/A'}</td>
            </tr>
        `;
    });
    
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
    if (index === 0 && state.tideData) {
        setTimeout(() => {
            createTideChart(state.tideData.predictions, state.tideData.current);
        }, 100);
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

// Load weather data from API
async function loadWeatherData() {
    try {
        const response = await fetch(`${API_BASE}/api/weather`);
        const data = await response.json();
        
        if (data.status === 'ok') {
            state.weatherData = data;
            displayWeather(data);
            updateLastUpdateTime();
            return data;
        } else {
            console.error('Failed to load weather data');
            setWeatherPlaceholders();
            return null;
        }
    } catch (error) {
        console.error('Failed to load weather data:', error);
        setWeatherPlaceholders();
        return null;
    }
}

// Set weather-related placeholders
function setWeatherPlaceholders() {
    document.getElementById('weather-temp').textContent = '--°F';
    document.getElementById('wind-speed').textContent = '-- mph';
    document.getElementById('visibility').textContent = '-- mi';
}

// Display weather data on the page
function displayWeather(weatherData) {
    if (!weatherData || !weatherData.data) {
        console.log('No weather data to display');
        setWeatherPlaceholders();
        return;
    }
    
    const weather = weatherData.data;
    
    // Update temperature
    const tempElement = document.getElementById('weather-temp');
    if (tempElement) {
        if (weather.temperature != null) {
            tempElement.textContent = `${weather.temperature}°${weather.temperature_unit || 'F'}`;
        } else {
            tempElement.textContent = '--°F';
        }
    }
    
    // Update wind speed and direction
    const windElement = document.getElementById('wind-speed');
    if (windElement) {
        if (weather.wind_speed && weather.wind_direction) {
            windElement.textContent = `${weather.wind_speed} ${weather.wind_direction}`;
        } else {
            windElement.textContent = '-- mph';
        }
    }
    
    // Update visibility
    const visibilityElement = document.getElementById('visibility');
    if (visibilityElement) {
        visibilityElement.textContent = weather.visibility || '-- mi';
    }
}

// Load astronomy data from API
async function loadAstronomyData() {
    try {
        const response = await fetch(`${API_BASE}/api/astronomy`);
        const data = await response.json();
        
        if (data.status === 'ok') {
            state.astronomyData = data;
            console.log('Astronomy data:', data);
            displayAstronomy(data);
            updateLastUpdateTime();
            return data;
        } else {
            console.error('Failed to load astronomy data');
            setAstronomyPlaceholders();
            return null;
        }
    } catch (error) {
        console.error('Failed to load astronomy data:', error);
        setAstronomyPlaceholders();
        return null;
    }
}

// Set astronomy-related placeholders
function setAstronomyPlaceholders() {
    document.getElementById('sunrise').textContent = '--:--';
    document.getElementById('sunset').textContent = '--:--';
    document.getElementById('moon-rise').textContent = '--:--';
    document.getElementById('moon-set').textContent = '--:--';
}

// Display astronomy data on the page
function displayAstronomy(astronomyData) {
    if (!astronomyData || !astronomyData.data) {
        console.log('No astronomy data to display');
        setAstronomyPlaceholders();
        return;
    }
    
    const astro = astronomyData.data;
    
    // Update sunrise/sunset
    const sunriseElement = document.getElementById('sunrise');
    if (sunriseElement) {
        sunriseElement.textContent = astro.sunrise || '--:--';
    }
    
    const sunsetElement = document.getElementById('sunset');
    if (sunsetElement) {
        sunsetElement.textContent = astro.sunset || '--:--';
    }
    
    // Update moonrise/moonset
    const moonriseElement = document.getElementById('moon-rise');
    if (moonriseElement) {
        moonriseElement.textContent = astro.moonrise || '--:--';
    }
    
    const moonsetElement = document.getElementById('moon-set');
    if (moonsetElement) {
        moonsetElement.textContent = astro.moonset || '--:--';
    }
    
    // Update moon phase emoji
    const moonPhaseElement = document.getElementById('moon-phase');
    if (moonPhaseElement && astro.moon_emoji) {
        moonPhaseElement.textContent = astro.moon_emoji;
    }
    
    console.log('✅ Astronomy displayed:', astro.sunrise, astro.sunset, 'Moon:', astro.moon_phase, astro.moon_emoji);
}

// Export functions for use in other scripts if needed
window.TideWatch = {
    updateTideDial,
    createTideChart,
    switchView,
    state
};