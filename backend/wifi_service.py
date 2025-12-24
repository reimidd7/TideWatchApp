"""
WiFi Service for TideWatch
Handles WiFi scanning, connection, and status using wpa_cli
Works with wpa_supplicant on Raspberry Pi OS (no NetworkManager needed)
"""
import subprocess
import re
import time
from typing import Optional, Dict, List


class WiFiService:
    """Manages WiFi connections using wpa_cli"""
    
    INTERFACE = "wlan0"
    SCAN_TIMEOUT = 10
    CONNECT_TIMEOUT = 30
    
    def __init__(self, interface: str = None):
        self.interface = interface or self.INTERFACE
    
    def _run_cmd(self, cmd: List[str], timeout: int = 10) -> tuple:
        """Run a shell command and return (success, output)"""
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=timeout
            )
            return result.returncode == 0, result.stdout.strip()
        except subprocess.TimeoutExpired:
            return False, "Command timed out"
        except Exception as e:
            return False, str(e)
    
    def _wpa_cli(self, command: str, timeout: int = 10) -> tuple:
        """Run a wpa_cli command"""
        cmd = ["/usr/bin/sudo", "/usr/sbin/wpa_cli", "-i", self.interface, command]
        return self._run_cmd(cmd, timeout)
    
    def _wpa_cli_args(self, *args, timeout: int = 10) -> tuple:
        """Run wpa_cli with multiple arguments"""
        cmd = ["/usr/bin/sudo", "/usr/sbin/wpa_cli", "-i", self.interface] + list(args)
        return self._run_cmd(cmd, timeout)
    
    def get_status(self) -> Dict:
        """Get current WiFi connection status"""
        try:
            success, output = self._wpa_cli("status")
            
            if not success:
                return {"connected": False, "error": output}
            
            status = {"connected": False, "raw": output}
            
            for line in output.split('\n'):
                if '=' in line:
                    key, value = line.split('=', 1)
                    status[key] = value
            
            # Check if connected
            if status.get('wpa_state') == 'COMPLETED':
                status['connected'] = True
                status['ssid'] = status.get('ssid', 'Unknown')
                
                # Get IP address
                ip = self._get_ip_address()
                if ip:
                    status['ip_address'] = ip
                
                # Get signal strength
                signal = self._get_signal_strength()
                if signal is not None:
                    status['signal_strength'] = signal
                    status['signal_percent'] = self._dbm_to_percent(signal)
            
            return status
            
        except Exception as e:
            return {"connected": False, "error": str(e)}
    
    def _get_ip_address(self) -> Optional[str]:
        """Get the IP address of the WiFi interface"""
        try:
            success, output = self._run_cmd([
                "/usr/sbin/ip", "-4", "addr", "show", self.interface
            ])
            if success:
                match = re.search(r'inet (\d+\.\d+\.\d+\.\d+)', output)
                if match:
                    return match.group(1)
        except:
            pass
        return None
    
    def _get_signal_strength(self) -> Optional[int]:
        """Get signal strength in dBm"""
        try:
            success, output = self._run_cmd([
                "/usr/sbin/iwconfig", self.interface
            ])
            if success:
                match = re.search(r'Signal level[=:](-?\d+)', output)
                if match:
                    return int(match.group(1))
        except:
            pass
        return None
    
    def _dbm_to_percent(self, dbm: int) -> int:
        """Convert dBm to percentage (approximate)"""
        if dbm >= -50:
            return 100
        elif dbm <= -100:
            return 0
        else:
            return 2 * (dbm + 100)
    
    def scan_networks(self) -> List[Dict]:
        """Scan for available WiFi networks"""
        try:
            # Trigger scan
            success, _ = self._wpa_cli("scan")
            if not success:
                return []
            
            # Wait for scan to complete
            time.sleep(3)
            
            # Get scan results
            success, output = self._wpa_cli("scan_results")
            if not success:
                return []
            
            networks = []
            seen_ssids = set()
            
            lines = output.split('\n')[1:]  # Skip header
            for line in lines:
                parts = line.split('\t')
                if len(parts) >= 5:
                    bssid, freq, signal, flags, ssid = parts[0], parts[1], parts[2], parts[3], '\t'.join(parts[4:])
                    
                    # Skip hidden networks and duplicates
                    if not ssid or ssid in seen_ssids:
                        continue
                    
                    seen_ssids.add(ssid)
                    
                    # Determine security type
                    security = "Open"
                    if "WPA2" in flags:
                        security = "WPA2"
                    elif "WPA" in flags:
                        security = "WPA"
                    elif "WEP" in flags:
                        security = "WEP"
                    
                    networks.append({
                        "ssid": ssid,
                        "bssid": bssid,
                        "frequency": int(freq),
                        "signal_dbm": int(signal),
                        "signal_percent": self._dbm_to_percent(int(signal)),
                        "security": security,
                        "secured": security != "Open",
                        "flags": flags
                    })
            
            # Sort by signal strength
            networks.sort(key=lambda x: x['signal_dbm'], reverse=True)
            
            print(f"Found {len(networks)} WiFi networks")
            return networks
            
        except Exception as e:
            print(f"Error scanning networks: {e}")
            return []
    
    def connect(self, ssid: str, password: str = None) -> Dict:
        """Connect to a WiFi network"""
        try:
            # Check if network already configured
            network_id = self._find_network(ssid)
            
            if network_id is None:
                # Add new network
                success, output = self._wpa_cli("add_network")
                if not success or not output.isdigit():
                    return {"success": False, "error": "Failed to add network"}
                
                network_id = output
                
                # Set SSID
                success, _ = self._wpa_cli_args(
                    "set_network", network_id, "ssid", f'"{ssid}"'
                )
                if not success:
                    return {"success": False, "error": "Failed to set SSID"}
                
                # Set password or open network
                if password:
                    success, _ = self._wpa_cli_args(
                        "set_network", network_id, "psk", f'"{password}"'
                    )
                    if not success:
                        return {"success": False, "error": "Failed to set password"}
                else:
                    success, _ = self._wpa_cli_args(
                        "set_network", network_id, "key_mgmt", "NONE"
                    )
                    if not success:
                        return {"success": False, "error": "Failed to configure open network"}
            
            # Enable and select the network
            self._wpa_cli_args("enable_network", network_id)
            success, _ = self._wpa_cli_args("select_network", network_id)
            
            if not success:
                return {"success": False, "error": "Failed to select network"}
            
            # Save config
            self._wpa_cli("save_config")
            
            # Wait for connection
            for i in range(self.CONNECT_TIMEOUT // 2):
                time.sleep(2)
                status = self.get_status()
                if status.get('connected') and status.get('ssid') == ssid:
                    return {
                        "success": True,
                        "ssid": ssid,
                        "ip_address": status.get('ip_address')
                    }
            
            return {"success": False, "error": "Connection timeout"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _find_network(self, ssid: str) -> Optional[str]:
        """Find network ID by SSID in saved networks"""
        try:
            success, output = self._wpa_cli("list_networks")
            if not success:
                return None
            
            for line in output.split('\n')[1:]:  # Skip header
                parts = line.split('\t')
                if len(parts) >= 2 and parts[1] == ssid:
                    return parts[0]
            
            return None
        except:
            return None
    
    def disconnect(self) -> Dict:
        """Disconnect from current network"""
        try:
            success, _ = self._wpa_cli("disconnect")
            return {"success": success}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def forget_network(self, ssid: str) -> Dict:
        """Remove a saved network"""
        try:
            network_id = self._find_network(ssid)
            if network_id is None:
                return {"success": False, "error": "Network not found"}
            
            success, _ = self._wpa_cli_args("remove_network", network_id)
            if success:
                self._wpa_cli("save_config")
            
            return {"success": success}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_saved_networks(self) -> List[Dict]:
        """Get list of saved networks"""
        try:
            success, output = self._wpa_cli("list_networks")
            if not success:
                return []
            
            networks = []
            for line in output.split('\n')[1:]:  # Skip header
                parts = line.split('\t')
                if len(parts) >= 4:
                    networks.append({
                        "id": parts[0],
                        "ssid": parts[1],
                        "bssid": parts[2],
                        "flags": parts[3],
                        "current": "[CURRENT]" in parts[3]
                    })
            
            return networks
        except:
            return []


if __name__ == "__main__":
    # Test the WiFi service
    print("Testing WiFi Service...\n")
    
    wifi = WiFiService()
    
    print("1. Current Status:")
    status = wifi.get_status()
    print(f"   Connected: {status.get('connected')}")
    if status.get('connected'):
        print(f"   SSID: {status.get('ssid')}")
        print(f"   IP: {status.get('ip_address')}")
        print(f"   Signal: {status.get('signal_percent')}%")
    
    print("\n2. Scanning Networks...")
    networks = wifi.scan_networks()
    for net in networks[:5]:
        print(f"   {net['ssid']}: {net['signal_percent']}% ({net['security']})")
    
    print("\n3. Saved Networks:")
    saved = wifi.get_saved_networks()
    for net in saved:
        current = " [CURRENT]" if net['current'] else ""
        print(f"   {net['ssid']}{current}")
    
    print("\n✅ WiFi service test complete!")