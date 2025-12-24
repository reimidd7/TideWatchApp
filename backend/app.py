"""
TideWatch Flask Application
Main server for tide, weather, and astronomy data visualization
"""
from flask import Flask, render_template, jsonify, send_from_directory, request
from flask_cors import CORS
from datetime import datetime
import subprocess
import platform
import os

from config import Config
from weather_service import WeatherService
from tide_service import TideService
from astronomy_service import AstronomyService
from wifi_service import WiFiService

# Initialize Flask app
app = Flask(__name__, 
            static_folder='../frontend',
            template_folder='../frontend')
CORS(app)
app.config.from_object(Config)

# Initialize services
weather_service = WeatherService(
    app.config['LATITUDE'],
    app.config['LONGITUDE']
)

tide_service = TideService(
    prediction_station=app.config['NOAA_PREDICTION_STATION'],
    observation_station=app.config['NOAA_OBSERVATION_STATION'],
    timezone=app.config['TIMEZONE']
)

astronomy_service = AstronomyService(
    app.config['LATITUDE'],
    app.config['LONGITUDE']
)

wifi_service = WiFiService()


@app.route('/')
def index():
    """Serve the main frontend page"""
    return send_from_directory('../frontend', 'index.html')


@app.route('/api/config')
def get_config():
    """Return location configuration for frontend"""
    return jsonify({
        'location': {
            'name': app.config['LOCATION_NAME'],
            'latitude': app.config['LATITUDE'],
            'longitude': app.config['LONGITUDE'],
            'station_id': app.config['NOAA_PREDICTION_STATION'],
            'observation_station': app.config['NOAA_OBSERVATION_STATION']
        }
    })


@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'location': app.config['LOCATION_NAME']
    })


