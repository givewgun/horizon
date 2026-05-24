/**
 * Night-sky panel. Stereographic alt-az render centred on whatever location
 * the globe pin selects, falling back to the user's home location.
 *
 * Style notes (the previous version was "lines on a black square"):
 *   - Twilight gradient background (dark navy at horizon → near-black at zenith).
 *   - A faint Milky Way band, hand-positioned via galactic-pole rotation.
 *   - Stars get magnitude-scaled radii AND a soft halo for the bright ones,
 *     plus a seeded "ambient" field of dim background stars so the sky looks
 *     populated even when the catalog is sparse.
 *   - Cardinal compass markers (N/E/S/W).
 *   - Hover any star to see constellation + mythology + brightest star + season.
 *   - Time scrubber +0…+12h shows what's overhead later tonight.
 *
 * We use our own canvas instead of d3-celestial (see ADR-0003).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Constellation } from '@horizon/shared';
import { useLocation } from '../../context/LocationContext.js';
import { useGlobeStore } from '../../lib/globeStore.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Skeleton } from '../../components/common/Skeleton.js';
import { FeedFallback } from '../../components/common/FeedFallback.js';
import {
  altAzToStereographic,
  equatorialToHorizontal,
  type Xy,
} from '../../lib/skymath.js';
import { formatUtcAndBangkok } from '../../lib/time.js';

interface HoverState {
  x: number;
  y: number;
  constellation: Constellation;
}

interface AmbientStar {
  raHours: number;
  decDeg: number;
  mag: number;
}

// Deterministic background star field — same seed every render so the sky
// doesn't shimmer between frames. Distribution is roughly isotropic on the
// celestial sphere using the inverse-cosine trick for declination.
function buildAmbient(count: number, seed = 17): AmbientStar[] {
  let s = seed;
  const rand = (): number => {
    s = (s * 1664525 + 1013904223) % 0xffffffff;
    return s / 0xffffffff;
  };
  const out: AmbientStar[] = [];
  for (let i = 0; i < count; i += 1) {
    const ra = rand() * 24;
    const dec = (Math.acos(2 * rand() - 1) * 180) / Math.PI - 90;
    const mag = 4 + rand() * 2.5;
    out.push({ raHours: ra, decDeg: dec, mag });
  }
  return out;
}

const AMBIENT = buildAmbient(900);

function magToRadius(mag: number): number {
  return Math.max(0.6, 4.5 - mag * 0.7);
}

function magToAlpha(mag: number): number {
  if (mag < 1) return 1;
  if (mag > 6) return 0.18;
  return 1 - (mag - 1) * 0.16;
}

/** Approximate Milky Way centre-line: galactic latitude 0 sampled by lon. */
const MILKY_WAY: Array<{ ra: number; dec: number }> = (() => {
  // Galactic pole (J2000) is at RA 12.86h, Dec +27.13°. We sample (lon, 0)
  // around the galactic equator and rotate into equatorial coords.
  const galPoleRa = 12.8606 * 15 * (Math.PI / 180);
  const galPoleDec = 27.1283 * (Math.PI / 180);
  const out: Array<{ ra: number; dec: number }> = [];
  for (let l = 0; l < 360; l += 2) {
    const lRad = (l * Math.PI) / 180;
    // galactic (l, b=0) → equatorial (RA, Dec)
    const x = Math.cos(lRad);
    const y = Math.sin(lRad);
    // rotation matrix (galactic-to-equatorial) via pole.
    const sinDec =
      Math.cos(galPoleDec) * y; // simplified for b=0
    const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
    const ra = galPoleRa + Math.atan2(Math.sin(galPoleDec) * y, x);
    out.push({ ra: (((ra * 180) / Math.PI / 15) + 24) % 24, dec: (dec * 180) / Math.PI });
  }
  return out;
})();

