import { useMemo } from 'react';
import { useLocation } from '../../context/LocationContext.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';

export function WeatherMap(): JSX.Element {
  const { location } = useLocation();

  const src = useMemo(() => {
    const params = new URLSearchParams({
      type: 'map',
      location: 'coordinates',
      metricRain: 'mm',
      metricTemp: '°C',
      metricWind: 'km/h',
      zoom: '5',
      overlay: 'wind',
      product: 'ecmwf',
      level: 'surface',
      lat: location.lat.toFixed(4),
      lon: location.lon.toFixed(4),
    });
    return `https://embed.windy.com/embed.html?${params.toString()}`;
  }, [location.lat, location.lon]);

  return (
    <section className="rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">
          Weather map
        </h2>
        <StatusBadge status="LIVE" />
      </header>

      <div className="mb-2 text-xs text-slate-400">
        Live conditions near{' '}
        <span className="text-slate-200">
          {location.label ?? `${location.lat.toFixed(2)}°, ${location.lon.toFixed(2)}°`}
        </span>
        . Switch overlays via the Windy toolbar.
      </div>

      <div className="overflow-hidden rounded border border-slate-700">
        <iframe
          key={src}
          src={src}
          title="Windy weather map"
          className="block h-96 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="mt-2 text-[10px] text-slate-500">
        Powered by{' '}
        <a
          href="https://www.windy.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-300"
        >
          Windy.com
        </a>
      </div>
    </section>
  );
}