@app.route('/api/tide')
def get_tide_data():
    """Get all tide data - current level, predictions, status"""
    try:
        data = tide_service.get_all_tide_data()
        
        if data:
            return jsonify({
                'status': 'ok',
                'data': data,
                'location': app.config['LOCATION_NAME']
            })
        
        return jsonify({
            'status': 'error',
            'message': 'Failed to fetch tide data'
        }), 500
            
    except Exception as e:
        print(f"Error in /api/tide: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/tide/current')
def get_current_tide():
    """Get just the current water level"""
    try:
        current = tide_service.get_current_water_level()
        
        if current:
            return jsonify({
                'status': 'ok',
                'data': current
            })
        
        return jsonify({
            'status': 'error',
            'message': 'No current data available'
        }), 404
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/tide/predictions')
def get_tide_predictions():
    """Get tide predictions for the next 7 days"""
    try:
        predictions = tide_service.get_tide_predictions(days=7)
        
        if predictions:
            return jsonify({
                'status': 'ok',
                'data': predictions
            })
        
        return jsonify({
            'status': 'error',
            'message': 'No predictions available'
        }), 404
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/weather')
def get_weather():
    """Get current weather data"""
    data = weather_service.get_weather()
    
    if data:
        return jsonify({
            'status': 'ok',
            'data': data,
            'location': app.config['LOCATION_NAME']
        })
    
    return jsonify({
        'status': 'error',
        'message': 'Failed to fetch weather data'
    }), 500


@app.route('/api/astronomy')
def get_astronomy_data():
    """Get astronomy data (sun/moon rise/set, moon phase)"""
    data = astronomy_service.get_astronomy_data()
    
    if data:
        return jsonify({
            'status': 'ok',
            'data': data,
            'location': app.config['LOCATION_NAME']
        })
    
    return jsonify({
        'status': 'error',
        'message': 'Failed to fetch astronomy data'
    }), 500


# ============================================================================
# WiFi API Endpoints
# ============================================================================

@app.route('/api/wifi/status')
def get_wifi_status():
    """Get current WiFi connection status"""
    try:
        status = wifi_service.get_status()
        return jsonify({
            'status': 'ok',
            'data': status
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/wifi/scan')
def scan_wifi_networks():
    """Scan for available WiFi networks"""
    try:
        networks = wifi_service.scan_networks()
        return jsonify({
            'status': 'ok',
            'data': networks
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/wifi/connect', methods=['POST'])
def connect_wifi():
    """Connect to a WiFi network"""
    try:
        data = request.get_json()
        ssid = data.get('ssid')
        password = data.get('password')
        
        if not ssid:
            return jsonify({
                'status': 'error',
                'message': 'SSID is required'
            }), 400
        
        result = wifi_service.connect(ssid, password)
        
        if result.get('success'):
            return jsonify({
                'status': 'ok',
                'data': result
            })
        else:
            return jsonify({
                'status': 'error',
                'message': result.get('error', 'Connection failed')
            }), 500
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/wifi/disconnect', methods=['POST'])
def disconnect_wifi():
    """Disconnect from current WiFi network"""
    try:
        result = wifi_service.disconnect()
        return jsonify({
            'status': 'ok' if result.get('success') else 'error',
            'data': result
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/wifi/forget', methods=['POST'])
def forget_wifi_network():
    """Forget a saved WiFi network"""
    try:
        data = request.get_json()
        ssid = data.get('ssid')
        
        if not ssid:
            return jsonify({
                'status': 'error',
                'message': 'SSID is required'
            }), 400
        
        result = wifi_service.forget_network(ssid)
        return jsonify({
            'status': 'ok' if result.get('success') else 'error',
            'data': result
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/wifi/saved')
def get_saved_networks():
    """Get list of saved WiFi networks"""
    try:
        networks = wifi_service.get_saved_networks()
        return jsonify({
            'status': 'ok',
            'data': networks
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


# ============================================================================
# System API Endpoints
# ============================================================================

@app.route('/api/system/info')
def get_system_info():
    """Get system information"""
    try:
        info = {
            'platform': platform.system(),
            'hostname': platform.node(),
            'architecture': platform.machine(),
        }
        
        # Get uptime on Linux
        try:
            with open('/proc/uptime', 'r') as f:
                uptime_seconds = float(f.readline().split()[0])
                info['uptime_seconds'] = uptime_seconds
                
                days = int(uptime_seconds // 86400)
                hours = int((uptime_seconds % 86400) // 3600)
                minutes = int((uptime_seconds % 3600) // 60)
                
                if days > 0:
                    info['uptime'] = f"{days}d {hours}h {minutes}m"
                else:
                    info['uptime'] = f"{hours}h {minutes}m"
        except:
            info['uptime'] = 'N/A'
        
        # Get CPU temperature on Raspberry Pi
        try:
            result = subprocess.run(
                ['vcgencmd', 'measure_temp'],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                temp = result.stdout.strip().replace('temp=', '').replace("'C", '')
                info['cpu_temp'] = f"{temp}°C"
        except:
            info['cpu_temp'] = 'N/A'
        
        # Get memory usage
        try:
            with open('/proc/meminfo', 'r') as f:
                lines = f.readlines()
                mem_total = int(lines[0].split()[1]) // 1024
                mem_free = int(lines[1].split()[1]) // 1024
                mem_available = int(lines[2].split()[1]) // 1024
                mem_used = mem_total - mem_available
                
                info['memory'] = {
                    'total_mb': mem_total,
                    'used_mb': mem_used,
                    'free_mb': mem_available,
                    'percent': round((mem_used / mem_total) * 100, 1)
                }
        except:
            info['memory'] = None
        
        return jsonify({
            'status': 'ok',
            'data': info
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/system/reboot', methods=['POST'])
def reboot_system():
    """Reboot the system"""
    try:
        subprocess.Popen(['sudo', 'reboot'], start_new_session=True)
        return jsonify({
            'status': 'ok',
            'message': 'Rebooting...'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/system/shutdown', methods=['POST'])
def shutdown_system():
    """Shutdown the system"""
    try:
        subprocess.Popen(['sudo', 'shutdown', '-h', 'now'], start_new_session=True)
        return jsonify({
            'status': 'ok',
            'message': 'Shutting down...'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
    
@app.route('/api/keyboard/show', methods=['POST'])
def show_keyboard():
    """Show on-screen keyboard"""
    try:
        subprocess.Popen(
            ['/usr/bin/onboard'],
            env={**os.environ, 'DISPLAY': ':0'},
            start_new_session=True
        )
        return jsonify({'status': 'ok'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/keyboard/hide', methods=['POST'])
def hide_keyboard():
    """Hide on-screen keyboard"""
    try:
        subprocess.run(['/usr/bin/pkill', 'onboard'], timeout=5)
        return jsonify({'status': 'ok'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/<path:path>')
def serve_static(path):
    """Serve static files (CSS, JS, images)"""
    return send_from_directory('../frontend', path)


if __name__ == '__main__':
    print(f"\n🌊 TideWatch Server Starting...")
    print(f"📍 Location: {app.config['LOCATION_NAME']}")
    print(f"🌊 NOAA Station: {app.config['NOAA_PREDICTION_STATION']}")
    print(f"📶 WiFi management enabled")
    print(f"🌐 Access at: http://localhost:5000")
    print(f"💻 Press Ctrl+C to stop\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)