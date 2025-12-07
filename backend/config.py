"""
Configuration for TideWatch Application
All settings for location, stations, and refresh intervals
"""
import os


class Config:
    """Application configuration"""
    
    # Location Configuration - Maple Grove Beach, Camano Island, WA
    LOCATION_NAME = "Maple Grove Beach, Camano Island"
    LATITUDE = 48.2573
    LONGITUDE = -122.5167
    TIMEZONE = 'America/Los_Angeles'
    
    # Flask Configuration
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-change-in-production'
    DEBUG = True
    
    # Data Refresh Intervals (in seconds)
    TIDE_REFRESH_INTERVAL = 360        # 6 minutes (NOAA updates every 6 min)
    WEATHER_REFRESH_INTERVAL = 600     # 10 minutes
    ASTRONOMY_REFRESH_INTERVAL = 43200 # 12 hours
    
    # NOAA Stations
    # Using Seattle (9447130) for both predictions and observations
    # Note: Madronna Beach (9448233) doesn't support API predictions (subordinate station)
    # Seattle's tides are very close to Camano Island (only ~15-20 min time difference)
    NOAA_PREDICTION_STATION = '9447130'  # Seattle
    NOAA_OBSERVATION_STATION = '9447130' # Seattle