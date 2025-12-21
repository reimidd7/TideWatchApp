"""
System Service
Handles WiFi, updates, and system management for kiosk mode
"""
import subprocess
import os
import re
from typing import Optional, Dict, List
from datetime import datetime


class SystemService:
    """Manages system operations for TideWatch kiosk"""
    
    def __init__(self, install_dir: str = None):
        self.install_dir = install_dir or os.path.expanduser("~/tidewatch")
    
    # =========================================================================
    # WIFI MANAGEMENT
    # =========================================================================
    
    def get_wifi_status(self) -> Dict:
        """Get current WiFi connection status"""
        try:
            # Get current connection
            result = subprocess.run(
                ['nmcli', '-t', '-f', 'ACTIVE,SSID,SIGNAL,SECURITY', 'dev', 'wifi'],
                capture_output=True, text=True, timeout=10
            )
            
            current_ssid = None
            signal = None
            security = None
            
            for line in result.stdout.strip().split('\n'):
                if line.startswith('yes:'):
                    parts = line.split(':')
                    if len(parts) >= 4:
                        current_ssid = parts[1]
                        signal = parts[2]
                        security = parts[3]
                    break
            
            # Get IP address
            ip_result = subprocess.run(
                ['hostname', '-I'],
                capture_output=True, text=True, timeout=5
            )
            ip_address = ip_result.stdout.strip().split()[0] if ip_result.stdout.strip() else None
            
            # Check internet connectivity
            internet = self._check_internet()
            
            return {
                'connected': current_ssid is not None,
                'ssid': current_ssid,
                'signal': signal,
                'security': security,
                'ip_address': ip_address,
                'internet': internet
            }
        except Exception as e:
            print(f"Error getting WiFi status: {e}")
            return {
                'connected': False,
                'ssid': None,
                'signal': None,
                'security': None,
                'ip_address': None,
                'internet': False,
                'error': str(e)
            }
    
    def scan_wifi_networks(self) -> List[Dict]:
        """Scan for available WiFi networks"""
        try:
            # Rescan networks
            subprocess.run(['nmcli', 'dev', 'wifi', 'rescan'], 
                          capture_output=True, timeout=15)
            
            # Get network list
            result = subprocess.run(
                ['nmcli', '-t', '-f', 'SSID,SIGNAL,SECURITY,IN-USE', 'dev', 'wifi', 'list'],
                capture_output=True, text=True, timeout=10
            )
            
            networks = []
            seen_ssids = set()
            
            for line in result.stdout.strip().split('\n'):
                if not line:
                    continue
                parts = line.split(':')
                if len(parts) >= 4:
                    ssid = parts[0]
                    if ssid and ssid not in seen_ssids:
                        seen_ssids.add(ssid)
                        networks.append({
                            'ssid': ssid,
                            'signal': int(parts[1]) if parts[1].isdigit() else 0,
                            'security': parts[2] if parts[2] else 'Open',
                            'connected': parts[3] == '*'
                        })
            
            # Sort by signal strength
            networks.sort(key=lambda x: x['signal'], reverse=True)
            return networks
            
        except Exception as e:
            print(f"Error scanning WiFi: {e}")
            return []
    
    def connect_wifi(self, ssid: str, password: str = None) -> Dict:
        """Connect to a WiFi network"""
        try:
            if password:
                result = subprocess.run(
                    ['nmcli', 'dev', 'wifi', 'connect', ssid, 'password', password],
                    capture_output=True, text=True, timeout=30
                )
            else:
                result = subprocess.run(
                    ['nmcli', 'dev', 'wifi', 'connect', ssid],
                    capture_output=True, text=True, timeout=30
                )
            
            success = result.returncode == 0
            
            return {
                'success': success,
                'message': result.stdout.strip() if success else result.stderr.strip(),
                'ssid': ssid
            }
        except subprocess.TimeoutExpired:
            return {'success': False, 'message': 'Connection timed out', 'ssid': ssid}
        except Exception as e:
            return {'success': False, 'message': str(e), 'ssid': ssid}
    
    def disconnect_wifi(self) -> Dict:
        """Disconnect from current WiFi"""
        try:
            result = subprocess.run(
                ['nmcli', 'dev', 'disconnect', 'wlan0'],
                capture_output=True, text=True, timeout=10
            )
            return {
                'success': result.returncode == 0,
                'message': result.stdout.strip() or result.stderr.strip()
            }
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def get_saved_networks(self) -> List[str]:
        """Get list of saved WiFi networks"""
        try:
            result = subprocess.run(
                ['nmcli', '-t', '-f', 'NAME,TYPE', 'connection', 'show'],
                capture_output=True, text=True, timeout=10
            )
            networks = []
            for line in result.stdout.strip().split('\n'):
                parts = line.split(':')
                if len(parts) >= 2 and 'wireless' in parts[1]:
                    networks.append(parts[0])
            return networks
        except Exception as e:
            print(f"Error getting saved networks: {e}")
            return []
    
    def forget_network(self, ssid: str) -> Dict:
        """Remove a saved network"""
        try:
            result = subprocess.run(
                ['nmcli', 'connection', 'delete', ssid],
                capture_output=True, text=True, timeout=10
            )
            return {
                'success': result.returncode == 0,
                'message': result.stdout.strip() or result.stderr.strip()
            }
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def _check_internet(self) -> bool:
        """Check if we have internet connectivity"""
        try:
            result = subprocess.run(
                ['ping', '-c', '1', '-W', '3', '8.8.8.8'],
                capture_output=True, timeout=5
            )
            return result.returncode == 0
        except:
            return False
    
    # =========================================================================
    # SYSTEM MANAGEMENT
    # =========================================================================
    
    def get_system_status(self) -> Dict:
        """Get comprehensive system status"""
        try:
            # CPU usage
            cpu_result = subprocess.run(
                ['top', '-bn1'],
                capture_output=True, text=True, timeout=5
            )
            cpu_match = re.search(r'%Cpu.*?(\d+\.?\d*)\s*id', cpu_result.stdout)
            cpu_usage = round(100 - float(cpu_match.group(1)), 1) if cpu_match else None
            
            # Memory usage
            mem_result = subprocess.run(['free', '-m'], capture_output=True, text=True, timeout=5)
            mem_lines = mem_result.stdout.strip().split('\n')
            if len(mem_lines) >= 2:
                mem_parts = mem_lines[1].split()
                mem_total = int(mem_parts[1])
                mem_used = int(mem_parts[2])
                mem_percent = round((mem_used / mem_total) * 100, 1)
            else:
                mem_total, mem_used, mem_percent = None, None, None
            
            # Disk usage
            disk_result = subprocess.run(
                ['df', '-h', '/'],
                capture_output=True, text=True, timeout=5
            )
            disk_lines = disk_result.stdout.strip().split('\n')
            if len(disk_lines) >= 2:
                disk_parts = disk_lines[1].split()
                disk_total = disk_parts[1]
                disk_used = disk_parts[2]
                disk_percent = disk_parts[4]
            else:
                disk_total, disk_used, disk_percent = None, None, None
            
            # Temperature
            try:
                temp_result = subprocess.run(
                    ['vcgencmd', 'measure_temp'],
                    capture_output=True, text=True, timeout=5
                )
                temp_match = re.search(r'temp=(\d+\.?\d*)', temp_result.stdout)
                temperature = float(temp_match.group(1)) if temp_match else None
            except:
                temperature = None
            
            # Uptime
            uptime_result = subprocess.run(
                ['uptime', '-p'],
                capture_output=True, text=True, timeout=5
            )
            uptime = uptime_result.stdout.strip().replace('up ', '')
            
            return {
                'cpu_usage': cpu_usage,
                'memory': {
                    'total_mb': mem_total,
                    'used_mb': mem_used,
                    'percent': mem_percent
                },
                'disk': {
                    'total': disk_total,
                    'used': disk_used,
                    'percent': disk_percent
                },
                'temperature': temperature,
                'uptime': uptime,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            print(f"Error getting system status: {e}")
            return {'error': str(e)}
    
    def check_for_updates(self) -> Dict:
        """Check if updates are available from git"""
        try:
            # Fetch latest
            subprocess.run(
                ['git', 'fetch'],
                cwd=self.install_dir,
                capture_output=True, timeout=30
            )
            
            # Check for differences
            result = subprocess.run(
                ['git', 'log', 'HEAD..origin/main', '--oneline'],
                cwd=self.install_dir,
                capture_output=True, text=True, timeout=10
            )
            
            commits = [c for c in result.stdout.strip().split('\n') if c]
            
            # Get current version/commit
            current = subprocess.run(
                ['git', 'rev-parse', '--short', 'HEAD'],
                cwd=self.install_dir,
                capture_output=True, text=True, timeout=5
            )
            
            return {
                'updates_available': len(commits) > 0,
                'pending_commits': len(commits),
                'commits': commits[:5],  # Show last 5
                'current_version': current.stdout.strip()
            }
        except Exception as e:
            print(f"Error checking for updates: {e}")
            return {'error': str(e), 'updates_available': False}
    
    def perform_update(self) -> Dict:
        """Pull latest code and restart services"""
        try:
            results = []
            
            # Git pull
            pull_result = subprocess.run(
                ['git', 'pull', 'origin', 'main'],
                cwd=self.install_dir,
                capture_output=True, text=True, timeout=60
            )
            results.append(f"Git pull: {pull_result.stdout.strip()}")
            
            if pull_result.returncode != 0:
                return {
                    'success': False,
                    'message': f"Git pull failed: {pull_result.stderr}",
                    'steps': results
                }
            
            # Install any new dependencies
            pip_result = subprocess.run(
                [f'{self.install_dir}/venv/bin/pip', 'install', '-r', 
                 f'{self.install_dir}/backend/requirements.txt'],
                capture_output=True, text=True, timeout=120
            )
            results.append("Dependencies updated")
            
            # Restart backend service
            restart_result = subprocess.run(
                ['sudo', 'systemctl', 'restart', 'tidewatch-backend.service'],
                capture_output=True, text=True, timeout=30
            )
            
            if restart_result.returncode == 0:
                results.append("Backend service restarted")
            else:
                results.append(f"Service restart warning: {restart_result.stderr}")
            
            return {
                'success': True,
                'message': 'Update completed successfully',
                'steps': results
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': str(e),
                'steps': results if 'results' in locals() else []
            }
    
    def reboot_system(self) -> Dict:
        """Reboot the Raspberry Pi"""
        try:
            subprocess.Popen(['sudo', 'reboot'])
            return {'success': True, 'message': 'Rebooting...'}
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def restart_kiosk(self) -> Dict:
        """Restart just the kiosk browser"""
        try:
            subprocess.run(['pkill', '-f', 'chromium.*kiosk'], timeout=5)
            subprocess.Popen(
                [f'{self.install_dir}/kiosk-start.sh'],
                env={**os.environ, 'DISPLAY': ':0'}
            )
            return {'success': True, 'message': 'Kiosk restarting...'}
        except Exception as e:
            return {'success': False, 'message': str(e)}


if __name__ == "__main__":
    # Test the service
    service = SystemService()
    
    print("\n📡 WiFi Status:")
    print(service.get_wifi_status())
    
    print("\n📶 Available Networks:")
    for net in service.scan_wifi_networks():
        print(f"  {net['ssid']}: {net['signal']}% ({net['security']})")
    
    print("\n💻 System Status:")
    status = service.get_system_status()
    print(f"  CPU: {status.get('cpu_usage')}%")
    print(f"  Memory: {status.get('memory', {}).get('percent')}%")
    print(f"  Temp: {status.get('temperature')}°C")
    print(f"  Uptime: {status.get('uptime')}")
    
    print("\n🔄 Update Status:")
    print(service.check_for_updates())