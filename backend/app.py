"""
TideWatch Flask Application
Main server for tide, weather, astronomy, and system management
"""
from flask import Flask, render_template, jsonify, send_from_directory, request
from flask_cors import CORS
from datetime import datetime

from config import Config
from weather_service import WeatherService
from tide_service import TideService
from astronomy_service import AstronomyService
from system_service import SystemService

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

system_service = SystemService()


# =============================================================================
# MAIN ROUTES
# =============================================================================

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


# =============================================================================
# TIDE ROUTES
# =============================================================================

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


# =============================================================================
# WEATHER & ASTRONOMY ROUTES
# =============================================================================

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


# =============================================================================
# WIFI MANAGEMENT ROUTES
# =============================================================================

@app.route('/api/wifi/status')
def wifi_status():
    """Get current WiFi connection status"""
    status = system_service.get_wifi_status()
    return jsonify({
        'status': 'ok',
        'data': status
    })


@app.route('/api/wifi/scan')
def wifi_scan():
    """Scan for available WiFi networks"""
    networks = system_service.scan_wifi_networks()
    return jsonify({
        'status': 'ok',
        'data': networks
    })


@app.route('/api/wifi/connect', methods=['POST'])
def wifi_connect():
    """Connect to a WiFi network"""
    data = request.get_json()
    ssid = data.get('ssid')
    password = data.get('password')
    
    if not ssid:
        return jsonify({
            'status': 'error',
            'message': 'SSID is required'
        }), 400
    
    result = system_service.connect_wifi(ssid, password)
    return jsonify({
        'status': 'ok' if result['success'] else 'error',
        'data': result
    })


@app.route('/api/wifi/disconnect', methods=['POST'])
def wifi_disconnect():
    """Disconnect from current WiFi"""
    result = system_service.disconnect_wifi()
    return jsonify({
        'status': 'ok' if result['success'] else 'error',
        'data': result
    })


@app.route('/api/wifi/saved')
def wifi_saved():
    """Get list of saved WiFi networks"""
    networks = system_service.get_saved_networks()
    return jsonify({
        'status': 'ok',
        'data': networks
    })


@app.route('/api/wifi/forget', methods=['POST'])
def wifi_forget():
    """Forget a saved network"""
    data = request.get_json()
    ssid = data.get('ssid')
    
    if not ssid:
        return jsonify({
            'status': 'error',
            'message': 'SSID is required'
        }), 400
    
    result = system_service.forget_network(ssid)
    return jsonify({
        'status': 'ok' if result['success'] else 'error',
        'data': result
    })


# =============================================================================
# SYSTEM MANAGEMENT ROUTES
# =============================================================================

@app.route('/api/system/status')
def system_status():
    """Get system status (CPU, memory, temp, etc.)"""
    status = system_service.get_system_status()
    return jsonify({
        'status': 'ok',
        'data': status
    })


@app.route('/api/system/check-updates')
def check_updates():
    """Check if updates are available"""
    result = system_service.check_for_updates()
    return jsonify({
        'status': 'ok',
        'data': result
    })


@app.route('/api/system/update', methods=['POST'])
def perform_update():
    """Perform system update (git pull + restart)"""
    result = system_service.perform_update()
    return jsonify({
        'status': 'ok' if result['success'] else 'error',
        'data': result
    })


@app.route('/api/system/reboot', methods=['POST'])
def reboot():
    """Reboot the Raspberry Pi"""
    result = system_service.reboot_system()
    return jsonify({
        'status': 'ok' if result['success'] else 'error',
        'data': result
    })


@app.route('/api/system/restart-kiosk', methods=['POST'])
def restart_kiosk():
    """Restart just the kiosk browser"""
    result = system_service.restart_kiosk()
    return jsonify({
        'status': 'ok' if result['success'] else 'error',
        'data': result
    })


# =============================================================================
# STATIC FILES
# =============================================================================

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files (CSS, JS, images)"""
    return send_from_directory('../frontend', path)


if __name__ == '__main__':
    print(f"\n🌊 TideWatch Server Starting...")
    print(f"📍 Location: {app.config['LOCATION_NAME']}")
    print(f"🌊 NOAA Station: {app.config['NOAA_PREDICTION_STATION']}")
    print(f"🌐 Access at: http://localhost:5000")
    print(f"⚙️  System management enabled")
    print(f"💻 Press Ctrl+C to stop\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)