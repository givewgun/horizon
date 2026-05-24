import { useQuery } from '@tanstack/react-query';
import type { Forecast } from '@horizon/shared';
import { apiGetWithStatus } from '../../lib/api.js';
import { useLocation } from '../../context/LocationContext.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Skeleton } from '../../components/common/Skeleton.js';
import { FeedFallback } from '../../components/common/FeedFallback.js';
import { formatUtcAndBangkok } from '../../lib/time.js';

const WMO_CODES: Record<number, { name: string; icon: string }> = {
  0: { name: 'Clear', icon: '☀️' },
  1: { name: 'Mostly clear', icon: '🌤️' },
  2: { name: 'Partly cloudy', icon: '⛅' },
  3: { name: 'Overcast', icon: '☁️' },
  45: { name: 'Foggy', icon: '🌫️' },
  48: { name: 'Freezing fog', icon: '❄️' },
  51: { name: 'Light drizzle', icon: '🌦️' },
  53: { name: 'Moderate drizzle', icon: '🌧️' },
  55: { name: 'Dense drizzle', icon: '🌧️' },
  61: { name: 'Slight rain', icon: '🌧️' },
  63: { name: 'Moderate rain', icon: '🌧️' },
  65: { name: 'Heavy rain', icon: '⛈️' },
  80: { name: 'Slight showers', icon: '🌦️' },
  81: { name: 'Moderate showers', icon: '🌧️' },
  82: { name: 'Violent showers', icon: '⛈️' },
  85: { name: 'Slight snow', icon: '🌨️' },
  86: { name: 'Heavy snow', icon: '🌨️' },
  95: { name: 'Thunderstorm', icon: '⛈️' },
  96: { name: 'Hail thunderstorm', icon: '⛈️' },
  99: { name: 'Hail thunderstorm', icon: '⛈️' },
};

function getWeatherName(code: number): { name: string; icon: string } {
  return WMO_CODES[code] ?? { name: 'Unknown', icon: '❓' };
}

export function LocalForecast(): JSX.Element {
  const { location } = useLocation();
  const lat = location.lat;
  const lon = location.lon;

  const { data: result, isLoading, error } = useQuery({
    queryKey: ['forecast', lat, lon],
    queryFn: () => apiGetWithStatus<Forecast>(`/forecast?lat=${lat}&lon=${lon}`),
    refetchInterval: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <section className="rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">
            Local forecast
          </h2>
          <StatusBadge status="SNAPSHOT" />
        </header>
        <Skeleton rows={3} />
      </section>
    );
  }

  if (error || !result || !result.ok) {
    return (
      <section className="rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">
            Local forecast
          </h2>
          <StatusBadge status="SNAPSHOT" />
        </header>
        <FeedFallback feedName="forecast" />
      </section>
    );
  }

  const forecast = result.data;
  const current = forecast.current;
  const weather = getWeatherName(current.weatherCode);

  return (
    <section className="rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">
          Local forecast
        </h2>
        <StatusBadge status={result.status} />
      </header>

      {/* Current conditions */}
      <div className="mb-4 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl">{weather.icon}</div>
            <div className="mt-1 text-xs text-slate-400">{weather.name}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-100">{current.temperatureC}°C</div>
            <div className="text-xs text-slate-400">Wind {current.windKph.toFixed(0)} km/h</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          {formatUtcAndBangkok(current.at).utc}
        </div>
      </div>

      {/* 24h hourly strip */}
      {forecast.hourly.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-300">24-hour forecast</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {forecast.hourly.slice(0, 24).map((point: typeof forecast.hourly[0], idx: number) => {
              const time = new Date(point.at);
              const hour = time.getUTCHours();
              return (
                <div key={idx} className="min-w-fit rounded border border-slate-700 bg-slate-900/30 p-2 text-center text-xs">
                  <div className="text-slate-400">{hour}h</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">{point.temperatureC}°</div>
                  <div className="text-slate-500">{point.precipProbability}% 💧</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7-day daily strip */}
      {forecast.daily.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-300">7-day forecast</h3>
          <div className="space-y-1">
            {forecast.daily.slice(0, 7).map((point: typeof forecast.daily[0], idx: number) => {
              const dayWeather = getWeatherName(point.weatherCode);
              const date = new Date(point.date);
              const dayName = date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded border border-slate-700/50 bg-slate-900/30 px-3 py-2 text-xs"
                >
                  <div>
                    <div className="text-slate-300">{dayName}</div>
                    <div className="text-slate-500">{dayWeather.name}</div>
                  </div>
                  <div className="text-lg">{dayWeather.icon}</div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-100">{point.tMaxC}°</div>
                    <div className="text-slate-500">{point.tMinC}°</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
