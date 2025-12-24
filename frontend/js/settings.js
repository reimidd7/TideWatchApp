/**
 * TideWatch Settings & WiFi Management
 * Handles WiFi scanning, connection, and system controls
 */

// ============================================================================
// SETTINGS STATE
// ============================================================================

const settingsState = {
    currentTab: 'wifi',
    wifiStatus: null,
    availableNetworks: [],
    isScanning: false,
    isConnecting: false,
    selectedNetwork: null
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initSettingsModal();
    initWiFiHandlers();
    initSystemHandlers();
});

function initSettingsModal() {
    const settingsButton = document.getElementById('settings-button');
    const settingsOverlay = document.getElementById('settings-modal-overlay');
    const settingsClose = document.getElementById('settings-modal-close');
    const tabs = document.querySelectorAll('.settings-tab');
    
    if (settingsButton) {
        settingsButton.addEventListener('click', openSettingsModal);
    }
    
    if (settingsClose) {
        settingsClose.addEventListener('click', closeSettingsModal);
    }
    
    if (settingsOverlay) {
        settingsOverlay.addEventListener('click', (e) => {
            if (e.target === settingsOverlay) {
                closeSettingsModal();
            }
        });
    }
    
    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchSettingsTab(tabName);
        });
    });
    
    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSettingsModal();
            closePasswordDialog();
        }
    });
}

function openSettingsModal() {
    const modal = document.getElementById('settings-modal-overlay');
    if (modal) {
        modal.classList.add('active');
        loadWiFiStatus();
        loadSystemInfo();
    }
}

function closeSettingsModal() {
    const modal = document.getElementById('settings-modal-overlay');
    if (modal) {
        modal.classList.remove('active');
    }
}

function switchSettingsTab(tabName) {
    const tabs = document.querySelectorAll('.settings-tab');
    const panels = document.querySelectorAll('.settings-panel');
    
    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    panels.forEach(panel => {
        panel.classList.toggle('active', panel.id === `${tabName}-panel`);
    });
    
    settingsState.currentTab = tabName;
    
    // Load data for the active tab
    if (tabName === 'wifi') {
        loadWiFiStatus();
    } else if (tabName === 'system') {
        loadSystemInfo();
    }
}

// ============================================================================
// WIFI HANDLERS
// ============================================================================

function initWiFiHandlers() {
    const refreshBtn = document.getElementById('wifi-refresh-status');
    const scanBtn = document.getElementById('wifi-scan-btn');
    const cancelBtn = document.getElementById('wifi-connect-cancel');
    const submitBtn = document.getElementById('wifi-connect-submit');
    const togglePwdBtn = document.getElementById('wifi-toggle-password');
    const passwordInput = document.getElementById('wifi-password-input');
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadWiFiStatus);
    }
    
    if (scanBtn) {
        scanBtn.addEventListener('click', scanWiFiNetworks);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closePasswordDialog);
    }
    
    if (submitBtn) {
        submitBtn.addEventListener('click', submitWiFiConnection);
    }
    
    if (togglePwdBtn && passwordInput) {
        togglePwdBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            togglePwdBtn.innerHTML = `<i class="fas fa-eye${isPassword ? '-slash' : ''}"></i>`;
        });
    }
    
    // Submit on Enter in password field
    if (passwordInput) {
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                submitWiFiConnection();
            }
        });
    }
}

