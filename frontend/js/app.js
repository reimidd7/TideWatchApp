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
    multiDayAstronomy: null,
    lastUpdate: null,
    isConnected: false,
    theme: 'dark' // default theme
};

// State for dial swipe
const dialSwipeState = {
    currentView: 0,
    startX: 0,
    currentX: 0,
    isDragging: false
};

// Theme Toggle
function initTheme() {
    // Check if user has a saved preference
    const savedTheme = localStorage.getItem('tidewatch-theme') || 'dark';
    state.theme = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon();
}

function toggleTheme() {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    state.theme = newTheme;
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('tidewatch-theme', newTheme);
    updateThemeIcon();
    
    // Redraw chart with new colors
    if (state.tideData && state.tideData.predictions) {
        createTideChart(state.tideData.predictions, state.tideData.current);
    }
    
    // Update tide dial colors
    if (state.tideData && state.tideData.status) {
        updateTideDial(state.tideData.status.percentage, state.tideData.status.is_rising);
    }
}

function updateThemeIcon() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.textContent = state.theme === 'dark' ? '☀️' : '🌙';
    }
}

// Set initial placeholder values
function setPlaceholders() {
    // Tide placeholders
    document.getElementById('current-height').textContent = '--.- ft';
    document.getElementById('next-high').textContent = ' --:--';
    document.getElementById('next-low').textContent = ' --:--';
    
    // Dial time displays
    const highTimeDisplay = document.getElementById('high-time-display');
    const lowTimeDisplay = document.getElementById('low-time-display');
    if (highTimeDisplay) highTimeDisplay.textContent = '--:--';
    if (lowTimeDisplay) lowTimeDisplay.textContent = '--:--';
    
    // Center dial values
    const todayHigh = document.getElementById('today-high');
    const todayLow = document.getElementById('today-low');
    if (todayHigh) todayHigh.textContent = '--.-';
    if (todayLow) todayLow.textContent = '--.-';
    
    // Next tide display
    const nextTideType = document.getElementById('next-tide-type');
    const nextTideHeight = document.getElementById('next-tide-height');
    const nextTideCountdown = document.getElementById('next-tide-countdown');
    if (nextTideType) nextTideType.textContent = '--';
    if (nextTideHeight) nextTideHeight.textContent = '--.- ft';
    if (nextTideCountdown) nextTideCountdown.textContent = 'in --h --m';
    
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
    
    // Initialize theme
    initTheme();
    
    // Set up theme toggle button
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
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
    
    // Set up dial swipe functionality
    initDialSwipe();
    
    // Start countdown timer
    startCountdownTimer();

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
    
    // Schedule midnight refresh for tide table
    scheduleMidnightRefresh();  // ADD THIS LINE
    
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
    document.getElementById('next-high').textContent = ' --:--';
    document.getElementById('next-low').textContent = ' --:--';
    
    // Dial time displays
    const highTimeDisplay = document.getElementById('high-time-display');
    const lowTimeDisplay = document.getElementById('low-time-display');
    if (highTimeDisplay) highTimeDisplay.textContent = '--:--';
    if (lowTimeDisplay) lowTimeDisplay.textContent = '--:--';
    
    // Reset center dial display
    const todayHigh = document.getElementById('today-high');
    const todayLow = document.getElementById('today-low');
    if (todayHigh) todayHigh.textContent = '--.-';
    if (todayLow) todayLow.textContent = '--.-';
    
    // Reset next tide display
    const nextTideType = document.getElementById('next-tide-type');
    const nextTideHeight = document.getElementById('next-tide-height');
    const nextTideCountdown = document.getElementById('next-tide-countdown');
    if (nextTideType) nextTideType.textContent = '--';
    if (nextTideHeight) nextTideHeight.textContent = '--.- ft';
    if (nextTideCountdown) nextTideCountdown.textContent = 'in --h --m';
    
    // Clear chart
    const canvas = document.getElementById('tide-chart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // Clear table
    const tableDiv = document.getElementById('tide-table');
    if (tableDiv) {
        tableDiv.innerHTML = '<p style="text-align: center; padding: 2rem;">No tide data available</p>';
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
    const highTimeDisplay = document.getElementById('high-time-display');
    if (tideData.next_high) {
        const highTime = tideData.next_high.time_12hr || formatTime(tideData.next_high.time);
        if (nextHighElement) nextHighElement.textContent = highTime;
        if (highTimeDisplay) highTimeDisplay.textContent = highTime;
    } else {
        if (nextHighElement) nextHighElement.textContent = ' --:--';
        if (highTimeDisplay) highTimeDisplay.textContent = ' --:--';
    }
    
    // Next low tide
    const nextLowElement = document.getElementById('next-low');
    const lowTimeDisplay = document.getElementById('low-time-display');
    if (tideData.next_low) {
        const lowTime = tideData.next_low.time_12hr || formatTime(tideData.next_low.time);
        if (nextLowElement) nextLowElement.textContent = lowTime;
        if (lowTimeDisplay) lowTimeDisplay.textContent = lowTime;
    } else {
        if (nextLowElement) nextLowElement.textContent = ' --:--';
        if (lowTimeDisplay) lowTimeDisplay.textContent = ' --:--';
    }
    
    // Display today's high/low in the dial center
    if (tideData.predictions && tideData.predictions.length > 0) {
        displayTodaysHighLow(tideData.predictions);
    }
    
    // Tide status (rising/falling) and dial
    if (tideData.status && tideData.status.has_predictions !== false) {
        updateTideDial(
            tideData.status.percentage,
            tideData.status.is_rising
        );
    } else {
        // Reset dial if no status
        const arc = document.getElementById('tide-arc');
        if (arc) arc.setAttribute('d', '');
    }
    
    // Create tide chart with real data
    if (tideData.predictions && tideData.predictions.length > 0) {
        createTideChart(tideData.predictions, tideData.current);
    } else {
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
            tableDiv.innerHTML = '<p style="text-align: center; padding: 2rem;">No tide data available</p>';
        }
    }
    
    // Update next tide display with countdown
    updateNextTideDisplay(tideData);
    
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

// Get CSS variable value
function getCSSVar(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

// Draw tide dial arc
// Replace the existing updateTideDial function in app.js with this:

// REPLACE the entire updateTideDial function in app.js with this:

// REPLACE the entire updateTideDial function in app.js with this:

function updateTideDial(percentage, isRising) {
    const arc = document.getElementById('tide-arc');
    if (!arc) return;
    
    const centerX = 120;
    const centerY = 120;
    const radius = 80;
    
    // Don't draw if percentage is essentially 0
    if (percentage < 0.01) {
        arc.setAttribute('d', '');
        return;
    }
    
    // Clamp percentage to valid range
    percentage = Math.max(0, Math.min(1, percentage));
    
    // Set the gradient based on direction
    if (isRising) {
        arc.setAttribute('stroke', 'url(#tideGradientRising)');
    } else {
        arc.setAttribute('stroke', 'url(#tideGradientFalling)');
    }
    
    // SVG angles: 0°=right, 90°=down, 180°=left, 270°=up
    // Convert degrees to radians
    const toRad = (deg) => (deg * Math.PI) / 180;
    
    // Build path using many small line segments (follows circle exactly)
    const numSegments = Math.max(20, Math.floor(percentage * 50));
    const totalAngle = percentage * 180;  // Max 180 degrees (half circle)
    
    let pathData = '';
    
    for (let i = 0; i <= numSegments; i++) {
        const progress = i / numSegments;
        let angle;
        
        if (isRising) {
            // LEFT side: start at bottom (90°), go toward top (270°) via left (180°)
            angle = 90 + (progress * totalAngle);
        } else {
            // RIGHT side: start at top (270°), go toward bottom (450°/90°) via right (360°)
            angle = 270 + (progress * totalAngle);
        }
        
        const x = centerX + radius * Math.cos(toRad(angle));
        const y = centerY + radius * Math.sin(toRad(angle));
        
        if (i === 0) {
            pathData = `M ${x} ${y}`;
        } else {
            pathData += ` L ${x} ${y}`;
        }
    }
    
    arc.setAttribute('d', pathData);
    
    console.log(`Tide dial: ${isRising ? 'Rising' : 'Falling'} ${(percentage * 100).toFixed(1)}%`);
}
// Create tide chart using real NOAA data
// REPLACE the existing createTideChart function in app.js with this complete version

function createTideChart(predictions, currentLevel) {
    const canvas = document.getElementById('tide-chart');
    if (!canvas) return;
    
    const container = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    
    // Get container dimensions
    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width) || 700;
    const height = Math.floor(rect.height) || 180;
    
    // Set canvas size with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);
    
    // Padding for labels
    const padding = { top: 22, right: 12, bottom: 26, left: 36 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    
    ctx.clearRect(0, 0, width, height);
    
    // Get theme colors from CSS variables
    const accentColor = getCSSVar('--color-accent');
    const highTideColor = getCSSVar('--color-high-tide');
    const lowTideColor = getCSSVar('--color-low-tide');
    const textColor = getCSSVar('--color-text');
    const textDimColor = getCSSVar('--color-text-dim');
    const borderColor = getCSSVar('--color-border');
    const turquoiseColor = getCSSVar('--color-turquoise');
    
    // Helper to convert hex to rgba
    const hexToRgba = (hex, alpha) => {
        if (!hex || hex[0] !== '#') return `rgba(128,128,128,${alpha})`;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    };
    
    // Date boundaries
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const tomorrowEnd = new Date(todayEnd.getTime() + 86400000);
    
    // Sort predictions by time
    const sortedPredictions = [...predictions].sort((a, b) => 
        new Date(a.time) - new Date(b.time)
    );
    
    // Filter tides by day
    const filterByRange = (start, end) => sortedPredictions.filter(p => {
        const t = new Date(p.time);
        return t >= start && t < end;
    });
    
    const yesterdayTides = filterByRange(yesterdayStart, todayStart);
    const todayTides = filterByRange(todayStart, todayEnd);
    const tomorrowTides = filterByRange(todayEnd, tomorrowEnd);
    
    // Build array: yesterday's last + today's all + tomorrow's first
    const allTides = [];
    if (yesterdayTides.length > 0) {
        allTides.push({ ...yesterdayTides[yesterdayTides.length - 1], isToday: false });
    }
    todayTides.forEach(t => allTides.push({ ...t, isToday: true }));
    if (tomorrowTides.length > 0) {
        allTides.push({ ...tomorrowTides[0], isToday: false });
    }
    
    // Need at least 2 points to draw
    if (allTides.length < 2) {
        ctx.fillStyle = textDimColor;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Insufficient tide data', width / 2, height / 2);
        return;
    }
    
    // Calculate Y scale
    const heights = allTides.map(p => p.height);
    const minH = Math.floor(Math.min(...heights) - 1);
    const maxH = Math.ceil(Math.max(...heights) + 1);
    const hRange = maxH - minH;
    
    // Coordinate conversion functions
    const hoursToX = (hrs) => padding.left + (hrs / 24) * chartW;
    const heightToY = (h) => padding.top + (1 - (h - minH) / hRange) * chartH;
    
    // Convert tides to pixel coordinates
    const points = allTides.map(p => {
        const t = new Date(p.time);
        const hoursSinceMidnight = (t - todayStart) / 3600000;
        return {
            x: hoursToX(hoursSinceMidnight),
            y: heightToY(p.height),
            height: p.height,
            type: p.type,
            isToday: p.isToday
        };
    });
    
    // Draw horizontal grid lines
    ctx.strokeStyle = hexToRgba(borderColor, 0.2);
    ctx.lineWidth = 1;
    for (let h = minH; h <= maxH; h += 2.5) {
        const y = heightToY(h);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
    }
    
    // Catmull-Rom spline interpolation for smooth curve
    function catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        return 0.5 * (
            (2 * p1) +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3
        );
    }
    
    // Generate smooth curve points
    const curvePoints = [];
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        
        for (let t = 0; t < 1; t += 0.025) {
            curvePoints.push({
                x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
                y: catmullRom(p0.y, p1.y, p2.y, p3.y, t)
            });
        }
    }
    curvePoints.push(points[points.length - 1]);
    
    // Clip to chart area
    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, chartW, chartH);
    ctx.clip();
    
    // Draw smooth curve
    ctx.beginPath();
    ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
    for (let i = 1; i < curvePoints.length; i++) {
        ctx.lineTo(curvePoints[i].x, curvePoints[i].y);
    }
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // Draw tide points and labels (only for today's tides)
    points.forEach(pt => {
        if (!pt.isToday) return;
        
        // Draw filled circle
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = pt.type === 'H' ? highTideColor : lowTideColor;
        ctx.fill();
        
        // Draw height label
        ctx.fillStyle = textColor;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = pt.type === 'H' ? 'bottom' : 'top';
        const labelY = pt.type === 'H' ? pt.y + 15 : pt.y - 15;
        ctx.fillText(pt.height.toFixed(2), pt.x, labelY);
    });
    
    // Draw current time vertical line
    const currentHours = now.getHours() + now.getMinutes() / 60;
    const currentX = hoursToX(currentHours);
    
    ctx.strokeStyle = turquoiseColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(currentX, padding.top);
    ctx.lineTo(currentX, padding.top + chartH);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.restore(); // Remove clipping
    
    // Draw Y-axis labels
    ctx.fillStyle = textDimColor;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let h = minH; h <= maxH; h += 2.5) {
        ctx.fillText(h.toFixed(1), padding.left - 6, heightToY(h));
    }
    
    // Draw X-axis time labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const timeLabels = [
        [0, '12AM'], [4, '4AM'], [8, '8AM'], [12, '12PM'], 
        [16, '4PM'], [20, '8PM'], [24, '12AM']
    ];
    timeLabels.forEach(([hr, label]) => {
        ctx.fillText(label, hoursToX(hr), height - padding.bottom + 6);
    });
}

