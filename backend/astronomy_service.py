"""
Astronomy Service
Handles astronomical data from US Naval Observatory API
"""
import requests
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import pytz


class AstronomyService:
    """Fetches and processes astronomical data from USNO API"""
    
    # Constants
    BASE_URL = "https://aa.usno.navy.mil/api"
    DEFAULT_TIMEZONE = 'America/Los_Angeles'
    
    # Moon phase emojis
    MOON_EMOJIS = {
        'New Moon': '🌑',
        'First Quarter': '🌓',
        'Full Moon': '🌕',
        'Last Quarter': '🌗',
        'Waxing Crescent': '🌒',
        'Waxing Gibbous': '🌔',
        'Waning Gibbous': '🌖',
        'Waning Crescent': '🌘'
    }
    
    # Phase illumination percentages
    PHASE_ILLUMINATION = {
        'New Moon': 0,
        'First Quarter': 50,
        'Full Moon': 100,
        'Last Quarter': 50
    }

    def __init__(self, latitude: float, longitude: float, timezone: str = None):
        self.latitude = latitude
        self.longitude = longitude
        self.timezone = timezone or self.DEFAULT_TIMEZONE
        
        # Caching
        self.moon_phases_cache = {}
        self.cached_month = None
        self.daily_cache = None
        self.cached_date = None

    def _get_timezone_offset(self) -> int:
        """Get current timezone offset accounting for DST"""
        tz = pytz.timezone('America/Los_Angeles')
        now = datetime.now(tz)
        offset_seconds = now.utcoffset().total_seconds()
        return int(offset_seconds / 3600)

    def get_astronomy_data(self) -> Optional[Dict]:
        """Get complete astronomy data (sun/moon rise/set + moon phase)"""
        try:
            rise_set_data = self._get_rise_set_times()
            moon_phase_data = self._get_moon_phase()
            
            if not rise_set_data:
                print("Failed to get rise/set data")
                return None
            
            astronomy_data = {
                # Sun data
                'sunrise': rise_set_data.get('sunrise'),
                'sunset': rise_set_data.get('sunset'),
                'solar_noon': rise_set_data.get('solar_noon'),
                
                # Moon data
                'moonrise': rise_set_data.get('moonrise'),
                'moonset': rise_set_data.get('moonset'),
                
                # Moon phase data
                'moon_phase': moon_phase_data.get('phase_name', 'Unknown'),
                'moon_illumination': moon_phase_data.get('illumination', 0),
                'moon_emoji': moon_phase_data.get('emoji', '🌙'),
                
                # Metadata
                'last_update': datetime.now().isoformat(),
                'date': rise_set_data.get('date')
            }
            
            print(f"Astronomy updated: Sunrise {astronomy_data['sunrise']}, "
                  f"Sunset {astronomy_data['sunset']}, Moon {astronomy_data['moon_phase']}")
            
            return astronomy_data
            
        except Exception as e:
            print(f"Error getting astronomy data: {e}")
            return None

    def _get_rise_set_times(self) -> Optional[Dict]:
        """Get sun/moon rise and set times for today"""
        try:
            today = datetime.now().date()
            
            # Check cache
            if self.cached_date == today and self.daily_cache:
                print("Using cached rise/set data")
                return self.daily_cache
            
            tz_offset = self._get_timezone_offset()
            
            # Fetch today's data
            today_data = self._fetch_day_data(today, tz_offset)
            if not today_data:
                return None
            
            moonrise = today_data.get('moonrise')
            moonset = today_data.get('moonset')
            
            # If no moonrise today, check yesterday
            if not moonrise:
                yesterday = today - timedelta(days=1)
                yesterday_data = self._fetch_day_data(yesterday, tz_offset)
                if yesterday_data and yesterday_data.get('moonrise'):
                    moonrise = f"-1 {yesterday_data['moonrise']}"
            
            # If no moonset today, check tomorrow
            if not moonset:
                tomorrow = today + timedelta(days=1)
                tomorrow_data = self._fetch_day_data(tomorrow, tz_offset)
                if tomorrow_data and tomorrow_data.get('moonset'):
                    moonset = f"+1 {tomorrow_data['moonset']}"
            
            rise_set_data = {
                'date': today.isoformat(),
                'sunrise': today_data.get('sunrise', '--:--'),
                'sunset': today_data.get('sunset', '--:--'),
                'solar_noon': today_data.get('solar_noon', '--:--'),
                'moonrise': moonrise or 'None',
                'moonset': moonset or 'None',
                'timezone_offset': tz_offset
            }
            
            # Cache the data
            self.daily_cache = rise_set_data
            self.cached_date = today
            
            return rise_set_data
            
        except Exception as e:
            print(f"Error fetching rise/set times: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def _fetch_day_data(self, date, tz_offset) -> Optional[Dict]:
        """Fetch rise/set data for a specific day"""
        try:
            url = f"{self.BASE_URL}/rstt/oneday"
            params = {
                'date': date.strftime('%Y-%m-%d'),
                'coords': f"{self.latitude},{self.longitude}",
                'tz': str(tz_offset)
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if 'properties' not in data:
                return None
            
            props = data['properties']['data']
            
            # Extract sun times
            sun_data = props.get('sundata', [])
            sunrise = self._find_phenomenon(sun_data, 'Rise')
            sunset = self._find_phenomenon(sun_data, 'Set')
            solar_noon = self._find_phenomenon(sun_data, 'Upper Transit')
            
            # Extract moon times
            moon_data = props.get('moondata', [])
            moonrise = self._find_phenomenon(moon_data, 'Rise')
            moonset = self._find_phenomenon(moon_data, 'Set')
            
            # Convert all times to 12-hour format
            return {
                'sunrise': self._convert_to_12hr(sunrise),
                'sunset': self._convert_to_12hr(sunset),
                'solar_noon': self._convert_to_12hr(solar_noon),
                'moonrise': self._convert_to_12hr(moonrise),
                'moonset': self._convert_to_12hr(moonset)
            }
            
        except Exception as e:
            print(f"Error fetching data for {date}: {e}")
            return None

    def _find_phenomenon(self, data_list: List, phenomenon: str) -> Optional[str]:
        """Find a specific phenomenon (Rise, Set, etc.) in the data"""
        for item in data_list:
            if item.get('phen') == phenomenon:
                return item.get('time', '--:--')
        return None
    
    def _convert_to_12hr(self, time_str: Optional[str]) -> Optional[str]:
        """Convert 24-hour time to 12-hour format with AM/PM"""
        if not time_str or time_str == '--:--':
            return time_str
        
        try:
            time_obj = datetime.strptime(time_str, '%H:%M')
            return time_obj.strftime('%I:%M %p').lstrip('0')
        except:
            return time_str

    def _get_moon_phase(self) -> Dict:
        """Get current moon phase data"""
        try:
            today = datetime.now()
            current_month = today.strftime('%Y-%m')
            
            # Check if we need to fetch moon phases
            if current_month != self.cached_month or current_month not in self.moon_phases_cache:
                self._fetch_moon_phases(today.year)
            
            return self._calculate_current_phase(today)
            
        except Exception as e:
            print(f"Error getting moon phase: {e}")
            return {
                'phase_name': 'Unknown',
                'illumination': 50,
                'emoji': '🌔'
            }

    def _fetch_moon_phases(self, year: int):
        """Fetch and cache moon phases for the entire year"""
        try:
            tz_offset = self._get_timezone_offset()
            
            url = f"{self.BASE_URL}/moon/phases/year"
            params = {
                'year': year,
                'tz': str(tz_offset)
            }
            
            print(f"Fetching moon phases for {year} (TZ offset: {tz_offset})")
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if 'phasedata' in data:
                # Store phases by month
                for phase in data['phasedata']:
                    month = phase['month']
                    month_key = f"{year}-{month:02d}"
                    
                    if month_key not in self.moon_phases_cache:
                        self.moon_phases_cache[month_key] = []
                    
                    self.moon_phases_cache[month_key].append({
                        'phase': phase['phase'],
                        'date': f"{year}-{month:02d}-{phase['day']:02d}",
                        'time': phase['time']
                    })
                
                self.cached_month = datetime.now().strftime('%Y-%m')
                print(f"Cached moon phases for {year}")
            
        except Exception as e:
            print(f"Error fetching moon phases: {e}")

    def _calculate_current_phase(self, current_date: datetime) -> Dict:
        """Calculate current moon phase based on cached phase data"""
        current_month = current_date.strftime('%Y-%m')
        phases = self.moon_phases_cache.get(current_month, [])
        
        if not phases:
            return {
                'phase_name': 'Unknown',
                'illumination': 50,
                'emoji': '🌔'
            }
        
        # Find the most recent phase and next phase
        current_date_str = current_date.strftime('%Y-%m-%d')
        recent_phase = None
        next_phase = None
        
        for phase in phases:
            if phase['date'] <= current_date_str:
                recent_phase = phase
            elif phase['date'] > current_date_str and not next_phase:
                next_phase = phase
                break
        
        # If no recent phase in this month, check previous month
        if not recent_phase:
            prev_month = (current_date.replace(day=1) - timedelta(days=1))
            prev_month_key = prev_month.strftime('%Y-%m')
            prev_phases = self.moon_phases_cache.get(prev_month_key, [])
            if prev_phases:
                recent_phase = prev_phases[-1]
        
        # Determine current phase
        if recent_phase:
            phase_name, emoji, illumination = self._get_detailed_phase(
                recent_phase, next_phase, current_date
            )
            
            return {
                'phase_name': phase_name,
                'illumination': illumination,
                'emoji': emoji,
                'last_phase_date': recent_phase['date'],
                'next_phase': next_phase['phase'] if next_phase else None,
                'next_phase_date': next_phase['date'] if next_phase else None
            }
        
        return {
            'phase_name': 'Unknown',
            'illumination': 50,
            'emoji': '🌔'
        }

    def _get_detailed_phase(self, recent_phase: Dict, next_phase: Optional[Dict], 
                           current_date: datetime) -> tuple:
        """Get detailed phase name, emoji, and illumination"""
        recent_name = recent_phase['phase']
        
        if not next_phase:
            emoji = self.MOON_EMOJIS.get(recent_name, '🌙')
            illumination = self.PHASE_ILLUMINATION.get(recent_name, 50)
            return (recent_name, emoji, illumination)
        
        # Calculate days since recent phase
        recent_date = datetime.strptime(recent_phase['date'], '%Y-%m-%d')
        next_date = datetime.strptime(next_phase['date'], '%Y-%m-%d')
        total_days = (next_date - recent_date).days
        days_since = (current_date.date() - recent_date.date()).days
        
        progress = days_since / total_days if total_days > 0 else 0
        
        # Determine intermediate phase
        phase_name = recent_name
        
        if recent_name == 'New Moon' and next_phase['phase'] == 'First Quarter':
            phase_name = 'Waxing Crescent'
            emoji = '🌒'
            illumination = int(progress * 50)
        elif recent_name == 'First Quarter' and next_phase['phase'] == 'Full Moon':
            phase_name = 'Waxing Gibbous'
            emoji = '🌔'
            illumination = 50 + int(progress * 50)
        elif recent_name == 'Full Moon' and next_phase['phase'] == 'Last Quarter':
            phase_name = 'Waning Gibbous'
            emoji = '🌖'
            illumination = 100 - int(progress * 50)
        elif recent_name == 'Last Quarter' and next_phase['phase'] == 'New Moon':
            phase_name = 'Waning Crescent'
            emoji = '🌘'
            illumination = 50 - int(progress * 50)
        else:
            emoji = self.MOON_EMOJIS.get(recent_name, '🌙')
            illumination = self.PHASE_ILLUMINATION.get(recent_name, 50)
        
        return (phase_name, emoji, illumination)


if __name__ == "__main__":
    # Test the astronomy service
    print("Testing USNO Astronomy Service...")
    
    astro = AstronomyService(48.2573, -122.5167)
    data = astro.get_astronomy_data()
    
    if data:
        print("\n✅ ASTRONOMY DATA:")
        print(f"Sunrise: {data['sunrise']}")
        print(f"Sunset: {data['sunset']}")
        print(f"Moonrise: {data['moonrise']}")
        print(f"Moonset: {data['moonset']}")
        print(f"Moon Phase: {data['moon_phase']} {data['moon_emoji']}")
        print(f"Moon Illumination: {data['moon_illumination']}%")
    else:
        print("❌ Failed to get astronomy data")