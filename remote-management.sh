#!/bin/bash
# TideWatch Remote Management Tools
# Commands you can run via SSH to manage the kiosk

show_menu() {
    echo "========================================="
    echo "   🌊 TideWatch Remote Management"
    echo "========================================="
    echo "1) Check Status"
    echo "2) View Logs"
    echo "3) Restart Backend"
    echo "4) Restart Kiosk"
    echo "5) Update from GitHub"
    echo "6) Full Reboot"
    echo "7) Check System Resources"
    echo "8) Emergency Stop All"
    echo "9) Test Backend API"
    echo "0) Exit"
    echo "========================================="
}

check_status() {
    echo "📊 System Status:"
    echo ""
    echo "Backend Service:"
    systemctl status tidewatch-backend.service --no-pager | head -n 5
    echo ""
    echo "Watchdog Service:"
    systemctl status tidewatch-watchdog.service --no-pager | head -n 5
    echo ""
    echo "Is Chromium Running?"
    pgrep -f "chromium.*kiosk" > /dev/null && echo "✅ Yes" || echo "❌ No"
}

view_logs() {
    echo "📋 Recent Logs (last 50 lines):"
    echo ""
    echo "=== Backend Logs ==="
    sudo journalctl -u tidewatch-backend.service -n 50 --no-pager
    echo ""
    echo "=== Watchdog Logs ==="
    sudo journalctl -u tidewatch-watchdog.service -n 20 --no-pager
}

restart_backend() {
    echo "🔄 Restarting Flask backend..."
    sudo systemctl restart tidewatch-backend.service
    sleep 2
    systemctl status tidewatch-backend.service --no-pager | head -n 5
}

restart_kiosk() {
    echo "🔄 Restarting Chromium kiosk..."
    pkill -f "chromium.*kiosk"
    sleep 2
    DISPLAY=:0 ~/tidewatch/kiosk-start.sh &
    echo "✅ Kiosk restarted"
}

update_from_github() {
    echo "📥 Pulling latest changes from GitHub..."
    cd ~/tidewatch
    git fetch
    echo ""
    echo "Changes to be pulled:"
    git log HEAD..origin/main --oneline
    echo ""
    read -p "Continue with update? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ~/tidewatch/update.sh
        echo "✅ Update complete"
    else
        echo "❌ Update cancelled"
    fi
}

full_reboot() {
    echo "⚠️  Rebooting the entire system..."
    read -p "Are you sure? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo reboot
    else
        echo "❌ Reboot cancelled"
    fi
}

check_resources() {
    echo "💻 System Resources:"
    echo ""
    echo "CPU Usage:"
    top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print "  " 100 - $1 "%"}'
    echo ""
    echo "Memory Usage:"
    free -h | awk 'NR==2{printf "  %s / %s (%.2f%%)\n", $3, $2, $3*100/$2 }'
    echo ""
    echo "Disk Usage:"
    df -h / | awk 'NR==2{printf "  %s / %s (%s)\n", $3, $2, $5}'
    echo ""
    echo "Temperature:"
    temp=$(vcgencmd measure_temp | cut -d= -f2)
    echo "  $temp"
    echo ""
    echo "Uptime:"
    uptime -p
}

emergency_stop() {
    echo "🛑 Stopping all TideWatch services..."
    sudo systemctl stop tidewatch-backend.service
    sudo systemctl stop tidewatch-watchdog.service
    pkill -f "chromium.*kiosk"
    echo "✅ All services stopped"
}

test_api() {
    echo "🧪 Testing Backend API..."
    echo ""
    
    echo "Health Check:"
    curl -s http://localhost:5000/api/health | python3 -m json.tool
    echo ""
    
    echo "Config:"
    curl -s http://localhost:5000/api/config | python3 -m json.tool | head -n 10
    echo ""
    
    echo "✅ API test complete"
}

# Main menu loop
while true; do
    show_menu
    read -p "Select option: " choice
    echo ""
    
    case $choice in
        1) check_status ;;
        2) view_logs ;;
        3) restart_backend ;;
        4) restart_kiosk ;;
        5) update_from_github ;;
        6) full_reboot ;;
        7) check_resources ;;
        8) emergency_stop ;;
        9) test_api ;;
        0) echo "👋 Goodbye!"; exit 0 ;;
        *) echo "❌ Invalid option" ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    clear
done