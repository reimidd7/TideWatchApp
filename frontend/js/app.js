/**
 * TideWatch Frontend Application
 * Main JavaScript for tide visualization and data display
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const API_BASE = window.location.origin;

const REFRESH_INTERVALS = {
    TIDE: 360000,
    WEATHER: 600000,
    ASTRONOMY: 43200000,
    COUNTDOWN: 30000,
    CLOCK: 1000,
    NETWORK_CHECK: 60000
};

const SWIPE_THRESHOLD = 50;
const DIAL_SWIPE_THRESHOLD = 30;

const TIDE_DIAL = {
    CENTER_X: 120,
    CENTER_Y: 120,
    RADIUS: 80,
    MIN_PERCENTAGE: 0.01,
    SEGMENTS_BASE: 20,
    SEGMENTS_MULTIPLIER: 50
};

const CHART = {
    PADDING: { top: 22, right: 12, bottom: 26, left: 36 },
    MIN_POINTS: 2,
    CURVE_RESOLUTION: 0.025,
    LINE_WIDTH: 2.5,
    POINT_RADIUS: 5,
    LABEL_OFFSET: 20,
    GRID_STEP: 2.5
};

const WEATHER_EMOJI = {
    sunny: 'fa-sun',
    clear: 'fa-sun',
    'partly cloudy': 'fa-cloud-sun',
    'mostly sunny': 'fa-cloud-sun',
    'mostly cloudy': 'fa-cloud',
    cloudy: 'fa-cloud',
    overcast: 'fa-cloud',
    rain: 'fa-cloud-rain',
    shower: 'fa-cloud-showers-heavy',
    drizzle: 'fa-cloud-rain',
    storm: 'fa-cloud-bolt',
    thunder: 'fa-cloud-bolt',
    snow: 'fa-snowflake',
    flurries: 'fa-snowflake',
    fog: 'fa-smog',
    mist: 'fa-smog',
    haze: 'fa-smog',
    wind: 'fa-wind',
    default: 'fa-cloud'
};

const DIMMING = {
    TIMEOUT: 300000,
    FADE_DURATION: 1000
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const state = {
    config: null,
    currentView: 0,
    tideData: null,
    weatherData: null,
    astronomyData: null,
    lastUpdate: null,
    isConnected: false,
    networkOnline: true,
    theme: 'dark'
};

const dialSwipeState = {
    currentView: 0,
    startX: 0,
    currentX: 0,
    isDragging: false
};

let currentScale = 1;
let dimTimer = null;
let isDimmed = false;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🌊 TideWatch initializing...');
    
    initTheme();
    initDimming();
    setupEventListeners();
    setPlaceholders();
    initApp();
});

function setupEventListeners() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    const infoButton = document.getElementById('info-button');
    const infoModalOverlay = document.getElementById('info-modal-overlay');
    const infoModalClose = document.getElementById('info-modal-close');
    
    if (infoButton) {
        infoButton.addEventListener('click', openInfoModal);
    }
    
    if (infoModalClose) {
        infoModalClose.addEventListener('click', closeInfoModal);
    }
    
    if (infoModalOverlay) {
        infoModalOverlay.addEventListener('click', (e) => {
            if (e.target === infoModalOverlay) {
                closeInfoModal();
            }
        });
    }
    
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
        refreshButton.addEventListener('click', manualRefresh);
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeInfoModal();
        }
    });

}

async function initApp() {
    updateClock();
    setInterval(updateClock, REFRESH_INTERVALS.CLOCK);
    
    await loadConfig();
    await checkHealth();
    await checkNetworkConnectivity();
    
    initSwipe();
    startCountdownTimer();
    
    await Promise.all([
        loadWeatherData(),
        loadAstronomyData(),
        loadTideData()
    ]);
    
    setInterval(loadTideData, REFRESH_INTERVALS.TIDE);
    setInterval(loadAstronomyData, REFRESH_INTERVALS.ASTRONOMY);
    setInterval(loadWeatherData, REFRESH_INTERVALS.WEATHER);
    setInterval(checkNetworkConnectivity, REFRESH_INTERVALS.NETWORK_CHECK);
    
    scheduleMidnightRefresh();
    
    console.log('✅ TideWatch ready!');
}

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

function initTheme() {
    const savedTheme = localStorage.getItem('tidewatch-theme') || 'dark';
    state.theme = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon();
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('tidewatch-theme', state.theme);
    updateThemeIcon();
    
    if (state.tideData?.predictions) {
        createTideChart(state.tideData.predictions, state.tideData.current);
    }
    if (state.tideData?.status) {
        updateTideDial(state.tideData.status.percentage, state.tideData.status.is_rising);
    }
}

function updateThemeIcon() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) {
            icon.className = state.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
}

// ============================================================================
// AUTO-SCALING FOR FULLSCREEN
// ============================================================================

function scaleToFit() {
    const container = document.querySelector('.container');
    if (!container) return;
    
    const designWidth = 1024;
    const designHeight = 600;
    
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    const scaleX = windowWidth / designWidth;
    const scaleY = windowHeight / designHeight;
    const scale = Math.min(scaleX, scaleY);
    
    currentScale = scale;
    
    container.style.transform = `scale(${scale})`;
    
    console.log(`📐 Scaled to ${(scale * 100).toFixed(1)}% (${windowWidth}x${windowHeight} viewport)`);
    
    setTimeout(() => {
        if (typeof createTideChart === 'function' && state?.tideData?.predictions) {
            createTideChart(state.tideData.predictions, state.tideData.current);
        }
    }, 100);
}

function getScreenInfo() {
    const physicalWidth = 236;
    const physicalHeight = 145;
    
    const screenWidthPx = window.screen.width;
    const screenHeightPx = window.screen.height;
    
    const ppiX = screenWidthPx / (physicalWidth / 25.4);
    const ppiY = screenHeightPx / (physicalHeight / 25.4);
    
    console.log(`📺 Screen: ${screenWidthPx}x${screenHeightPx}px`);
    console.log(`📏 Physical: ${physicalWidth}x${physicalHeight}mm`);
    console.log(`📐 PPI: ${ppiX.toFixed(0)} x ${ppiY.toFixed(0)}`);
    
    return { ppiX, ppiY, screenWidthPx, screenHeightPx };
}

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(scaleToFit, 100);
});

window.addEventListener('load', () => {
    getScreenInfo();
    setTimeout(scaleToFit, 100);
});

// ============================================================================
// SCREEN DIMMING - NOW USES ELEMENT INSIDE CONTAINER
// ============================================================================

function initDimming() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
        document.addEventListener(event, resetDimTimer, { passive: true });
    });
    
    resetDimTimer();
    console.log('🌙 Screen dimming initialized (5 min timeout)');
}

function dimScreen() {
    const overlay = document.getElementById('dim-overlay');
    if (overlay && !isDimmed) {
        overlay.style.background = 'rgba(0, 0, 0, 0.7)';
        isDimmed = true;
        console.log('🌙 Screen dimmed');
    }
}

function brightenScreen() {
    const overlay = document.getElementById('dim-overlay');
    if (overlay && isDimmed) {
        overlay.style.background = 'rgba(0, 0, 0, 0)';
        isDimmed = false;
        console.log('☀️ Screen brightened');
    }
}

function resetDimTimer() {
    brightenScreen();
    
    if (dimTimer) {
        clearTimeout(dimTimer);
    }
    
    dimTimer = setTimeout(dimScreen, DIMMING.TIMEOUT);
}

// ============================================================================
// NETWORK CONNECTIVITY CHECK
// ============================================================================

async function checkNetworkConnectivity() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        await fetch('https://www.google.com/favicon.ico', {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        state.networkOnline = true;
        updateNetworkStatus(true);
        return true;
    } catch (error) {
        state.networkOnline = false;
        updateNetworkStatus(false);
        console.error('Network check failed:', error);
        return false;
    }
}

function updateNetworkStatus(isOnline) {
    const networkStatus = document.getElementById('network-status');
    if (networkStatus) {
        if (isOnline) {
            networkStatus.innerHTML = '<i class="fas fa-wifi"></i> Network OK';
            networkStatus.style.color = '';
        } else {
            networkStatus.innerHTML = '<i class="fas fa-wifi" style="text-decoration: line-through;"></i> No Internet';
            networkStatus.style.color = '#D95E5E';
        }
    }
}

// ============================================================================
// MANUAL REFRESH FUNCTIONALITY
// ============================================================================

async function manualRefresh() {
    const refreshButton = document.getElementById('refresh-button');
    
    if (refreshButton) {
        refreshButton.classList.add('spinning');
    }
    
    console.log('🔄 Manual refresh triggered');
    
    const networkOk = await checkNetworkConnectivity();
    
    if (!networkOk) {
        console.warn('⚠️ No internet connection');
        if (refreshButton) {
            setTimeout(() => refreshButton.classList.remove('spinning'), 1000);
        }
        return;
    }
    
    await Promise.all([
        loadConfig(),
        loadWeatherData(),
        loadAstronomyData(),
        loadTideData()
    ]);
    
    if (refreshButton) {
        setTimeout(() => refreshButton.classList.remove('spinning'), 1000);
    }
    
    console.log('✅ Manual refresh complete');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    
    updateElement('current-time', timeString);
}

function formatTime(timeString) {
    if (!timeString) return '--:--';
    if (timeString.includes('AM') || timeString.includes('PM')) return timeString;
    
    try {
        const date = new Date(timeString);
        if (isNaN(date.getTime())) return '--:--';
        
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch (e) {
        return '--:--';
    }
}

function getCSSVar(varName) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();
}

function hexToRgba(hex, alpha) {
    if (!hex || hex[0] !== '#') return `rgba(128,128,128,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function updateElement(id, content) {
    const element = document.getElementById(id);
    if (element) element.textContent = content;
}

function updateConnectionStatus(isConnected) {
    state.isConnected = isConnected;
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        const icon = statusEl.querySelector('i');
        if (icon) {
            icon.style.color = isConnected ? '#00D1B2' : '#D95E5E';
        }
        statusEl.innerHTML = `<i class="fas fa-circle status-indicator" style="color: ${isConnected ? '#00D1B2' : '#D95E5E'}"></i> ${isConnected ? 'Connected' : 'Disconnected'}`;
    }
    
    if (!isConnected) {
        updateElement('last-update', 'Connection Lost');
    }
}

function updateLastUpdateTime() {
    state.lastUpdate = new Date();
    const timeStr = state.lastUpdate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
    updateElement('last-update', `Updated: ${timeStr}`);
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE}/api/config`);
        const data = await response.json();
        state.config = data;
        
        updateElement('location-name', data.location?.name);
        console.log('📍 Location loaded:', data.location?.name);
    } catch (error) {
        console.error('❌ Failed to load config:', error);
        updateConnectionStatus(false);
    }
}

async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE}/api/health`);
        const data = await response.json();
        
        updateConnectionStatus(data.status === 'ok');
        if (data.status === 'ok') {
            console.log('💚 Server healthy');
        }
    } catch (error) {
        console.error('❌ Health check failed:', error);
        updateConnectionStatus(false);
    }
}

async function loadTideData() {
    try {
        const response = await fetch(`${API_BASE}/api/tide`);
        const result = await response.json();
        
        if (result.status === 'ok') {
            state.tideData = result.data;
            state.isConnected = true;
            console.log('🌊 Tide data loaded:', result.data);
            
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

async function loadWeatherData() {
    try {
        const response = await fetch(`${API_BASE}/api/weather`);
        const data = await response.json();
        
        if (data.status === 'ok') {
            state.weatherData = data;
            displayWeather(data);
            updateLastUpdateTime();
            return data;
        }
        
        console.error('Failed to load weather data');
        setWeatherPlaceholders();
        return null;
    } catch (error) {
        console.error('Failed to load weather data:', error);
        setWeatherPlaceholders();
        return null;
    }
}

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
        }
        
        console.error('Failed to load astronomy data');
        setAstronomyPlaceholders();
        return null;
    } catch (error) {
        console.error('Failed to load astronomy data:', error);
        setAstronomyPlaceholders();
        return null;
    }
}

// ============================================================================
// PLACEHOLDER FUNCTIONS
// ============================================================================

function setPlaceholders() {
    updateElement('current-height', '--.- ft');
    updateElement('next-high', ' --:--');
    updateElement('next-low', ' --:--');
    updateElement('high-time-display', '--:--');
    updateElement('low-time-display', '--:--');
    updateElement('today-high', '--.-');
    updateElement('today-low', '--.-');
    updateElement('next-tide-type', '--');
    updateElement('next-tide-height', '--.- ft');
    updateElement('next-tide-countdown', 'in --h --m');
    
    updateElement('weather-temp', '--°F');
    updateElement('wind-speed', '-- mph');
    updateElement('visibility', '-- mi');
    
    updateElement('sunrise', '--:--');
    updateElement('sunset', '--:--');
    updateElement('moon-rise', '--:--');
    updateElement('moon-set', '--:--');
    
    updateElement('last-update', 'Connecting...');
}

function setTidePlaceholders() {
    setPlaceholders();
    
    const canvas = document.getElementById('tide-chart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    const tableDiv = document.getElementById('tide-table');
    if (tableDiv) {
        tableDiv.innerHTML = '<p style="text-align: center; padding: 2rem;">No tide data available</p>';
    }
}

function setWeatherPlaceholders() {
    updateElement('weather-temp', '--°F');
    updateElement('wind-speed', '-- mph');
    updateElement('visibility', '-- mi');
}

function setAstronomyPlaceholders() {
    updateElement('sunrise', '--:--');
    updateElement('sunset', '--:--');
    updateElement('moon-rise', '--:--');
    updateElement('moon-set', '--:--');
}

// ============================================================================
// TIDE DISPLAY FUNCTIONS
// ============================================================================

function displayTideData(tideData) {
    if (!tideData) {
        setTidePlaceholders();
        return;
    }
    
    const heightText = tideData.current?.height != null 
        ? `${tideData.current.height} ft` 
        : '--.- ft';
    updateElement('current-height', heightText);
    
    if (tideData.next_high) {
        const highTime = tideData.next_high.time_12hr || formatTime(tideData.next_high.time);
        updateElement('next-high', highTime);
        updateElement('high-time-display', highTime);
    } else {
        updateElement('next-high', ' --:--');
        updateElement('high-time-display', '--:--');
    }
    
    if (tideData.next_low) {
        const lowTime = tideData.next_low.time_12hr || formatTime(tideData.next_low.time);
        updateElement('next-low', lowTime);
        updateElement('low-time-display', lowTime);
    } else {
        updateElement('next-low', ' --:--');
        updateElement('low-time-display', '--:--');
    }
    
    if (tideData.predictions?.length > 0) {
        displayTodaysHighLow(tideData.predictions);
    }
    
    if (tideData.status?.has_predictions !== false) {
        updateTideDial(tideData.status.percentage, tideData.status.is_rising);
    } else {
        const arc = document.getElementById('tide-arc');
        if (arc) arc.setAttribute('d', '');
    }
    
    if (tideData.predictions?.length > 0) {
        createTideChart(tideData.predictions, tideData.current);
        createTideTable(tideData.predictions);
    }
    
    updateNextTideDisplay(tideData);
    
    console.log('✅ Tide data displayed');
}

function displayTodaysHighLow(predictions) {
    if (!predictions?.length) {
        updateElement('today-high', ' --.-');
        updateElement('today-low', ' --.-');
        return;
    }
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    
    const todaysPredictions = predictions.filter(pred => {
        const predTime = new Date(pred.time);
        return predTime >= todayStart && predTime < todayEnd;
    });
    
    if (!todaysPredictions.length) {
        updateElement('today-high', ' --.-');
        updateElement('today-low', ' --.-');
        return;
    }
    
    const highs = todaysPredictions.filter(p => p.type === 'H');
    const lows = todaysPredictions.filter(p => p.type === 'L');
    
    const highestHigh = highs.length > 0 
        ? Math.max(...highs.map(h => h.height)).toFixed(1) 
        : '--.-';
    const lowestLow = lows.length > 0 
        ? Math.min(...lows.map(l => l.height)).toFixed(1) 
        : '--.-';
    
    updateElement('today-high', highestHigh);
    updateElement('today-low', lowestLow);
    
    console.log(`Today's tides - High: ${highestHigh}ft, Low: ${lowestLow}ft`);
}

function updateNextTideDisplay(tideData) {
    if (!tideData) return;
    
    const typeElement = document.getElementById('next-tide-type');
    const heightElement = document.getElementById('next-tide-height');
    const countdownElement = document.getElementById('next-tide-countdown');
    
    if (!typeElement || !heightElement || !countdownElement) return;
    
    let nextTide = null;
    let tideType = '';
    
    if (tideData.status?.has_predictions !== false) {
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
    
    countdownElement.textContent = hours > 0 
        ? `in ${hours}h ${minutes}m` 
        : `in ${minutes}m`;
}

function startCountdownTimer() {
    setInterval(() => {
        if (state.tideData) {
            updateNextTideDisplay(state.tideData);
        }
    }, REFRESH_INTERVALS.COUNTDOWN);
    
    console.log('⏱️ Countdown timer started');
}

// ============================================================================
// TIDE DIAL VISUALIZATION
// ============================================================================

function updateTideDial(percentage, isRising) {
    const arc = document.getElementById('tide-arc');
    if (!arc) return;
    
    if (percentage < TIDE_DIAL.MIN_PERCENTAGE) {
        arc.setAttribute('d', '');
        return;
    }
    
    percentage = Math.max(0, Math.min(1, percentage));
    
    arc.setAttribute('stroke', isRising 
        ? 'url(#tideGradientRising)' 
        : 'url(#tideGradientFalling)');
    
    const toRad = (deg) => (deg * Math.PI) / 180;
    const numSegments = Math.max(
        TIDE_DIAL.SEGMENTS_BASE, 
        Math.floor(percentage * TIDE_DIAL.SEGMENTS_MULTIPLIER)
    );
    const totalAngle = percentage * 180;
    
    let pathData = '';
    
    for (let i = 0; i <= numSegments; i++) {
        const progress = i / numSegments;
        const angle = isRising 
            ? 90 + (progress * totalAngle)
            : 270 + (progress * totalAngle);
        
        const x = TIDE_DIAL.CENTER_X + TIDE_DIAL.RADIUS * Math.cos(toRad(angle));
        const y = TIDE_DIAL.CENTER_Y + TIDE_DIAL.RADIUS * Math.sin(toRad(angle));
        
        pathData += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    arc.setAttribute('d', pathData);
    
    console.log(`Tide dial: ${isRising ? 'Rising' : 'Falling'} ${(percentage * 100).toFixed(1)}%`);
}

// ============================================================================
// TIDE CHART VISUALIZATION
// ============================================================================

function createTideChart(predictions, currentLevel) {
    const canvas = document.getElementById('tide-chart');
    if (!canvas) return;
    
    const container = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    
    const width = container.offsetWidth || 700;
    const height = container.offsetHeight || 180;
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    
    const padding = CHART.PADDING;
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    
    const colors = {
        accent: getCSSVar('--color-accent'),
        highTide: getCSSVar('--color-high-tide'),
        lowTide: getCSSVar('--color-low-tide'),
        text: getCSSVar('--color-text'),
        textDim: getCSSVar('--color-text-dim'),
        border: getCSSVar('--color-border'),
        turquoise: getCSSVar('--color-turquoise')
    };
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const tomorrowEnd = new Date(todayEnd.getTime() + 86400000);
    
    const sortedPredictions = [...predictions].sort((a, b) => 
        new Date(a.time) - new Date(b.time)
    );
    
    const filterByRange = (start, end) => sortedPredictions.filter(p => {
        const t = new Date(p.time);
        return t >= start && t < end;
    });
    
    const yesterdayTides = filterByRange(yesterdayStart, todayStart);
    const todayTides = filterByRange(todayStart, todayEnd);
    const tomorrowTides = filterByRange(todayEnd, tomorrowEnd);
    
    const allTides = [];
    if (yesterdayTides.length > 0) {
        allTides.push({ ...yesterdayTides[yesterdayTides.length - 1], isToday: false });
    }
    todayTides.forEach(t => allTides.push({ ...t, isToday: true }));
    if (tomorrowTides.length > 0) {
        allTides.push({ ...tomorrowTides[0], isToday: false });
    }
    
    if (allTides.length < CHART.MIN_POINTS) {
        ctx.fillStyle = colors.textDim;
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Insufficient tide data', width / 2, height / 2);
        return;
    }
    
    const heights = allTides.map(p => p.height);
    const minH = Math.floor(Math.min(...heights) - 1);
    const maxH = Math.ceil(Math.max(...heights) + 1);
    const hRange = maxH - minH;
    
    const hoursToX = (hrs) => padding.left + (hrs / 24) * chartW;
    const heightToY = (h) => padding.top + (1 - (h - minH) / hRange) * chartH;
    
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
    
    ctx.strokeStyle = hexToRgba(colors.border, 0.2);
    ctx.lineWidth = 1;
    for (let h = minH; h <= maxH; h += CHART.GRID_STEP) {
        const y = heightToY(h);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
    }
    
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
    
    const curvePoints = [];
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        
        for (let t = 0; t < 1; t += CHART.CURVE_RESOLUTION) {
            curvePoints.push({
                x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
                y: catmullRom(p0.y, p1.y, p2.y, p3.y, t)
            });
        }
    }
    curvePoints.push(points[points.length - 1]);
    
    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, chartW, chartH);
    ctx.clip();
    
    ctx.beginPath();
    ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
    for (let i = 1; i < curvePoints.length; i++) {
        ctx.lineTo(curvePoints[i].x, curvePoints[i].y);
    }
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = CHART.LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    points.forEach(pt => {
        if (!pt.isToday) return;
        
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, CHART.POINT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = pt.type === 'H' ? colors.highTide : colors.lowTide;
        ctx.fill();
        
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = pt.type === 'H' ? 'bottom' : 'top';
        const labelY = pt.type === 'H' ? pt.y + CHART.LABEL_OFFSET : pt.y - CHART.LABEL_OFFSET;
        ctx.fillText(pt.height.toFixed(2), pt.x, labelY);
    });
    
    const currentHours = now.getHours() + now.getMinutes() / 60;
    const currentX = hoursToX(currentHours);
    
    ctx.strokeStyle = colors.turquoise;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(currentX, padding.top);
    ctx.lineTo(currentX, padding.top + chartH);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.restore();
    
    ctx.fillStyle = colors.textDim;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let h = minH; h <= maxH; h += CHART.GRID_STEP) {
        ctx.fillText(h.toFixed(1), padding.left - 8, heightToY(h));
    }
    
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

// ============================================================================
// TIDE TABLE
// ============================================================================

function createTideTable(predictions) {
    const tableDiv = document.getElementById('tide-table');
    if (!tableDiv) return;
    
    const dayGroups = {};
    predictions.forEach(pred => {
        const predDate = new Date(pred.time);
        const dateKey = `${predDate.getFullYear()}-${String(predDate.getMonth() + 1).padStart(2, '0')}-${String(predDate.getDate()).padStart(2, '0')}`;
        
        if (!dayGroups[dateKey]) {
            dayGroups[dateKey] = { date: predDate, tides: [] };
        }
        dayGroups[dateKey].tides.push(pred);
    });
    
    Object.values(dayGroups).forEach(day => {
        day.tides.sort((a, b) => new Date(a.time) - new Date(b.time));
    });
    
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
    
    const sortedDays = Object.keys(dayGroups).sort().slice(0, 5);
    
    sortedDays.forEach(dateKey => {
        const day = dayGroups[dateKey];
        const date = day.date;
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        html += `<tr>
            <td class="date-cell">
                <div class="date-info">
                    <div class="day-name">${dayName}</div>
                    <div class="month-day">${monthDay}</div>
                </div>
            </td>`;
        
        for (let i = 0; i < 4; i++) {
            if (i < day.tides.length) {
                const tide = day.tides[i];
                const isHigh = tide.type === 'H';
                const tideClass = isHigh ? 'high-tide' : 'low-tide';
                const tideIcon = isHigh ? '▲' : '▼';
                
                html += `
                    <td class="tide-cell ${tideClass}">
                        <div class="tide-time"><span class="tide-icon">${tideIcon}</span> ${tide.height}ft ${tide.time_12hr || formatTime(tide.time)}</div>
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

function scheduleMidnightRefresh() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow - now;
    
    console.log(`⏰ Next table refresh at midnight (in ${Math.round(msUntilMidnight / 1000 / 60)} minutes)`);
    
    setTimeout(() => {
        console.log('🔄 Midnight refresh - reloading tide data');
        loadTideData();
        scheduleMidnightRefresh();
    }, msUntilMidnight);
}

// ============================================================================
// WEATHER DISPLAY
// ============================================================================

function displayWeather(weatherData) {
    if (!weatherData?.data) {
        setWeatherPlaceholders();
        return;
    }
    
    const weather = weatherData.data;
    
    const tempText = weather.temperature != null 
        ? `${weather.temperature}°${weather.temperature_unit || 'F'}` 
        : '--°F';
    updateElement('weather-temp', tempText);
    
    const weatherIconElement = document.getElementById('weather-icon');
    if (weatherIconElement && weather.conditions) {
        const iconClass = getWeatherEmoji(weather.conditions);
        weatherIconElement.innerHTML = `<i class="fas ${iconClass}"></i>`;
    }
    
    const windText = weather.wind_speed && weather.wind_direction
        ? `${weather.wind_speed} ${weather.wind_direction}`
        : '-- mph';
    updateElement('wind-speed', windText);
    
    const windArrowElement = document.getElementById('wind-arrow');
    if (windArrowElement && weather.wind_direction_degrees != null) {
        windArrowElement.style.transform = `rotate(${weather.wind_direction_degrees}deg)`;
    }
    
    updateElement('visibility', weather.visibility || '-- mi');
    
    const visibilityFill = document.getElementById('visibility-fill');
    if (visibilityFill && weather.visibility) {
        const visMatch = weather.visibility.match(/(\d+\.?\d*)/);
        const visValue = visMatch ? parseFloat(visMatch[0]) : 0;
        const percentage = Math.min(Math.max(visValue / 10, 0), 1);
        const fillHeight = percentage * 120;
        const fillY = 120 - fillHeight;
        
        visibilityFill.setAttribute('y', fillY);
        visibilityFill.setAttribute('height', fillHeight);
    }
}

function getWeatherEmoji(conditions) {
    if (!conditions) return WEATHER_EMOJI.default;
    
    const condition = conditions.toLowerCase();
    
    for (const [key, iconClass] of Object.entries(WEATHER_EMOJI)) {
        if (key !== 'default' && condition.includes(key)) {
            return iconClass;
        }
    }
    
    return WEATHER_EMOJI.default;
}

// ============================================================================
// ASTRONOMY DISPLAY
// ============================================================================

function displayAstronomy(astronomyData) {
    if (!astronomyData?.data) {
        setAstronomyPlaceholders();
        return;
    }
    
    const astro = astronomyData.data;
    
    updateElement('sunrise', astro.sunrise || '--:--');
    updateElement('sunset', astro.sunset || '--:--');
    updateElement('moon-rise', astro.moonrise || '--:--');
    updateElement('moon-set', astro.moonset || '--:--');
    
    const moonPhaseElement = document.getElementById('moon-phase');
    if (moonPhaseElement && astro.moon_phase) {
        const filename = `${astro.moon_phase}.svg`;
        moonPhaseElement.src = `assets/${filename}`;
        moonPhaseElement.alt = astro.moon_phase;
    }
    
    console.log('✅ Astronomy displayed:', astro.sunrise, astro.sunset, 'Moon:', astro.moon_phase);
}

// ============================================================================
// SWIPE INTERACTIONS
// ============================================================================

function initSwipe() {
    const container = document.getElementById('swipe-container');
    const indicators = document.querySelectorAll('.indicator');
    
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => switchView(index));
    });
    
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    
    const startDrag = (x) => {
        startX = x;
        isDragging = true;
    };
    
    const moveDrag = (x) => {
        if (isDragging) currentX = x;
    };
    
    const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        
        const diff = startX - currentX;
        if (Math.abs(diff) > SWIPE_THRESHOLD) {
            if (diff > 0 && state.currentView < 1) {
                switchView(state.currentView + 1);
            } else if (diff < 0 && state.currentView > 0) {
                switchView(state.currentView - 1);
            }
        }
    };
    
    container.addEventListener('mousedown', (e) => startDrag(e.clientX));
    container.addEventListener('touchstart', (e) => startDrag(e.touches[0].clientX));
    container.addEventListener('mousemove', (e) => moveDrag(e.clientX));
    container.addEventListener('touchmove', (e) => moveDrag(e.touches[0].clientX));
    container.addEventListener('mouseup', endDrag);
    container.addEventListener('touchend', endDrag);
    container.addEventListener('mouseleave', endDrag);
}

function switchView(index) {
    const panels = document.querySelectorAll('.swipe-panel');
    const indicators = document.querySelectorAll('.indicator');
    
    panels.forEach(panel => panel.classList.remove('active'));
    indicators.forEach(ind => ind.classList.remove('active'));
    
    panels[index].classList.add('active');
    indicators[index].classList.add('active');
    state.currentView = index;
    
    if (index === 0 && state.tideData) {
        setTimeout(() => {
            createTideChart(state.tideData.predictions, state.tideData.current);
        }, 100);
    }
}

// ============================================================================
// INFO MODAL
// ============================================================================

function openInfoModal() {
    const modal = document.getElementById('info-modal-overlay');
    if (modal) {
        modal.classList.add('active');
        populateInfoModal();
    }
}

function closeInfoModal() {
    const modal = document.getElementById('info-modal-overlay');
    if (modal) {
        modal.classList.remove('active');
    }
}

function populateInfoModal() {
    if (state.config?.location) {
        const loc = state.config.location;
        updateElement('info-location-name', loc.name || 'Unknown');
        updateElement('info-coordinates', 
            `${loc.latitude?.toFixed(4)}°, ${loc.longitude?.toFixed(4)}°`);
    }
    
    if (state.config?.location?.station_id) {
        const stationId = state.config.location.station_id;
        const obsStation = state.config.location.observation_station;
        
        if (stationId === obsStation) {
            updateElement('info-tide-station', `NOAA ${stationId}`);
        } else {
            updateElement('info-tide-station', 
                `NOAA ${stationId} (pred) / ${obsStation} (obs)`);
        }
    }
    
    if (state.lastUpdate) {
        const timeStr = state.lastUpdate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const dateStr = state.lastUpdate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        updateElement('info-last-update', `${dateStr} at ${timeStr}`);
    }
}

// ============================================================================
// EXPORT
// ============================================================================

window.TideWatch = {
    updateTideDial,
    createTideChart,
    switchView,
    toggleTheme,
    manualRefresh,
    checkNetworkConnectivity,
    dimScreen,
    brightenScreen,
    openInfoModal,
    closeInfoModal,
    scaleToFit,
    getScreenInfo,
    state
};