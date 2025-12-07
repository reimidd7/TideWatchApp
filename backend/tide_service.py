"""
Tide Service
Handles tide data from NOAA CO-OPS API
"""
import requests
from datetime import datetime, timedelta
import pytz


class TideService:
    """Fetches and processes tide data from NOAA CO-OPS API"""
    
    # Constants
    BASE_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"
    DEFAULT_STATION = "9447130"  # Seattle
    DATUM = "MLLW"  # Mean Lower Low Water
    UNITS = "english"
    APPLICATION_NAME = "TideWatch"
    
    def __init__(self, prediction_station=None, observation_station=None, 
                 timezone="America/Los_Angeles"):
        """
        Initialize tide service
        Uses Seattle for both predictions and observations as subordinate stations
        like Madronna Beach don't support API predictions
        """
        self.prediction_station = prediction_station or self.DEFAULT_STATION
        self.observation_station = observation_station or self.DEFAULT_STATION
        self.timezone = pytz.timezone(timezone)
        
        # Caching
        self.cached_predictions = None
        self.cached_current = None
        self.last_prediction_update = None
        self.last_current_update = None
    
    def _convert_to_12hr(self, time_str):
        """Convert 24-hour time string to 12-hour format with AM/PM"""
        try:
            dt = datetime.strptime(time_str, "%Y-%m-%d %H:%M")
            dt = self.timezone.localize(dt)
            return dt.strftime('%I:%M %p').lstrip('0')
        except:
            return time_str
    
    def get_current_water_level(self):
        """Get the current water level from observation station"""
        try:
            now = datetime.now(self.timezone)
            now_gmt = now.astimezone(pytz.UTC)
            
            # Get data from last 30 minutes
            begin_date = (now_gmt - timedelta(minutes=30)).strftime("%Y%m%d %H:%M")
            end_date = now_gmt.strftime("%Y%m%d %H:%M")
            
            params = {
                'station': self.observation_station,
                'begin_date': begin_date,
                'end_date': end_date,
                'product': 'water_level',
                'datum': self.DATUM,
                'units': self.UNITS,
                'time_zone': 'gmt',
                'format': 'json',
                'application': self.APPLICATION_NAME
            }
            
            response = requests.get(self.BASE_URL, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            # Get the most recent reading
            if 'data' in data and len(data['data']) > 0:
                latest = data['data'][-1]
                
                # Convert GMT time to local Pacific time
                gmt_time = datetime.strptime(latest['t'], "%Y-%m-%d %H:%M")
                gmt_time = pytz.UTC.localize(gmt_time)
                local_time = gmt_time.astimezone(self.timezone)
                
                current_level = {
                    'height': round(float(latest['v']), 2),
                    'time': local_time.strftime("%Y-%m-%d %H:%M"),
                    'time_12hr': local_time.strftime('%I:%M %p').lstrip('0'),
                    'unit': 'ft',
                    'station': self.observation_station,
                    'station_name': 'Seattle (observation)'
                }
                
                self.cached_current = current_level
                self.last_current_update = datetime.now()
                
                print(f"✅ Current water level: {current_level['height']} ft "
                      f"at {current_level['time_12hr']} (from Seattle)")
                return current_level
            
            print("⚠️ No current water level data available")
            return None
                
        except Exception as e:
            print(f"❌ Error getting current water level: {e}")
            return self.cached_current
    
    def get_tide_predictions(self, days=7):
        """Get tide predictions from prediction station"""
        try:
            now = datetime.now(self.timezone)
            
            begin_date = (now - timedelta(days=1)).strftime("%Y%m%d")
            end_date = (now + timedelta(days=days)).strftime("%Y%m%d")
            
            params = {
                'station': self.prediction_station,
                'begin_date': begin_date,
                'end_date': end_date,
                'product': 'predictions',
                'datum': self.DATUM,
                'units': self.UNITS,
                'time_zone': 'lst_ldt',  # Auto-adjusts for DST
                'interval': 'hilo',
                'format': 'json',
                'application': self.APPLICATION_NAME
            }
            
            response = requests.get(self.BASE_URL, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if 'error' in data:
                print(f"❌ API Error: {data.get('error', {})}")
                return None
            
            if 'predictions' in data:
                predictions = [
                    {
                        'time': pred['t'],
                        'time_12hr': self._convert_to_12hr(pred['t']),
                        'height': round(float(pred['v']), 2),
                        'type': pred['type']  # 'H' for high, 'L' for low
                    }
                    for pred in data['predictions']
                ]
                
                self.cached_predictions = predictions
                self.last_prediction_update = datetime.now()
                
                print(f"✅ Loaded {len(predictions)} tide predictions (from Seattle)")
                return predictions
            
            print("⚠️ No predictions available")
            return None
                
        except Exception as e:
            print(f"❌ Error getting tide predictions: {e}")
            return self.cached_predictions
    
    def get_next_tides(self):
        """Get the next high and low tides from current time"""
        predictions = self.get_tide_predictions(days=2)
        if not predictions:
            return None
        
        now = datetime.now(self.timezone)
        next_high = None
        next_low = None
        
        for tide in predictions:
            tide_time = datetime.strptime(tide['time'], "%Y-%m-%d %H:%M")
            tide_time = self.timezone.localize(tide_time)
            
            if tide_time > now:
                if tide['type'] == 'H' and not next_high:
                    next_high = tide
                elif tide['type'] == 'L' and not next_low:
                    next_low = tide
                
                if next_high and next_low:
                    break
        
        return {
            'next_high': next_high,
            'next_low': next_low
        }
    
    def get_todays_tides(self):
        """Get all high/low tides for today"""
        predictions = self.get_tide_predictions(days=1)
        if not predictions:
            return None
        
        now = datetime.now(self.timezone)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        todays_tides = []
        for tide in predictions:
            tide_time = datetime.strptime(tide['time'], "%Y-%m-%d %H:%M")
            tide_time = self.timezone.localize(tide_time)
            
            if today_start <= tide_time < today_end:
                todays_tides.append(tide)
        
        return todays_tides
    
    def calculate_tide_status(self):
        """
        Calculate if tide is rising or falling, and percentage through cycle
        Returns: dict with 'direction', 'percentage', 'is_rising'
        """
        predictions = self.get_tide_predictions(days=1)
        current = self.get_current_water_level()
        
        if not predictions:
            return {
                'direction': 'Unknown',
                'percentage': 0.5,
                'is_rising': True,
                'has_predictions': False
            }
        
        now = datetime.now(self.timezone)
        
        # Find the tide events before and after current time
        prev_tide = None
        next_tide = None
        
        for tide in predictions:
            tide_time = datetime.strptime(tide['time'], "%Y-%m-%d %H:%M")
            tide_time = self.timezone.localize(tide_time)
            
            if tide_time <= now:
                prev_tide = tide
            elif tide_time > now and not next_tide:
                next_tide = tide
                break
        
        if not prev_tide or not next_tide:
            return {
                'direction': 'Unknown',
                'percentage': 0.5,
                'is_rising': True,
                'has_predictions': False
            }
        
        # Determine if rising or falling
        is_rising = next_tide['type'] == 'H'
        
        # Calculate percentage through this tide cycle
        prev_time = datetime.strptime(prev_tide['time'], "%Y-%m-%d %H:%M")
        prev_time = self.timezone.localize(prev_time)
        next_time = datetime.strptime(next_tide['time'], "%Y-%m-%d %H:%M")
        next_time = self.timezone.localize(next_time)
        
        total_duration = (next_time - prev_time).total_seconds()
        elapsed = (now - prev_time).total_seconds()
        percentage = elapsed / total_duration if total_duration > 0 else 0.5
        
        # Refine percentage using current water level if available
        if current:
            current_height = current['height']
            prev_height = prev_tide['height']
            next_height = next_tide['height']
            height_range = next_height - prev_height
            
            if abs(height_range) > 0.1:
                height_percentage = (current_height - prev_height) / height_range
                percentage = (percentage + height_percentage) / 2
        
        percentage = max(0.0, min(1.0, percentage))
        
        return {
            'direction': 'Rising' if is_rising else 'Falling',
            'percentage': round(percentage, 3),
            'is_rising': is_rising,
            'prev_tide': prev_tide,
            'next_tide': next_tide,
            'has_predictions': True
        }
    
    def get_all_tide_data(self):
        """Get everything - current level, predictions, and status"""
        current = self.get_current_water_level()
        predictions = self.get_tide_predictions(days=7)
        next_tides = self.get_next_tides()
        todays_tides = self.get_todays_tides()
        status = self.calculate_tide_status()
        
        return {
            'current': current,
            'predictions': predictions,
            'next_high': next_tides['next_high'] if next_tides else None,
            'next_low': next_tides['next_low'] if next_tides else None,
            'todays_tides': todays_tides,
            'status': status,
            'prediction_station': self.prediction_station,
            'observation_station': self.observation_station,
            'station_name': 'Seattle (nearest available)',
            'last_update': datetime.now().isoformat()
        }


if __name__ == "__main__":
    # Test the tide service
    print("\n🌊 Testing Tide Service...\n")
    
    tide_service = TideService()
    
    # Test current water level
    print("1. Current Water Level:")
    current = tide_service.get_current_water_level()
    if current:
        print(f"   Height: {current['height']} {current['unit']}")
        print(f"   Time: {current.get('time_12hr', current['time'])}")
        print(f"   From: {current['station_name']}")
    
    # Test predictions
    print("\n2. Next High/Low Tides:")
    next_tides = tide_service.get_next_tides()
    if next_tides:
        if next_tides['next_high']:
            nh = next_tides['next_high']
            print(f"   Next High: {nh.get('time_12hr', nh['time'])} - {nh['height']} ft")
        if next_tides['next_low']:
            nl = next_tides['next_low']
            print(f"   Next Low: {nl.get('time_12hr', nl['time'])} - {nl['height']} ft")
    
    # Test status
    print("\n3. Tide Status:")
    status = tide_service.calculate_tide_status()
    print(f"   Direction: {status['direction']}")
    print(f"   Progress: {status['percentage']*100:.1f}%")
    print(f"   Is Rising: {status['is_rising']}")
    
    # Test today's tides
    print("\n4. Today's Tides:")
    todays = tide_service.get_todays_tides()
    if todays:
        for tide in todays:
            tide_type = "High" if tide['type'] == 'H' else "Low"
            print(f"   {tide_type}: {tide.get('time_12hr', tide['time'])} - "
                  f"{tide['height']} ft")
    
    print("\n✅ Tide service test complete!")