// Add this function right after createTideChart in app.js

// Replace the createTideTable function in app.js with this version

function createTideTable(predictions) {
    const tableDiv = document.getElementById('tide-table');
    if (!tableDiv) return;
    
    // Group predictions by day (using local timezone, not UTC)
    const dayGroups = {};
    
    predictions.forEach(pred => {
        const predDate = new Date(pred.time);
        // Format date in local timezone (PST), not UTC
        const year = predDate.getFullYear();
        const month = String(predDate.getMonth() + 1).padStart(2, '0');
        const day = String(predDate.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;
        
        if (!dayGroups[dateKey]) {
            dayGroups[dateKey] = {
                date: predDate,
                tides: []
            };
        }
        
        dayGroups[dateKey].tides.push(pred);
    });
    
    // Sort tides within each day by time
    Object.values(dayGroups).forEach(day => {
        day.tides.sort((a, b) => new Date(a.time) - new Date(b.time));
    });
    
    // Build table HTML
    let html = `
        <table class="enhanced-tide-table">
            <thead>
                <tr>
                    <th class="date-col">DATE</th>
                    <th class="tide-col">1<sup>st</sup> TIDE</th>
                    <th class="tide-col">2<sup>nd</sup> TIDE</th>
                    <th class="tide-col">3<sup>rd</sup> TIDE</th>
                    <th class="tide-col">4<sup>th</sup> TIDE</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Get sorted day keys (first 5 days only)
    const sortedDays = Object.keys(dayGroups).sort().slice(0, 5);
    
    sortedDays.forEach((dateKey, index) => {
        const day = dayGroups[dateKey];
        const date = day.date;
        
        // Format date display
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        html += `<tr>`;
        
        // Date column
        html += `
            <td class="date-cell">
                <div class="date-info">
                    <div class="day-name">${dayName}</div>
                    <div class="month-day">${monthDay}</div>
                </div>
            </td>
        `;
        
        // Tide columns (up to 4)
        for (let i = 0; i < 4; i++) {
            if (i < day.tides.length) {
                const tide = day.tides[i];
                const isHigh = tide.type === 'H';
                const tideClass = isHigh ? 'high-tide' : 'low-tide';
                const tideIcon = isHigh ? '▲' : '▼';
                
                html += `
                    <td class="tide-cell ${tideClass}">
                        <div class="tide-time"><span class="tide-icon">${tideIcon}</span> ${tide.height}ft ${tide.time_12hr || formatTime(tide.time)} </div>
                    
                       
                    </td>
                `;
            } else {
                html += `<td class="tide-cell empty">—</td>`;
            }
        }
        
        html += `</tr>`;
    });
    
    html += `</tbody></table>`;
    tableDiv.innerHTML = html;
    
    console.log('✅ 5-day tide table created');
}

// Add this function to schedule midnight refresh
function scheduleMidnightRefresh() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Midnight
    
    const msUntilMidnight = tomorrow - now;
    
    console.log(`⏰ Next table refresh at midnight (in ${Math.round(msUntilMidnight / 1000 / 60)} minutes)`);
    
    setTimeout(() => {
        console.log('🔄 Midnight refresh - reloading tide data');
        loadTideData(); // This will recreate the table with fresh data
        
        // Schedule the next midnight refresh
        scheduleMidnightRefresh();
    }, msUntilMidnight);
}

function displayTodaysHighLow(predictions) {
    /**
     * Extract and display today's highest high and lowest low tide
     */
    if (!predictions || predictions.length === 0) {
        document.getElementById('today-high').textContent = ' --.-';
        document.getElementById('today-low').textContent = ' --.-';
        return;
    }
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    // Filter today's predictions
    const todaysPredictions = predictions.filter(pred => {
        const predTime = new Date(pred.time);
        return predTime >= todayStart && predTime < todayEnd;
    });
    
    if (todaysPredictions.length === 0) {
        document.getElementById('today-high').textContent = ' --.-';
        document.getElementById('today-low').textContent = ' --.-';
        return;
    }
    
    // Find highest high and lowest low
    const highs = todaysPredictions.filter(p => p.type === 'H');
    const lows = todaysPredictions.filter(p => p.type === 'L');
    
    let highestHigh = '--.-';
    let lowestLow = '--.-';
    
    if (highs.length > 0) {
        const maxHigh = Math.max(...highs.map(h => h.height));
        highestHigh = maxHigh.toFixed(1);
    }
    
    if (lows.length > 0) {
        const minLow = Math.min(...lows.map(l => l.height));
        lowestLow = minLow.toFixed(1);
    }
    
    document.getElementById('today-high').textContent = highestHigh;
    document.getElementById('today-low').textContent = lowestLow;
    
    console.log(`Today's tides - High: ${highestHigh}ft, Low: ${lowestLow}ft`);
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

// ========================================
// DIAL SWIPE FUNCTIONALITY
// ========================================

// Initialize dial swipe functionality
function initDialSwipe() {
    const container = document.getElementById('dial-swipe-container');
    const indicators = document.querySelectorAll('.dial-indicator');
    
    if (!container) {
        console.warn('Dial swipe container not found');
        return;
    }
    
    // Click indicators to switch views
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', (e) => {
            e.stopPropagation();
            switchDialView(index);
        });
    });
    
    // Touch/swipe support
    container.addEventListener('mousedown', (e) => {
        dialSwipeState.startX = e.clientX;
        dialSwipeState.isDragging = true;
        e.preventDefault();
    });
    
    container.addEventListener('touchstart', (e) => {
        dialSwipeState.startX = e.touches[0].clientX;
        dialSwipeState.isDragging = true;
    }, { passive: true });
    
    container.addEventListener('mousemove', (e) => {
        if (!dialSwipeState.isDragging) return;
        dialSwipeState.currentX = e.clientX;
    });
    
    container.addEventListener('touchmove', (e) => {
        if (!dialSwipeState.isDragging) return;
        dialSwipeState.currentX = e.touches[0].clientX;
    }, { passive: true });
    
    const endDrag = () => {
        if (!dialSwipeState.isDragging) return;
        dialSwipeState.isDragging = false;
        
        const diff = dialSwipeState.startX - dialSwipeState.currentX;
        if (Math.abs(diff) > 30) {
            if (diff > 0 && dialSwipeState.currentView < 1) {
                switchDialView(dialSwipeState.currentView + 1);
            } else if (diff < 0 && dialSwipeState.currentView > 0) {
                switchDialView(dialSwipeState.currentView - 1);
            }
        }
    };
    
    container.addEventListener('mouseup', endDrag);
    container.addEventListener('touchend', endDrag);
    container.addEventListener('mouseleave', endDrag);
    
    console.log('✅ Dial swipe initialized');
}

