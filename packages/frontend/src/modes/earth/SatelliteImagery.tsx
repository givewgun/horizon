import { useEffect, useMemo, useState } from 'react';
import { useLocation } from '../../context/LocationContext.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';

const REFRESH_MS = 5 * 60 * 1000;

interface SatChoice {
  sector: 'himawari' | 'goes-east' | 'goes-west';
  label: string;
  subLat: number;
  subLon: number;
  /** Products that actually return distinct images for this satellite. */
  products: ('geocolor' | 'ir' | 'wv')[];
}

/** Pick the right geostationary satellite for a given user longitude. */
function pickSatellite(lon: number): SatChoice {
  // Himawari-9 ~ 140°E. Useful for lon roughly 50°E .. 180° (Asia / Oceania).
  if (lon >= 50 && lon <= 180) {
    return {
      sector: 'himawari',
      label: 'Himawari-9 · Asia / Oceania',
      subLat: 0,
      subLon: 140,
      products: ['geocolor'],
    };
  }
  // GOES-18 (GOES-West) ~ 137°W. Useful for lon roughly -180 .. -100 (Pacific, west US).
  if (lon >= -180 && lon < -100) {
    return {
      sector: 'goes-west',
      label: 'GOES-West · Pacific',
      subLat: 0,
      subLon: -137,
      products: ['geocolor', 'ir', 'wv'],
    };
  }
  // GOES-16 (GOES-East) ~ 75°W. Useful for lon roughly -100 .. 30 (E US, Atlantic, Europe, W Africa).
  return {
    sector: 'goes-east',
    label: 'GOES-East · Americas / Atlantic',
    subLat: 0,
    subLon: -75,
    products: ['geocolor', 'ir', 'wv'],
  };
}

/**
 * Orthographic projection of a (lat, lon) onto a normalized disk centred on the
 * sub-satellite point. Returns null when the point is on the far side. Good
 * enough for a "you are here" overlay near the centre of a geostationary
 * full-disk image; not accurate near the limb.
 */
function projectToDisk(
  lat: number,
  lon: number,
  subLat: number,
  subLon: number,
): { x: number; y: number } | null {
  const phi = (lat * Math.PI) / 180;
  const phi0 = (subLat * Math.PI) / 180;
  const dLon = (((lon - subLon + 540) % 360) - 180) * (Math.PI / 180);
  const cosC = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(dLon);
  if (cosC <= 0) return null;
  const x = Math.cos(phi) * Math.sin(dLon);
  const y = Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(dLon);
  return { x, y };
}

const PRODUCT_LABEL: Record<'geocolor' | 'ir' | 'wv', string> = {
  geocolor: 'GeoColor',
  ir: 'IR',
  wv: 'Water Vapor',
};

export function SatelliteImagery(): JSX.Element {
  const { location } = useLocation();
  const sat = useMemo(() => pickSatellite(location.lon), [location.lon]);
  const [product, setProduct] = useState<'geocolor' | 'ir' | 'wv'>('geocolor');
  const [bust, setBust] = useState(Date.now());
  const [imgError, setImgError] = useState(false);

  // If we switched satellite and the previously selected product is unavailable,
  // fall back to GeoColor.
  useEffect(() => {
    if (!sat.products.includes(product)) setProduct('geocolor');
  }, [sat, product]);

  useEffect(() => {
    setImgError(false);
    setBust(Date.now());
    const id = window.setInterval(() => setBust(Date.now()), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [sat.sector, product]);

  const src = `/api/imagery/${sat.sector}/${product}/latest.jpg?t=${bust}`;
  const marker = projectToDisk(location.lat, location.lon, sat.subLat, sat.subLon);

  return (
    <section className="rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">
          Satellite globe
        </h2>
        <StatusBadge status={imgError ? 'SNAPSHOT' : 'REALTIME'} />
      </header>

      <div className="mb-2 text-xs text-slate-400">
        <span className="text-slate-200">{sat.label}</span>
        <span className="ml-2 text-slate-500">
          · centred on {location.label ?? `${location.lat.toFixed(2)}°, ${location.lon.toFixed(2)}°`}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {(['geocolor', 'ir', 'wv'] as const).map((p) => {
          const available = sat.products.includes(p);
          const active = product === p;
          return (
            <button
              key={p}
              disabled={!available}
              onClick={() => available && setProduct(p)}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                active
                  ? 'border border-mission-accent bg-mission-accent/20 text-mission-accent'
                  : available
                    ? 'border border-slate-600 text-slate-400 hover:border-slate-400'
                    : 'cursor-not-allowed border border-slate-800 text-slate-600'
              }`}
              title={available ? PRODUCT_LABEL[p] : `${PRODUCT_LABEL[p]} (not available for this satellite)`}
            >
              {PRODUCT_LABEL[p]}
            </button>
          );
        })}
      </div>

      <div className="relative overflow-hidden rounded-full border border-slate-700 bg-black shadow-[inset_0_0_60px_rgba(0,0,0,0.9)]" style={{ aspectRatio: '1 / 1' }}>
        {imgError ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
            imagery temporarily unavailable
          </div>
        ) : (
          <>
            <img
              key={src}
              src={src}
              alt={`${sat.label} ${PRODUCT_LABEL[product]}`}
              className="block h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
            {marker ? (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: `${50 + marker.x * 50}%`,
                  top: `${50 - marker.y * 50}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                aria-label="your location"
              >
                <div className="h-3 w-3 rounded-full bg-mission-accent ring-2 ring-mission-accent/50 animate-pulse" />
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>Source: NESDIS / BoM · auto-refresh 5 min</span>
        <button
          onClick={() => {
            setImgError(false);
            setBust(Date.now());
          }}
          className="rounded border border-slate-700 px-2 py-0.5 hover:border-slate-400"
        >
          refresh
        </button>
      </div>
    </section>
  );
}