async function loadWiFiStatus() {
    const container = document.getElementById('wifi-current-info');
    if (!container) return;
    
    container.innerHTML = `
        <div class="wifi-status-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Checking connection...</span>
        </div>
    `;
    
    try {
        const response = await fetch('/api/wifi/status');
        const result = await response.json();
        
        if (result.status === 'ok') {
            settingsState.wifiStatus = result.data;
            renderWiFiStatus(result.data);
        } else {
            container.innerHTML = `
                <div class="wifi-disconnected">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Error: ${result.message}</span>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load WiFi status:', error);
        container.innerHTML = `
            <div class="wifi-disconnected">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Failed to check WiFi status</span>
            </div>
        `;
    }
}

function renderWiFiStatus(status) {
    const container = document.getElementById('wifi-current-info');
    if (!container) return;
    
    if (status.connected) {
        const signalBars = getSignalBars(status.signal_percent || 0);
        
        container.innerHTML = `
            <div class="wifi-connected">
                <div class="wifi-connected-icon">
                    <i class="fas fa-wifi"></i>
                </div>
                <div class="wifi-connected-details">
                    <div class="wifi-ssid">${escapeHtml(status.ssid)}</div>
                    <div class="wifi-ip">${status.ip_address || 'Getting IP...'}</div>
                </div>
                <div class="wifi-signal-bar">
                    ${signalBars}
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="wifi-disconnected">
                <i class="fas fa-wifi-slash"></i>
                <span>Not connected to WiFi</span>
            </div>
        `;
    }
}

function getSignalBars(percent) {
    const bars = [
        { height: 6, threshold: 1 },
        { height: 10, threshold: 25 },
        { height: 16, threshold: 50 },
        { height: 24, threshold: 75 }
    ];
    
    return bars.map(bar => {
        const active = percent >= bar.threshold ? 'active' : '';
        return `<span style="height: ${bar.height}px" class="${active}"></span>`;
    }).join('');
}

async function scanWiFiNetworks() {
    const listContainer = document.getElementById('wifi-networks-list');
    const scanBtn = document.getElementById('wifi-scan-btn');
    
    if (!listContainer || settingsState.isScanning) return;
    
    settingsState.isScanning = true;
    
    if (scanBtn) {
        scanBtn.disabled = true;
        scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
    }
    
    listContainer.innerHTML = `
        <div class="wifi-status-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Scanning for networks...</span>
        </div>
    `;
    
    try {
        const response = await fetch('/api/wifi/scan');
        const result = await response.json();
        
        if (result.status === 'ok') {
            settingsState.availableNetworks = result.data;
            renderNetworksList(result.data);
        } else {
            listContainer.innerHTML = `
                <div class="wifi-status-loading">
                    <span>Scan failed: ${result.message}</span>
                </div>
            `;
        }
    } catch (error) {
        console.error('WiFi scan failed:', error);
        listContainer.innerHTML = `
            <div class="wifi-status-loading">
                <span>Failed to scan networks</span>
            </div>
        `;
    } finally {
        settingsState.isScanning = false;
        if (scanBtn) {
            scanBtn.disabled = false;
            scanBtn.innerHTML = '<i class="fas fa-search"></i> Scan';
        }
    }
}

function renderNetworksList(networks) {
    const container = document.getElementById('wifi-networks-list');
    if (!container) return;
    
    if (!networks || networks.length === 0) {
        container.innerHTML = `
            <div class="wifi-status-loading">
                <span>No networks found</span>
            </div>
        `;
        return;
    }
    
    const currentSSID = settingsState.wifiStatus?.ssid;
    
    container.innerHTML = networks.map(network => {
        const isConnected = network.ssid === currentSSID && settingsState.wifiStatus?.connected;
        const signalIcon = getSignalIcon(network.signal_percent);
        const lockIcon = network.secured ? '<i class="fas fa-lock"></i>' : '';
        
        return `
            <div class="wifi-network-item ${isConnected ? 'connected' : ''}" 
                 data-ssid="${escapeHtml(network.ssid)}"
                 data-secured="${network.secured}">
                <div class="wifi-network-icon">
                    <i class="fas ${signalIcon}"></i>
                </div>
                <div class="wifi-network-info">
                    <div class="wifi-network-name">${escapeHtml(network.ssid)}</div>
                    <div class="wifi-network-security">${network.security} ${lockIcon}</div>
                </div>
                <div class="wifi-network-signal">${network.signal_percent}%</div>
            </div>
        `;
    }).join('');
    
    // Add click handlers
    container.querySelectorAll('.wifi-network-item').forEach(item => {
        item.addEventListener('click', () => {
            const ssid = item.dataset.ssid;
            const secured = item.dataset.secured === 'true';
            handleNetworkClick(ssid, secured);
        });
    });
}

function getSignalIcon(percent) {
    if (percent >= 75) return 'fa-wifi';
    if (percent >= 50) return 'fa-wifi';
    if (percent >= 25) return 'fa-wifi';
    return 'fa-wifi';
}

function handleNetworkClick(ssid, secured) {
    const currentSSID = settingsState.wifiStatus?.ssid;
    
    // If already connected to this network, do nothing
    if (ssid === currentSSID && settingsState.wifiStatus?.connected) {
        return;
    }
    
    settingsState.selectedNetwork = { ssid, secured };
    
    if (secured) {
        openPasswordDialog(ssid);
    } else {
        connectToNetwork(ssid, null);
    }
}

function openPasswordDialog(ssid) {
    const dialog = document.getElementById('wifi-password-dialog');
    const ssidSpan = document.getElementById('wifi-connect-ssid');
    const passwordInput = document.getElementById('wifi-password-input');
    
    if (dialog && ssidSpan && passwordInput) {
        ssidSpan.textContent = ssid;
        passwordInput.value = '';
        passwordInput.type = 'password';
        dialog.classList.add('active');
        passwordInput.focus();
        
        // Show on-screen keyboard
        fetch('/api/keyboard/show', { method: 'POST' });
    }
}

function closePasswordDialog() {
    const dialog = document.getElementById('wifi-password-dialog');
    if (dialog) {
        dialog.classList.remove('active');
    }
    settingsState.selectedNetwork = null;
    
    // Hide on-screen keyboard
    fetch('/api/keyboard/hide', { method: 'POST' });
}

async function submitWiFiConnection() {
    const passwordInput = document.getElementById('wifi-password-input');
    const password = passwordInput?.value || '';
    
    if (!settingsState.selectedNetwork) return;
    
    const { ssid, secured } = settingsState.selectedNetwork;
    
    if (secured && !password) {
        alert('Please enter a password');
        return;
    }
    
    // Hide keyboard before connecting
    fetch('/api/keyboard/hide', { method: 'POST' });
    
    closePasswordDialog();
    await connectToNetwork(ssid, password);
}

async function connectToNetwork(ssid, password) {
    const listContainer = document.getElementById('wifi-networks-list');
    
    if (settingsState.isConnecting) return;
    
    settingsState.isConnecting = true;
    
    // Show connecting status
    if (listContainer) {
        listContainer.innerHTML = `
            <div class="wifi-status-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Connecting to ${escapeHtml(ssid)}...</span>
            </div>
        `;
    }
    
    try {
        const response = await fetch('/api/wifi/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ssid, password })
        });
        
        const result = await response.json();
        
        if (result.status === 'ok') {
            // Refresh status
            await loadWiFiStatus();
            await scanWiFiNetworks();
            
            // Update network connectivity check
            if (typeof checkNetworkConnectivity === 'function') {
                checkNetworkConnectivity();
            }
        } else {
            alert(`Connection failed: ${result.message}`);
            await scanWiFiNetworks();
        }
    } catch (error) {
        console.error('Connection error:', error);
        alert('Failed to connect to network');
        await scanWiFiNetworks();
    } finally {
        settingsState.isConnecting = false;
    }
}

// ============================================================================
// SYSTEM HANDLERS
// ============================================================================

function initSystemHandlers() {
    const rebootBtn = document.getElementById('btn-reboot');
    const shutdownBtn = document.getElementById('btn-shutdown');
    
    if (rebootBtn) {
        rebootBtn.addEventListener('click', confirmReboot);
    }
    
    if (shutdownBtn) {
        shutdownBtn.addEventListener('click', confirmShutdown);
    }
}

async function loadSystemInfo() {
    try {
        const response = await fetch('/api/system/info');
        const result = await response.json();
        
        if (result.status === 'ok') {
            const info = result.data;
            
            document.getElementById('system-uptime').textContent = info.uptime || '--';
            document.getElementById('system-temp').textContent = info.cpu_temp || '--';
            
            if (info.memory) {
                document.getElementById('system-memory').textContent = 
                    `${info.memory.used_mb} / ${info.memory.total_mb} MB (${info.memory.percent}%)`;
            }
        }
    } catch (error) {
        console.error('Failed to load system info:', error);
    }
}

function confirmReboot() {
    if (confirm('Are you sure you want to reboot the system?')) {
        performReboot();
    }
}

function confirmShutdown() {
    if (confirm('Are you sure you want to shut down the system?\n\nYou will need physical access to turn it back on.')) {
        performShutdown();
    }
}

async function performReboot() {
    try {
        await fetch('/api/system/reboot', { method: 'POST' });
        alert('System is rebooting...');
        closeSettingsModal();
    } catch (error) {
        console.error('Reboot failed:', error);
        alert('Failed to reboot system');
    }
}

async function performShutdown() {
    try {
        await fetch('/api/system/shutdown', { method: 'POST' });
        alert('System is shutting down...');
        closeSettingsModal();
    } catch (error) {
        console.error('Shutdown failed:', error);
        alert('Failed to shutdown system');
    }
}

// ============================================================================
// UTILITIES
// ============================================================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export for use in main app
window.TideWatchSettings = {
    openSettingsModal,
    closeSettingsModal,
    loadWiFiStatus,
    scanWiFiNetworks,
    loadSystemInfo
};