// Switch between dial views
function switchDialView(index) {
    const wrapper = document.getElementById('dial-swipe-wrapper');
    const panels = document.querySelectorAll('.dial-swipe-panel');
    const indicators = document.querySelectorAll('.dial-indicator');
    
    if (!wrapper) return;
    
    // Update transform
    wrapper.style.transform = `translateX(-${index * 100}%)`;
    
    // Update active states
    panels.forEach(panel => panel.classList.remove('active'));
    indicators.forEach(ind => ind.classList.remove('active'));
    
    if (panels[index]) panels[index].classList.add('active');
    if (indicators[index]) indicators[index].classList.add('active');
    
    dialSwipeState.currentView = index;
    
    console.log(`🔄 Dial view: ${index === 0 ? "Today's High/Low" : "Next Tide"}`);
}

// Update next tide display with countdown
function updateNextTideDisplay(tideData) {
    if (!tideData) return;
    
    const typeElement = document.getElementById('next-tide-type');
    const heightElement = document.getElementById('next-tide-height');
    const countdownElement = document.getElementById('next-tide-countdown');
    
    if (!typeElement || !heightElement || !countdownElement) return;
    
    // Determine next tide (high or low)
    let nextTide = null;
    let tideType = '';
    
    // Use tide status to determine if rising (next is high) or falling (next is low)
    if (tideData.status && tideData.status.has_predictions !== false) {
        if (tideData.status.is_rising && tideData.next_high) {
            nextTide = tideData.next_high;
            tideType = 'High';
            typeElement.className = 'next-tide-type high';
        } else if (!tideData.status.is_rising && tideData.next_low) {
            nextTide = tideData.next_low;
            tideType = 'Low';
            typeElement.className = 'next-tide-type low';
        }
    }
    
    // Fallback: use whichever is sooner
    if (!nextTide && tideData.next_high && tideData.next_low) {
        const now = new Date();
        const highTime = new Date(tideData.next_high.time);
        const lowTime = new Date(tideData.next_low.time);
        
        if (highTime < lowTime) {
            nextTide = tideData.next_high;
            tideType = 'High';
            typeElement.className = 'next-tide-type high';
        } else {
            nextTide = tideData.next_low;
            tideType = 'Low';
            typeElement.className = 'next-tide-type low';
        }
    }
    
    // Update display
    if (nextTide) {
        typeElement.textContent = tideType;
        heightElement.textContent = `${nextTide.height} ft`;
        updateCountdown(nextTide.time);
    } else {
        typeElement.textContent = '--';
        heightElement.textContent = '--.- ft';
        countdownElement.textContent = 'in --h --m';
    }
}

