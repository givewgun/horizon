import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Forecast } from '@horizon/shared';
import type { Map as MaplibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiGetWithStatus } from '../../lib/api.js';
import { useLocation } from '../../context/LocationContext.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { FeedFallback } from '../../components/common/FeedFallback.js';

const OWM_LAYERS = ['clouds', 'precipitation', 'wind', 'temperature'] as const;
type OWMLayer = (typeof OWM_LAYERS)[number];

interface RainViewerFrame {
  time: number;
  path: string;
}

interface RainViewerMeta {
  host: string;
  radar: { past: RainViewerFrame[]; nowcast: RainViewerFrame[] };
}

const RAINVIEWER_META_URL = 'https://api.rainviewer.com/public/weather-maps.json';
const RAINVIEWER_LAYER_ID = 'rainviewer-radar';
const RAINVIEWER_SOURCE_ID = 'rainviewer-src';

export function WeatherMap(): JSX.Element {
  const { location } = useLocation();
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [enabledLayers, setEnabledLayers] = useState<Set<OWMLayer>>(new Set());
  const [radarFrames, setRadarFrames] = useState<RainViewerFrame[]>([]);
  const [radarHost, setRadarHost] = useState<string>('');
  const [radarIndex, setRadarIndex] = useState(0);
  const [radarPlaying, setRadarPlaying] = useState(true);

  const { data: forecast } = useQuery({
    queryKey: ['forecast', location.lat, location.lon],
    queryFn: () => apiGetWithStatus<Forecast>(`/forecast?lat=${location.lat}&lon=${location.lon}`),
    refetchInterval: 10 * 60 * 1000,
  });

  // Boot MapLibre once.
  useEffect(() => {
    let cancelled = false;
    let createdMap: MaplibreMap | null = null;

    void (async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        if (cancelled || !mapContainer.current) return;
        const m = new maplibregl.Map({
          container: mapContainer.current,
          style: {
            version: 8,
            sources: {
              osm: {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '© OpenStreetMap contributors',
              },
            },
            layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
          },
          center: [location.lon, location.lat],
          zoom: 4,
        });
        createdMap = m;
        mapRef.current = m;
        m.on('load', () => {
          if (!cancelled) setMapReady(true);
        });
        m.on('error', (e) => {
          if (!cancelled) setMapError(e?.error?.message ?? 'map error');
        });
      } catch (e) {
        if (!cancelled) setMapError(e instanceof Error ? e.message : 'map load failed');
      }
    })();

    return () => {
      cancelled = true;
      if (createdMap) createdMap.remove();
      mapRef.current = null;
    };
    // Map is created once; recenter handled by the next effect on location change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter on location change.
  useEffect(() => {
    if (mapRef.current && mapReady) {
      mapRef.current.flyTo({ center: [location.lon, location.lat], zoom: 4 });
    }
  }, [location.lat, location.lon, mapReady]);

  // Click popup — register once map is ready and refresh handler when forecast changes.
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const m = mapRef.current;
    void import('maplibre-gl').then(({ default: maplibregl }) => {
      const handler = (e: { lngLat: { lng: number; lat: number } }): void => {
        const { lng, lat } = e.lngLat;
        const f = forecast?.ok ? forecast.data.current : null;
        new maplibregl.Popup()
          .setLngLat([lng, lat])
          .setHTML(
            `<div style="color:#0f172a;font-size:11px">
               <div style="font-weight:600">${lat.toFixed(2)}°, ${lng.toFixed(2)}°</div>
               ${f ? `<div>${f.temperatureC.toFixed(1)}°C · wind ${f.windKph.toFixed(0)} km/h</div>` : ''}
             </div>`,
          )
          .addTo(m);
      };
      m.on('click', handler);
      return () => {
        m.off('click', handler);
      };
    });
  }, [mapReady, forecast]);

  // Fetch RainViewer metadata once.
  useEffect(() => {
    fetch(RAINVIEWER_META_URL)
      .then((r) => r.json())
      .then((meta: RainViewerMeta) => {
        if (!meta?.radar?.past) return;
        setRadarHost(meta.host);
        setRadarFrames(meta.radar.past);
        setRadarIndex(meta.radar.past.length - 1);
      })
      .catch(() => {
        /* radar layer is optional */
      });
  }, []);

  // Apply current radar frame as a tile layer.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !mapReady || radarFrames.length === 0 || !radarHost) return;
    const frame = radarFrames[radarIndex];
    if (!frame) return;
    const tileUrl = `${radarHost}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;

    if (m.getLayer(RAINVIEWER_LAYER_ID)) m.removeLayer(RAINVIEWER_LAYER_ID);
    if (m.getSource(RAINVIEWER_SOURCE_ID)) m.removeSource(RAINVIEWER_SOURCE_ID);
    m.addSource(RAINVIEWER_SOURCE_ID, {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256,
    });
    m.addLayer({
      id: RAINVIEWER_LAYER_ID,
      type: 'raster',
      source: RAINVIEWER_SOURCE_ID,
      paint: { 'raster-opacity': 0.65 },
    });
  }, [mapReady, radarFrames, radarHost, radarIndex]);

  // Radar animation loop.
  useEffect(() => {
    if (!radarPlaying || radarFrames.length < 2) return;
    const id = window.setInterval(() => {
      setRadarIndex((prev) => (prev + 1) % radarFrames.length);
    }, 700);
    return () => window.clearInterval(id);
  }, [radarPlaying, radarFrames.length]);

  // OWM tile layer toggles.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !mapReady) return;
    OWM_LAYERS.forEach((layer) => {
      const enabled = enabledLayers.has(layer);
      const layerId = `owm-${layer}`;
      const sourceId = `owm-${layer}-src`;
      const present = !!m.getSource(sourceId);
      if (enabled && !present) {
        m.addSource(sourceId, {
          type: 'raster',
          tiles: [`/api/weather/owm-tile/${layer}/{z}/{x}/{y}.png`],
          tileSize: 256,
        });
        m.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: { 'raster-opacity': 0.55 },
        });
      } else if (!enabled && present) {
        if (m.getLayer(layerId)) m.removeLayer(layerId);
        m.removeSource(sourceId);
      }
    });
  }, [mapReady, enabledLayers]);

  const toggleLayer = (layer: OWMLayer): void => {
    setEnabledLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  };

  const currentFrameTime = radarFrames[radarIndex]
    ? new Date(radarFrames[radarIndex]!.time * 1000).toISOString().slice(11, 16) + ' UTC'
    : '';

  return (
    <section className="rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">
          Weather map
        </h2>
        <StatusBadge status={forecast && forecast.ok ? forecast.status : 'SNAPSHOT'} />
      </header>

      <div className="mb-2 flex flex-wrap gap-1">
        {OWM_LAYERS.map((layer) => (
          <button
            key={layer}
            onClick={() => toggleLayer(layer)}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              enabledLayers.has(layer)
                ? 'border border-mission-accent bg-mission-accent/20 text-mission-accent'
                : 'border border-slate-600 text-slate-400 hover:border-slate-400'
            }`}
          >
            {layer}
          </button>
        ))}
      </div>

      <div className="relative">
        <div ref={mapContainer} className="h-96 w-full rounded border border-slate-700" />
        {!mapReady && !mapError ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-slate-900/50 text-xs text-slate-400">
            loading map…
          </div>
        ) : null}
        {mapError ? (
          <div className="absolute inset-0 flex items-center justify-center rounded bg-slate-900/80">
            <FeedFallback feedName="weather map" message={mapError} />
          </div>
        ) : null}
      </div>

      {radarFrames.length > 0 ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <button
            onClick={() => setRadarPlaying((p) => !p)}
            className="rounded border border-slate-600 px-2 py-1 hover:border-slate-400"
          >
            {radarPlaying ? '⏸ pause' : '▶ play'}
          </button>
          <input
            type="range"
            min={0}
            max={radarFrames.length - 1}
            value={radarIndex}
            onChange={(e) => {
              setRadarPlaying(false);
              setRadarIndex(Number(e.target.value));
            }}
            className="flex-1"
            aria-label="radar frame"
          />
          <span className="font-mono">{currentFrameTime}</span>
        </div>
      ) : null}
    </section>
  );
}
