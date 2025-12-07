import requests
from datetime import datetime

class WeatherService:

    """Handles weather data from Weather.gov API"""

    def __init__(self, latitude, longitude):
        self.latitude = latitude
        self.longitude = longitude
        self.base_url = "https://api.weather.gov"
        self.forecast_url = None
        self.cached_data = None
        self.last_update = None

    def _get_forecast_url(self):
        """Get the forecast URL for our location"""
        try:
            # Step 1: Ask Weather.gov for our grid point
            points_url = f"{self.base_url}/points/{self.latitude}, {self.longitude}"
            response = requests.get(points_url)
            response.raise_for_status() # Raises error if request failed

            # Step 2: Extract the forcast URL from the response
            data = response.json()
            self.forecast_url = data['properties']['forecast']

            print(f"Forcast URL: {self.forecast_url}")
            return True
        except Exception as e:
            print(f"Error getting forecast URl: {e}")
            return False
        
    def _get_current_observations(self, station_id="KNUW"):
        """Get current weather observations from nearest station"""
        try:
            # Get latest observation from the station
            obs_url = f"{self.base_url}/stations/{station_id}/observations/latest"
            response = requests.get(obs_url)
            response.raise_for_status()
            
            data = response.json()
            props = data['properties']
            
            # Extract current conditions
            current_obs = {
                'temperature': self._convert_temp(props.get('temperature')),
                'temperature_unit': 'F',
                'conditions': props.get('textDescription', 'N/A'),
                'wind_speed': self._format_wind(props.get('windSpeed')),
                'wind_direction': self._degrees_to_compass(props.get('windDirection', {}).get('value')),
                'wind_direction_degrees': props.get('windDirection', {}).get('value'),
                'visibility': self._format_visibility(props.get('visibility')),
                'humidity': props.get('relativeHumidity', {}).get('value'),
                'pressure': props.get('barometricPressure', {}).get('value'),
                'dewpoint': self._convert_temp(props.get('dewpoint')),
                'timestamp': props.get('timestamp')
            }
            
            print(f"Current observations: {current_obs['temperature']}°F, {current_obs['conditions']}")
            return current_obs
            
        except Exception as e:
            print(f"Error getting observations: {e}")
            return None
            
    def get_weather(self):
        """Fetch current weather observations and forecast"""
        try:
            # Get current observations from weather station
            current = self._get_current_observations()
            
            # Get forecast (if we don't have the URL yet, get it)
            if not self.forecast_url:
                if not self._get_forecast_url():
                    return None
            
            # Get forecast data
            response = requests.get(self.forecast_url)
            response.raise_for_status()
            
            data = response.json()
            periods = data['properties']['periods']
            
            # Debug logging
            if current:
                print(f"📊 Current observations - conditions: {current.get('conditions', 'NONE')}")
            print(f"📊 Forecast - shortForecast: {periods[0].get('shortForecast', 'NONE')}")
            
            # Build combined weather object
            weather_data = {
                # Current conditions from observation station
                'temperature': current['temperature'] if current else periods[0]['temperature'],
                'temperature_unit': 'F',
                'conditions': current.get('conditions') if current and current.get('conditions') and current.get('conditions') != 'N/A' else periods[0]['shortForecast'],
                'wind_speed': current['wind_speed'] if current else periods[0]['windSpeed'],
                'wind_direction': current['wind_direction'] if current else periods[0]['windDirection'],
                'wind_direction_degrees': current['wind_direction_degrees'] if current else None,
                'visibility': current['visibility'] if current else None,
                'humidity': current['humidity'] if current else None,
                'pressure': current['pressure'] if current else None,
                'dewpoint': current['dewpoint'] if current else None,
                
                # Forecast data
                'detailed_forecast': periods[0]['detailedForecast'],
                'icon': periods[0]['icon'],
                'is_daytime': periods[0]['isDaytime'],
                'forecast_periods': periods[:5],  # Next 5 periods
                
                'last_update': datetime.now().isoformat(),
                'station_id': 'KNUW'
            }
            
            # Cache it
            self.cached_data = weather_data
            self.last_update = datetime.now()
            
            print(f"Weather updated: {weather_data['temperature']}°F, {weather_data['conditions']}, Visibility: {weather_data['visibility']}")
            
            return weather_data
            
        except Exception as e:
            print(f"Error fetching weather: {e}")
            import traceback
            traceback.print_exc()
            # Return cached data if available
            return self.cached_data
            
    def _convert_temp(self, temp_obj):
        """Convert temperature from Celsius to Fahrenheit"""
        if not temp_obj or temp_obj.get('value') is None:
            return None
        celsius = temp_obj['value']
        fahrenheit = (celsius * 9/5) + 32
        return round(fahrenheit)
    
    def _format_wind(self, wind_obj):
        """Format wind speed to mph"""
        if not wind_obj or wind_obj.get('value') is None:
            return 'N/A'
        # Convert m/s to mph
        meters_per_sec = wind_obj['value']
        mph = meters_per_sec * 2.237
        return f"{round(mph)} mph"
    
    def _format_visibility(self, vis_obj):
        """Format visibility to miles"""
        if not vis_obj or vis_obj.get('value') is None:
            return 'N/A'
        # Convert meters to miles
        meters = vis_obj['value']
        miles = meters / 1609.34
        return f"{round(miles, 1)} mi"
    
    def _degrees_to_compass(self, degrees):
        """Convert wind direction degrees to compass direction"""
        if degrees is None:
            return 'N/A'
        
        # Compass directions in 16-point compass
        directions = [
            'N', 'NNE', 'NE', 'ENE',
            'E', 'ESE', 'SE', 'SSE',
            'S', 'SSW', 'SW', 'WSW',
            'W', 'WNW', 'NW', 'NNW'
        ]
        
        # Each direction covers 22.5 degrees (360 / 16)
        index = round(degrees / 22.5) % 16
        return directions[index]
        
# Test code (remove this later)
if __name__ == "__main__":
    weather = WeatherService(48.2573,-122.5167)
    data = weather.get_weather()
    
    if data:
        print("\n WEATHER TEST:")
        print(f"Temperature: {data['temperature']}°{data['temperature_unit']}")
        print(f"Conditions: {data['conditions']}")
        print(f"Wind: {data['wind_speed']} {data['wind_direction']}")
    else:
        print("Failed to get weather data")