// Update countdown timer
function updateCountdown(targetTimeString) {
    const countdownElement = document.getElementById('next-tide-countdown');
    if (!countdownElement || !targetTimeString) return;
    
    const now = new Date();
    const targetTime = new Date(targetTimeString);
    
    const diff = targetTime - now;
    
    if (diff <= 0) {
        countdownElement.textContent = 'now';
        return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        countdownElement.textContent = `in ${hours}h ${minutes}m`;
    } else {
        countdownElement.textContent = `in ${minutes}m`;
    }
}

// Start countdown update interval
function startCountdownTimer() {
    // Update countdown every 30 seconds
    setInterval(() => {
        if (state.tideData) {
            updateNextTideDisplay(state.tideData);
        }
    }, 30000);
    
    console.log('⏱️ Countdown timer started');
}

// ========================================

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
    
    // Update weather icon with emoji based on conditions
    const weatherIconElement = document.getElementById('weather-icon');
    if (weatherIconElement && weather.conditions) {
        const emoji = getWeatherEmoji(weather.conditions);
        weatherIconElement.textContent = emoji;
        console.log(`🌤️ Weather icon updated: ${weather.conditions} → ${emoji}`);
    }
    
    // Update wind speed and direction with rotation
    const windElement = document.getElementById('wind-speed');
    const windArrowElement = document.getElementById('wind-arrow');
    
    if (windElement) {
        if (weather.wind_speed && weather.wind_direction) {
            windElement.textContent = `${weather.wind_speed} ${weather.wind_direction}`;
        } else {
            windElement.textContent = '-- mph';
        }
    }
    
    // Rotate wind arrow based on direction
    if (windArrowElement && weather.wind_direction_degrees != null) {
        windArrowElement.style.transform = `rotate(${weather.wind_direction_degrees}deg)`;
    }
    
    // Update visibility with animated droplet fill
    const visibilityElement = document.getElementById('visibility');
    const visibilityFill = document.getElementById('visibility-fill');
    
    if (visibilityElement && weather.visibility) {
        visibilityElement.textContent = weather.visibility;
        
        // Animate the droplet fill based on visibility (0-10 miles)
        if (visibilityFill) {
            // Parse visibility value (e.g., "10.0 mi" -> 10.0)
            const visMatch = weather.visibility.match(/(\d+\.?\d*)/);
            const visValue = visMatch ? parseFloat(visMatch[0]) : 0;
            
            // Calculate percentage (0-10 miles = 0-100%)
            const percentage = Math.min(Math.max(visValue / 10, 0), 1); // Clamp between 0 and 1
            
            // Fill from bottom to top (viewBox height is 120)
            const fillHeight = percentage * 120;
            const fillY = 120 - fillHeight;
            
            visibilityFill.setAttribute('y', fillY);
            visibilityFill.setAttribute('height', fillHeight);
            
            console.log(`💧 Visibility: ${visValue} mi (${(percentage * 100).toFixed(0)}% fill)`);
        }
    } else if (visibilityElement) {
        visibilityElement.textContent = '-- mi';
        if (visibilityFill) {
            visibilityFill.setAttribute('y', 120);
            visibilityFill.setAttribute('height', 0);
        }
    }
}

