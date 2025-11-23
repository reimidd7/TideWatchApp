import os

class Config:
    """Configuration for TideWatch application"""
    
    # Location Configuration - Maple Grove Beach, Camano Island, WA
    LOCATION_NAME = "Maple Grove Beach, Camano Island"
    LATITUDE = 48.2573  # Approximate coordinates
    LONGITUDE = -122.5167

    # Flask Configuration
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-change-in-production'
    DEBUG = True
    
    # API Keys (to be added later)
    # NOAA_API_KEY = os.environ.get('NOAA_API_KEY')
    # WEATHER_API_KEY = os.environ.get('WEATHER_API_KEY')
    
    # Data Refresh Intervals (in seconds)
    TIDE_REFRESH_INTERVAL = 3600  # 1 hour
    WEATHER_REFRESH_INTERVAL = 600  # 10 minutes
    ASTRONOMY_REFRESH_INTERVAL = 3600  # 1 hour
    
    # Display Settings
    TIMEZONE = 'America/Los_Angeles'  # Pacific Time
    
    # NOAA Station ID (nearest to Maple Grove Beach)
    # Port Townsend station: 9444900
    # We'll use this when we integrate the NOAA API
    NOAA_STATION_ID = '9444900'