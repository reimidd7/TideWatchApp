from flask import Flask, render_template, jsonify, send_from_directory
from flask_cors import CORS
import os
from datetime import datetime
from config import Config
from weather_service import WeatherService
from tide_service import TideService
from astronomy_service import AstronomyService

app = Flask(__name__, 
            static_folder='../frontend',
            template_folder='../frontend')
CORS(app)

# Load configuration
app.config.from_object(Config)

# Initialize weather service
weather_service = WeatherService(
    app.config['LATITUDE'],
    app.config['LONGITUDE']
)

# Initialize tide service
tide_service = TideService(
    prediction_station=app.config['NOAA_PREDICTION_STATION'],
    observation_station=app.config['NOAA_OBSERVATION_STATION'],
    timezone=app.config['TIMEZONE']
)

# Initialize astronomy service
astronomy_service = AstronomyService(
    app.config['LATITUDE'],
    app.config['LONGITUDE']
)


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
        else:
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
        else:
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
        else:
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
    else:
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
    else:
        return jsonify({
            'status': 'error',
            'message': 'Failed to fetch astronomy data'
        }), 500

# Serve static files (CSS, JS, images)
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

if __name__ == '__main__':
    print(f"\n🌊 TideWatch Server Starting...")
    print(f"📍 Location: {app.config['LOCATION_NAME']}")
    print(f"🌊 NOAA Station: {app.config['NOAA_PREDICTION_STATION']} (Seattle - closest with API support)")
    print(f"🌐 Access at: http://localhost:5000")
    print(f"💻 Press Ctrl+C to stop\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)