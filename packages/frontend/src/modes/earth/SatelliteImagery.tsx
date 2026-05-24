import { useEffect, useState } from 'react';
import { StatusBadge } from '../../components/common/StatusBadge.js';

const SECTORS = [
  { id: 'himawari', label: 'Himawari · Asia' },
  { id: 'goes-east', label: 'GOES-East · Americas' },
  { id: 'goes-west', label: 'GOES-West · Pacific' },
] as const;

const PRODUCTS = [
  { id: 'geocolor', label: 'GeoColor' },
  { id: 'ir', label: 'IR (band 13)' },
  { id: 'wv', label: 'Water Vapor' },
] as const;

type Sector = (typeof SECTORS)[number]['id'];
type Product = (typeof PRODUCTS)[number]['id'];

const REFRESH_MS = 5 * 60 * 1000;

export function SatelliteImagery(): JSX.Element {
  const [sector, setSector] = useState<Sector>('himawari');
  const [product, setProduct] = useState<Product>('geocolor');
  const [bust, setBust] = useState(Date.now());
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
    setBust(Date.now());
    const id = window.setInterval(() => setBust(Date.now()), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [sector, product]);

  const src = `/api/imagery/${sector}/${product}/latest.jpg?t=${bust}`;

  return (
    <section className="rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">
          Satellite imagery
        </h2>
        <StatusBadge status={imgError ? 'SNAPSHOT' : 'REALTIME'} />
      </header>

      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap gap-1">
          {SECTORS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSector(s.id)}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                sector === s.id
                  ? 'border border-mission-accent bg-mission-accent/20 text-mission-accent'
                  : 'border border-slate-600 text-slate-400 hover:border-slate-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {PRODUCTS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProduct(p.id)}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                product === p.id
                  ? 'border border-mission-accent bg-mission-accent/20 text-mission-accent'
                  : 'border border-slate-600 text-slate-400 hover:border-slate-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden rounded border border-slate-700 bg-black">
        {imgError ? (
          <div className="flex h-72 items-center justify-center text-xs text-slate-500">
            imagery temporarily unavailable
          </div>
        ) : (
          <img
            key={src}
            src={src}
            alt={`${sector} ${product} satellite`}
            className="block h-auto w-full"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>Source: NESDIS / JMA · auto-refresh every 5 min</span>
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