// Map weather conditions to emoji icons
function getWeatherEmoji(conditions) {
    if (!conditions) return '☁️';
    
    const condition = conditions.toLowerCase();
    
    if (condition.includes('sunny') || condition.includes('clear')) {
        return '☀️';
    } else if (condition.includes('partly cloudy') || condition.includes('mostly sunny')) {
        return '⛅';
    } else if (condition.includes('mostly cloudy')) {
        return '☁️';
    } else if (condition.includes('cloudy') || condition.includes('overcast')) {
        return '☁️';
    } else if (condition.includes('rain') || condition.includes('shower') || condition.includes('drizzle')) {
        return '🌧️';
    } else if (condition.includes('storm') || condition.includes('thunder')) {
        return '⛈️';
    } else if (condition.includes('snow') || condition.includes('flurries')) {
        return '❄️';
    } else if (condition.includes('fog') || condition.includes('mist') || condition.includes('haze')) {
        return '🌫️';
    } else if (condition.includes('wind')) {
        return '💨';
    }
    
    return '☁️'; // default
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

async function loadMultiDayAstronomy(days = 5) {
    try {
        const response = await fetch(`${API_BASE}/api/astronomy/multi-day?days=${days}`);
        const result = await response.json();
        
        if (result.status === 'ok') {
            state.multiDayAstronomy = result.data;
            console.log(`🌙 Multi-day astronomy loaded: ${result.days} days`);
            
            // Recreate table if we have tide data
            if (state.tideData && state.tideData.predictions) {
                createTideTable(state.tideData.predictions);
            }
            
            return result.data;
        } else {
            console.error('Failed to load multi-day astronomy:', result.message);
            return null;
        }
    } catch (error) {
        console.error('Error loading multi-day astronomy:', error);
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
    
    // Update moon phase icon
    const moonPhaseElement = document.getElementById('moon-phase');
    if (moonPhaseElement && astro.moon_phase) {
        // Convert phase name to filename (e.g., "Waxing Crescent" -> "Waxing Crescent.svg")
        const filename = `${astro.moon_phase}.svg`;
        moonPhaseElement.src = `assets/${filename}`;
        moonPhaseElement.alt = astro.moon_phase;
    }
    
    console.log('✅ Astronomy displayed:', astro.sunrise, astro.sunset, 'Moon:', astro.moon_phase, astro.moon_emoji);
}

// Export functions for use in other scripts if needed
window.TideWatch = {
    updateTideDial,
    createTideChart,
    switchView,
    switchDialView,
    toggleTheme,
    state,
    dialSwipeState
};