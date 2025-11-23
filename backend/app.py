from flask import Flask, render_template, jsonify, send_from_directory
from flask_cors import CORS
import os
from datetime import datetime
from config import Config
from weather_service import WeatherService

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
            'longitude': app.config['LONGITUDE']
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
    """Placeholder for tide data - will integrate NOAA API later"""
    return jsonify({
        'status': 'placeholder',
        'message': 'Tide data endpoint ready for API integration',
        'location': app.config['LOCATION_NAME']
    })

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
    """Placeholder for moon phase, sunrise/sunset data"""
    return jsonify({
        'status': 'placeholder',
        'message': 'Astronomy data endpoint ready for API integration',
        'location': app.config['LOCATION_NAME']
    })

# Serve static files (CSS, JS, images)
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

if __name__ == '__main__':
    print(f"\n🌊 TideWatch Server Starting...")
    print(f"📍 Location: {app.config['LOCATION_NAME']}")
    print(f"🌐 Access at: http://localhost:5000")
    print(f"💻 Press Ctrl+C to stop\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)