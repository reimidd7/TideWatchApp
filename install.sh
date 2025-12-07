#!/bin/bash
# TideWatch Kiosk Installation Script
# Run with: bash install.sh

set -e

echo "🌊 TideWatch Kiosk Setup Starting..."

# Get installation directory and current user
SERVICE_USER=$(whoami)
INSTALL_DIR="/home/${SERVICE_USER}/tidewatch"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Installation directory: ${INSTALL_DIR}${NC}"

# Update system
echo -e "${GREEN}📦 Updating system packages...${NC}"
sudo apt-get update
sudo apt-get upgrade -y

# Install required packages
echo -e "${GREEN}📦 Installing dependencies...${NC}"
sudo apt-get install -y \
    python3-pip \
    python3-venv \
    git \
    chromium-browser \
    unclutter \
    xdotool \
    x11-xserver-utils \
    vim \
    curl

# Check if already in tidewatch directory
if [ "$(basename $(pwd))" == "tidewatch" ]; then
    INSTALL_DIR=$(pwd)
    echo -e "${GREEN}✅ Already in tidewatch directory${NC}"
    git pull
elif [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Directory exists, pulling latest changes...${NC}"
    cd "$INSTALL_DIR"
    git pull
else
    echo -e "${RED}❌ Directory not found at $INSTALL_DIR${NC}"
    echo -e "${YELLOW}Please run these commands first:${NC}"
    echo "  cd ~"
    echo "  git clone YOUR_GITHUB_REPO_URL tidewatch"
    echo "  cd tidewatch"
    echo "  bash install.sh"
    exit 1
fi

# Create Python virtual environment
echo -e "${GREEN}🐍 Setting up Python environment...${NC}"
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip

# Check if requirements.txt exists in backend folder
if [ -f "backend/requirements.txt" ]; then
    pip install -r backend/requirements.txt
elif [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    echo -e "${RED}❌ requirements.txt not found!${NC}"
    echo "Looking in: $(pwd)"
    ls -la
    exit 1
fi

# Create systemd service for Flask backend
echo -e "${GREEN}⚙️  Creating Flask backend service...${NC}"
sudo tee /etc/systemd/system/tidewatch-backend.service > /dev/null <<EOF
[Unit]
Description=TideWatch Flask Backend
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}/backend
Environment="PATH=${INSTALL_DIR}/venv/bin"
ExecStart=${INSTALL_DIR}/venv/bin/python app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create kiosk autostart script
echo -e "${GREEN}🖥️  Creating kiosk autostart...${NC}"
mkdir -p /home/${SERVICE_USER}/.config/autostart

tee /home/${SERVICE_USER}/.config/autostart/tidewatch-kiosk.desktop > /dev/null <<EOF
[Desktop Entry]
Type=Application
Name=TideWatch Kiosk
Exec=/home/${SERVICE_USER}/tidewatch/kiosk-start.sh
X-GNOME-Autostart-enabled=true
EOF

# Create kiosk start script
tee ${INSTALL_DIR}/kiosk-start.sh > /dev/null <<'EOF'
#!/bin/bash
# Wait for Flask backend to be ready
sleep 10

# Hide mouse cursor when inactive
unclutter -idle 0.1 -root &

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Start Chromium in kiosk mode
chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --disable-features=TranslateUI \
    --no-first-run \
    --check-for-update-interval=31536000 \
    --start-fullscreen \
    http://localhost:5000
EOF

chmod +x ${INSTALL_DIR}/kiosk-start.sh

# Create screen dimmer script
tee ${INSTALL_DIR}/screen-dim.sh > /dev/null <<'EOF'
#!/bin/bash
# Screen brightness control for dimming

DIM_LEVEL=30      # Brightness when dimmed (0-255)
BRIGHT_LEVEL=255  # Full brightness
DIM_TIMEOUT=300   # 5 minutes in seconds

# Path to backlight control (may vary by screen)
BACKLIGHT_PATH="/sys/class/backlight/rpi_backlight/brightness"

# Fallback to xrandr if backlight control not available
if [ ! -w "$BACKLIGHT_PATH" ]; then
    echo "Using xrandr for brightness control"
    USE_XRANDR=true
else
    USE_XRANDR=false
fi

set_brightness() {
    if [ "$USE_XRANDR" = true ]; then
        # xrandr method (works with most screens)
        xrandr --output HDMI-1 --brightness $1
    else
        # Direct backlight control
        echo $1 | sudo tee $BACKLIGHT_PATH > /dev/null
    fi
}

last_activity=$(date +%s)

# Monitor for touch/mouse activity
xinput list | grep -i touch | while read line; do
    device_id=$(echo $line | grep -oP 'id=\K\d+')
    xinput test $device_id | while read event; do
        last_activity=$(date +%s)
        set_brightness $BRIGHT_LEVEL
    done &
done

# Main loop
while true; do
    current_time=$(date +%s)
    idle_time=$((current_time - last_activity))
    
    if [ $idle_time -gt $DIM_TIMEOUT ]; then
        set_brightness $DIM_LEVEL
    fi
    
    sleep 5
done
EOF

chmod +x ${INSTALL_DIR}/screen-dim.sh

# Update screen dimming in frontend CSS
echo -e "${GREEN}🎨 Adding screen dimming overlay...${NC}"
# This will be added to the HTML/CSS in the next step

# Enable and start services
echo -e "${GREEN}🚀 Enabling services...${NC}"
sudo systemctl daemon-reload
sudo systemctl enable tidewatch-backend.service
sudo systemctl start tidewatch-backend.service

# Configure automatic login (for kiosk mode)
echo -e "${GREEN}🔐 Configuring automatic login...${NC}"
sudo raspi-config nonint do_boot_behaviour B4

# Disable screen blanking permanently
sudo tee -a /etc/xdg/lxsession/LXDE-pi/autostart > /dev/null <<EOF
@xset s off
@xset -dpms
@xset s noblank
EOF

# Install Tailscale for remote access
echo -e "${GREEN}🔒 Installing Tailscale for remote access...${NC}"
echo -e "${YELLOW}This allows you to access the Pi securely from anywhere${NC}"
curl -fsSL https://tailscale.com/install.sh | sh
echo -e "${YELLOW}Run 'sudo tailscale up' after installation to connect${NC}"

# Create update script
echo -e "${GREEN}🔄 Creating update script...${NC}"
tee ${INSTALL_DIR}/update.sh > /dev/null <<EOF
#!/bin/bash
# TideWatch Update Script

cd /home/${SERVICE_USER}/tidewatch
git pull origin main
source venv/bin/activate

# Install dependencies from correct location
if [ -f "backend/requirements.txt" ]; then
    pip install -r backend/requirements.txt
elif [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
fi

sudo systemctl restart tidewatch-backend.service
echo "✅ Update complete! App restarted."
EOF

chmod +x ${INSTALL_DIR}/update.sh

# Create watchdog service
echo -e "${GREEN}🐕 Creating watchdog service...${NC}"
sudo tee /etc/systemd/system/tidewatch-watchdog.service > /dev/null <<EOF
[Unit]
Description=TideWatch Watchdog
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
ExecStart=${INSTALL_DIR}/watchdog.sh
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
EOF

tee ${INSTALL_DIR}/watchdog.sh > /dev/null <<'EOF'
#!/bin/bash
# Watchdog script to monitor and restart services

while true; do
    # Check if Flask backend is responding
    if ! curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
        echo "Backend not responding, restarting..."
        sudo systemctl restart tidewatch-backend.service
        sleep 30
    fi
    
    sleep 60
done
EOF

chmod +x ${INSTALL_DIR}/watchdog.sh
sudo systemctl enable tidewatch-watchdog.service
sudo systemctl start tidewatch-watchdog.service

# Create convenience scripts
tee /home/${SERVICE_USER}/Desktop/restart-tidewatch.sh > /dev/null <<EOF
#!/bin/bash
sudo systemctl restart tidewatch-backend.service
chromium-browser http://localhost:5000 &
EOF

chmod +x /home/${SERVICE_USER}/Desktop/restart-tidewatch.sh

echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Run: sudo tailscale up"
echo "   (Follow the link to authenticate)"
echo "2. Reboot the Pi: sudo reboot"
echo ""
echo -e "${YELLOW}📡 Remote Access:${NC}"
echo "After reboot, you can SSH via Tailscale from anywhere"
echo ""
echo -e "${YELLOW}🔄 To Update Later:${NC}"
echo "Run: ~/tidewatch/update.sh"
echo "Or remotely via SSH"
echo ""
echo -e "${GREEN}🌊 TideWatch will start automatically on reboot!${NC}"