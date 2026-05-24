import { useMemo } from 'react';
import { useLocation } from '../../context/LocationContext.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';

/**
 * Embeds Windy's public map with the `webcams` overlay enabled, centred on the
 * user's current location. Windy returns real, kept-alive webcam pins. The
 * embed works without an API key — clicking a pin opens the webcam page on
 * windy.com in a new tab from inside the iframe.
 */
export function CityWebcams(): JSX.Element {
  const { location } = useLocation();

  const src = useMemo(() => {
    const params = new URLSearchParams({
      type: 'map',
      location: 'coordinates',
      metricRain: 'mm',
      metricTemp: '°C',
      metricWind: 'km/h',
      zoom: '7',
      overlay: 'webcams',
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
          City webcams
        </h2>
        <StatusBadge status="LIVE" />
      </header>

      <div className="mb-2 text-xs text-slate-400">
        Live webcam pins near{' '}
        <span className="text-slate-200">
          {location.label ?? `${location.lat.toFixed(2)}°, ${location.lon.toFixed(2)}°`}
        </span>
        . Click a pin → opens the cam.
      </div>

      <div className="overflow-hidden rounded border border-slate-700">
        <iframe
          key={src}
          src={src}
          title="Windy webcams"
          className="block h-96 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="mt-2 text-[10px] text-slate-500">
        Powered by{' '}
        <a
          href="https://www.windy.com/-Webcams/webcams"
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
