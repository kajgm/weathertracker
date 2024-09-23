export interface WeatherResponse {
  current: {
    time: Date;
    temperature2m: number;
    precipitation: number;
    weatherCode: number;
  };
  hourly: {
    temperature2m: number;
    relativeHumidity2m: number;
    precipitationProbability: number;
    precipitation: number;
    weatherCode: number;
  };
  daily: {
    weatherCode: number;
    temperature2mMax: number;
    temperature2mMin: number;
  };
}

export const WeatherCodeMap = {
  0: { label: 'Clear', icon: 'day-sunny' },
  1: { label: 'Mostly Clear', icon: 'day-cloudy' },
  2: { label: 'Partly Cloudy', icon: 'day-sunny-overcast' },
  3: { label: 'Cloudy', icon: 'cloud' },
  45: { label: 'Fog', icon: 'day-fog' },
  48: { label: 'Freezing Fog', icon: 'fog' },
  51: { label: 'Light Drizzle', icon: 'day-rain-mix' },
  53: { label: 'Drizzle', icon: 'rain-mix' },
  55: { label: 'Heavy Drizzle', icon: 'rain-mix' },
  56: { label: 'Light Freezing Drizzle', icon: 'rain-mix' },
  57: { label: 'Freezing Drizzle', icon: 'rain-mix' },
  61: { label: 'Light Rain', icon: 'rain-mix' },
  63: { label: 'Rain', icon: 'rain' },
  65: { label: 'Heavy Rain', icon: 'rain' },
  66: { label: 'Light Freezing Rain', icon: 'sleet' },
  67: { label: 'Freezing Rain', icon: 'sleet' },
  71: { label: 'Light Snow', icon: 'snow' },
  73: { label: 'Snow', icon: 'snow' },
  75: { label: 'Heavy Snow', icon: 'snow-wind' },
  77: { label: 'Snow Grains', icon: 'snow' },
  80: { label: 'Light Rain Shower', icon: 'showers' },
  81: { label: 'Rain Shower', icon: 'showers' },
  82: { label: 'Heavy Rain Shower', icon: 'showers' },
  85: { label: 'Snow Shower', icon: 'snow' },
  86: { label: 'Heavy Snow Shower', icon: 'snow-wind' },
  95: { label: 'Thunderstorm', icon: 'storm-showers' },
  96: { label: 'Hailstorm', icon: 'hail' },
  99: { label: 'Heavy Hailstorm', icon: 'hail' }
};
