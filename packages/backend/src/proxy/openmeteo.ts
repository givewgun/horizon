/**
 * Open-Meteo weather proxy (free, no API key).
 * 10 min cache. Normalizes to shared Forecast type.
 */

import type { CurrentWeather, DailyForecastPoint, Forecast, HourlyForecastPoint } from '@horizon/shared';
import { TtlCache } from './cache.js';
import { fetchUpstream, UpstreamError } from './http.js';

const FORECAST_TTL_MS = 10 * 60 * 1000;

interface OpenMeteoCurrentWeather {
  temperature_2m?: number;
  weather_code?: number;
  wind_speed_10m?: number;
  time?: string;
}

interface OpenMeteoHourly {
  time?: string[];
  temperature_2m?: number[];
  precipitation_probability?: number[];
}

interface OpenMeteoDaily {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
}

interface OpenMeteoResponse {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  current?: OpenMeteoCurrentWeather;
  hourly?: OpenMeteoHourly;
  daily?: OpenMeteoDaily;
}

function normalizeForecast(
  lat: number,
  lon: number,
  src: OpenMeteoResponse,
): Forecast {
  const now = new Date().toISOString();
  const current = src.current || {};
  const hourly = src.hourly || {};
  const daily = src.daily || {};

  const currentWeather: CurrentWeather = {
    temperatureC: typeof current.temperature_2m === 'number' ? current.temperature_2m : 0,
    windKph: typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : 0,
    weatherCode: typeof current.weather_code === 'number' ? current.weather_code : 0,
    at: typeof current.time === 'string' ? current.time : now,
  };

  const hourlyPoints: HourlyForecastPoint[] = [];
  if (Array.isArray(hourly.time) && Array.isArray(hourly.temperature_2m)) {
    const maxLen = Math.min(hourly.time.length, hourly.temperature_2m.length);
    for (let i = 0; i < maxLen && hourlyPoints.length < 24; i++) {
      const at = hourly.time[i];
      const temp = hourly.temperature_2m[i];
      const precip = hourly.precipitation_probability?.[i] ?? 0;
      if (typeof at === 'string' && typeof temp === 'number') {
        hourlyPoints.push({
          at,
          temperatureC: temp,
          precipProbability: typeof precip === 'number' ? precip : 0,
        });
      }
    }
  }

  const dailyPoints: DailyForecastPoint[] = [];
  if (Array.isArray(daily.time) && Array.isArray(daily.weather_code)) {
    const maxLen = Math.min(daily.time.length, daily.weather_code.length);
    for (let i = 0; i < maxLen && dailyPoints.length < 7; i++) {
      const date = daily.time[i];
      const code = daily.weather_code[i];
      const tMax = daily.temperature_2m_max?.[i];
      const tMin = daily.temperature_2m_min?.[i];
      if (typeof date === 'string' && typeof code === 'number') {
        dailyPoints.push({
          date,
          weatherCode: code,
          tMaxC: typeof tMax === 'number' ? tMax : 0,
          tMinC: typeof tMin === 'number' ? tMin : 0,
        });
      }
    }
  }

  return {
    location: { lat, lon },
    current: currentWeather,
    hourly: hourlyPoints,
    daily: dailyPoints,
    ...(typeof src.timezone === 'string' && { timezone: src.timezone }),
    fetchedAt: now,
  };
}

export class OpenMeteoClient {
  private cache = new TtlCache<Forecast>(FORECAST_TTL_MS);
  private base = 'https://api.open-meteo.com/v1';

  async forecast(
    lat: number,
    lon: number,
  ): Promise<{ data: Forecast; ageMs: number }> {
    const key = `forecast:${lat}:${lon}`;
    return this.cache.get(key, async () => {
      const url = new URL(`${this.base}/forecast`);
      url.searchParams.set('latitude', String(lat));
      url.searchParams.set('longitude', String(lon));
      url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m');
      url.searchParams.set('hourly', 'temperature_2m,precipitation_probability');
      url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');
      url.searchParams.set('timezone', 'auto');

      const json = (await fetchUpstream(url.toString())) as OpenMeteoResponse;
      if (
        typeof json.latitude !== 'number' ||
        typeof json.longitude !== 'number'
      ) {
        throw new UpstreamError('invalid Open-Meteo response');
      }
      return normalizeForecast(json.latitude, json.longitude, json);
    });
  }

  lastGood(lat: number, lon: number): { data: Forecast; ageMs: number } | undefined {
    return this.cache.lastGood(`forecast:${lat}:${lon}`);
  }
}