export function NightSky(): JSX.Element {
  const { location } = useLocation();
  const pin = useGlobeStore((s) => s.pin);
  const setPin = useGlobeStore((s) => s.setPin);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hour, setHour] = useState(0);
  const [hover, setHover] = useState<HoverState | null>(null);

  const view = useMemo(
    () => ({
      lat: pin?.lat ?? location.lat,
      lon: pin?.lon ?? location.lon,
      label: pin ? `pin · ${pin.lat.toFixed(2)}, ${pin.lon.toFixed(2)}` : (location.label ?? 'home'),
    }),
    [pin, location.lat, location.lon, location.label],
  );

  const { data, isLoading, isError, refetch } = useQuery<Constellation[]>({
    queryKey: ['constellations'],
    queryFn: async () => {
      const res = await fetch('/static/constellations.json');
      if (!res.ok) throw new Error(`constellations fetch failed: ${res.status}`);
      return (await res.json()) as Constellation[];
    },
    staleTime: 24 * 3600_000,
  });

  const when = useMemo(() => new Date(Date.now() + hour * 3600_000), [hour]);

  const projected = useMemo(() => {
    if (!data) return { constellations: [], ambient: [] as Array<{ xy: Xy; mag: number }>, milky: [] as Array<Xy | null> };
    const project = (raH: number, dec: number): Xy | null => {
      const aa = equatorialToHorizontal(raH, dec, view.lat, view.lon, when);
      return altAzToStereographic(aa);
    };
    const constellations = data.map((c) => {
      const stars = c.stars.map((s) => ({ ...s, xy: project(s.raHours, s.decDeg) }));
      return { c, stars };
    });
    const ambient: Array<{ xy: Xy; mag: number }> = [];
    for (const a of AMBIENT) {
      const xy = project(a.raHours, a.decDeg);
      if (xy) ambient.push({ xy, mag: a.mag });
    }
    const milky = MILKY_WAY.map((p) => project(p.ra, p.dec));
    return { constellations, ambient, milky };
  }, [data, view.lat, view.lon, when]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(canvas.clientWidth, canvas.clientHeight);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const r = (size / 2) * 0.95;
    const cx = (size / 2) * dpr;
    const cy = (size / 2) * dpr;
    const scale = r * dpr;

    // Radial twilight gradient — darkest at zenith, soft navy at horizon.
    const grad = ctx.createRadialGradient(cx, cy, scale * 0.05, cx, cy, scale * 1.05);
    grad.addColorStop(0, '#02030a');
    grad.addColorStop(0.7, '#070b1d');
    grad.addColorStop(1, '#11203b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Milky Way ribbon — draw a wide soft polyline through the projected points.
    const milky = projected.milky;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(180, 200, 255, 0.07)';
    ctx.lineWidth = 22 * dpr;
    ctx.lineCap = 'round';
    let drawing = false;
    ctx.beginPath();
    for (const p of milky) {
      if (!p) {
        drawing = false;
        continue;
      }
      const px = cx + p.x * scale;
      const py = cy + p.y * scale;
      if (!drawing) {
        ctx.moveTo(px, py);
        drawing = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.lineWidth = 10 * dpr;
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.05)';
    ctx.stroke();
    ctx.restore();

    // Horizon circle + cardinal labels.
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.arc(cx, cy, scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = `${11 * dpr}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - scale - 10 * dpr);
    ctx.fillText('S', cx, cy + scale + 10 * dpr);
    ctx.fillText('E', cx + scale + 10 * dpr, cy);
    ctx.fillText('W', cx - scale - 10 * dpr, cy);

    // Ambient background stars.
    for (const a of projected.ambient) {
      const px = cx + a.xy.x * scale;
      const py = cy + a.xy.y * scale;
      ctx.fillStyle = `rgba(226, 232, 240, ${magToAlpha(a.mag)})`;
      ctx.beginPath();
      ctx.arc(px, py, magToRadius(a.mag) * dpr * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Constellation lines.
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1 * dpr;
    for (const { c, stars } of projected.constellations) {
      const byId = new Map(stars.map((s) => [s.id, s] as const));
      for (const [a, b] of c.lines) {
        const sa = byId.get(a);
        const sb = byId.get(b);
        if (!sa?.xy || !sb?.xy) continue;
        ctx.beginPath();
        ctx.moveTo(cx + sa.xy.x * scale, cy + sa.xy.y * scale);
        ctx.lineTo(cx + sb.xy.x * scale, cy + sb.xy.y * scale);
        ctx.stroke();
      }
    }

    // Named stars with halos for the bright ones.
    for (const { stars } of projected.constellations) {
      for (const s of stars) {
        if (!s.xy) continue;
        const px = cx + s.xy.x * scale;
        const py = cy + s.xy.y * scale;
        const radius = magToRadius(s.mag) * dpr;
        if (s.mag < 1.8) {
          const halo = ctx.createRadialGradient(px, py, 0, px, py, radius * 5);
          halo.addColorStop(0, 'rgba(226, 232, 240, 0.55)');
          halo.addColorStop(1, 'rgba(226, 232, 240, 0)');
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(px, py, radius * 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [projected]);

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const r = (size / 2) * 0.95;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    let best: { dist: number; c: Constellation } | null = null;
    for (const { c, stars } of projected.constellations) {
      for (const s of stars) {
        if (!s.xy) continue;
        const px = cx + s.xy.x * r;
        const py = cy + s.xy.y * r;
        const dist = Math.hypot(px - localX, py - localY);
        if (dist < 16 && (!best || dist < best.dist)) {
          best = { dist, c };
        }
      }
    }
    setHover(best ? { x: localX, y: localY, constellation: best.c } : null);
  };

  const t = formatUtcAndBangkok(when);

  return (
    <section className="rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">
          Night sky · {view.label}
        </h2>
        <div className="flex items-center gap-2">
          {pin ? (
            <button
              type="button"
              onClick={() => setPin(null)}
              className="rounded border border-mission-edge px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider hover:bg-mission-edge"
            >
              use home
            </button>
          ) : (
            <span className="font-mono text-[10px] text-slate-500">
              click globe to view from another location
            </span>
          )}
          <StatusBadge status="REALTIME" />
        </div>
      </header>

      {isLoading ? (
        <Skeleton rows={6} />
      ) : isError || !data ? (
        <FeedFallback
          feedName="constellations"
          message="catalog failed to load"
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="relative aspect-square w-full">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="night sky"
              className="h-full w-full rounded-full"
              onMouseMove={handleMove}
              onMouseLeave={() => setHover(null)}
            />
            {hover ? (
              <div
                className="pointer-events-none absolute z-10 rounded border border-mission-edge bg-mission-panel/95 p-2 text-[10px] text-slate-200 shadow-lg"
                style={{
                  left: Math.min(hover.x + 10, 220),
                  top: Math.max(0, hover.y - 60),
                  maxWidth: 240,
                }}
              >
                <div className="font-mono text-mission-accent">
                  {hover.constellation.name} ({hover.constellation.abbr})
                </div>
                <div className="text-slate-400">
                  brightest: {hover.constellation.brightestStar} · {hover.constellation.season}
                </div>
                <div className="mt-1 text-slate-300">{hover.constellation.myth}</div>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400">
            <label htmlFor="sky-scrub" className="uppercase tracking-wider">
              now → +12h
            </label>
            <input
              id="sky-scrub"
              type="range"
              min={0}
              max={12}
              step={0.25}
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="flex-1"
              aria-label="advance sky time"
            />
            <span>+{hour.toFixed(1)}h</span>
          </div>
          <div className="font-mono text-[10px] text-slate-500">
            showing · {t.utc} · {t.bangkok}
          </div>
        </div>
      )}
    </section>
  );
}
