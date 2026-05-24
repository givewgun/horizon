/**
 * Space-weather panel. Three cards:
 *   1. Kp gauge + 3-day forecast strip — planetary geomagnetic activity.
 *   2. Solar wind — bulk speed, density, IMF Bz (negative Bz favours aurora).
 *   3. GOES X-ray — current flare class (A/B/C/M/X) + short-channel readout.
 * Plus an aurora-likelihood readout that combines Kp, |latitude|, and Bz.
 *
 * Any sub-feed (wind, X-ray) can be missing; the panel just hides that card.
 * Only Kp is load-bearing — if it's missing we surface a FeedFallback.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { KpReading, SpaceWeather } from '@horizon/shared';
import { apiGet } from '../../lib/api.js';
import { useLocation } from '../../context/LocationContext.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Skeleton } from '../../components/common/Skeleton.js';
import { FeedFallback } from '../../components/common/FeedFallback.js';
import { formatUtcAndBangkok } from '../../lib/time.js';

function kpTextColor(kp: number): string {
  if (kp < 4) return 'text-mission-live';
  if (kp < 5) return 'text-mission-realtime';
  if (kp < 7) return 'text-mission-warn';
  return 'text-mission-danger';
}
function kpBgColor(kp: number): string {
  if (kp < 4) return 'bg-mission-live';
  if (kp < 5) return 'bg-mission-realtime';
  if (kp < 7) return 'bg-mission-warn';
  return 'bg-mission-danger';
}
function flareTextColor(cls: string): string {
  const letter = cls[0];
  if (letter === 'X') return 'text-mission-danger';
  if (letter === 'M') return 'text-mission-warn';
  if (letter === 'C') return 'text-mission-realtime';
  return 'text-mission-live';
}

function KpGauge({ kp }: { kp: number }): JSX.Element {
  const pct = Math.min(1, Math.max(0, kp / 9));
  return (
    <div className="flex items-center gap-3">
      <div className={`font-mono text-3xl ${kpTextColor(kp)}`}>{kp.toFixed(1)}</div>
      <div className="flex-1">
        <div className="h-2 w-full overflow-hidden rounded bg-mission-edge">
          <div className={`h-full ${kpBgColor(kp)}`} style={{ width: `${pct * 100}%` }} />
        </div>
        <div className="mt-0.5 flex justify-between font-mono text-[10px] text-slate-500">
          <span>0 quiet</span>
          <span>5 storm</span>
          <span>9 extreme</span>
        </div>
      </div>
    </div>
  );
}

function ForecastStrip({ items }: { items: KpReading[] }): JSX.Element {
  if (items.length === 0) {
    return <div className="text-xs text-slate-500">No forecast points published.</div>;
  }
  return (
    <ol className="flex gap-1 overflow-x-auto">
      {items.map((r) => {
        const h = Math.round(8 + (Math.min(9, Math.max(0, r.kp)) / 9) * 40);
        return (
          <li
            key={r.time}
            className="flex w-10 flex-col items-center"
            title={`${formatUtcAndBangkok(r.time).utc} · Kp ${r.kp.toFixed(1)}`}
          >
            <div
              className={`w-3 rounded ${kpBgColor(r.kp)}`}
              style={{ height: `${h}px` }}
              aria-label={`Kp ${r.kp.toFixed(1)}`}
            />
            <div className="mt-1 font-mono text-[9px] text-slate-500">
              {new Date(r.time).getUTCHours().toString().padStart(2, '0')}Z
            </div>
          </li>
        );
      })}
    </ol>
  );
}

interface MetricProps {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}
function Metric({ label, value, hint, tone = 'text-slate-100' }: MetricProps): JSX.Element {
  return (
    <div className="rounded border border-mission-edge bg-mission-bg/40 p-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className={`font-mono text-lg ${tone}`}>{value}</div>
      {hint ? <div className="font-mono text-[10px] text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function SpaceWeatherPanel(): JSX.Element {
  const { location } = useLocation();
  const { data, isLoading, isError, refetch } = useQuery<SpaceWeather>({
    queryKey: ['spaceweather', Math.round(location.lat)],
    queryFn: () => apiGet<SpaceWeather>(`/spaceweather?lat=${location.lat}`),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  const latitudeNote = useMemo(() => {
    const absLat = Math.abs(location.lat);
    if (absLat < 40) return 'Aurora from your latitude requires a severe geomagnetic storm.';
    if (absLat < 55) return 'Aurora visible from your latitude during moderate storms.';
    return 'Aurora visible most active nights at your latitude.';
  }, [location.lat]);

  return (
    <section className="rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">
          Space weather · NOAA SWPC
        </h2>
        <StatusBadge status="LIVE" />
      </header>

      {isLoading ? (
        <Skeleton rows={3} />
      ) : isError || !data ? (
        <FeedFallback
          feedName="space weather"
          message="upstream unavailable"
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate-400">
              planetary K-index (current · {data.current.kind})
            </div>
            <KpGauge kp={data.current.kp} />
            <div className="mt-1 font-mono text-[10px] text-slate-500">
              {formatUtcAndBangkok(data.current.time).utc}
            </div>
          </div>

          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate-400">
              3-day forecast (Kp per 3h window)
            </div>
            <ForecastStrip items={data.forecast} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {data.solarWind ? (
              <>
                <Metric
                  label="solar wind"
                  value={`${data.solarWind.speedKms.toFixed(0)} km/s`}
                  hint={`density ${data.solarWind.densityPcc.toFixed(1)} /cc`}
                />
                <Metric
                  label="IMF Bz"
                  value={`${data.solarWind.bzNt.toFixed(1)} nT`}
                  hint={data.solarWind.bzNt < 0 ? 'southward · aurora-favourable' : 'northward'}
                  tone={data.solarWind.bzNt < -5 ? 'text-mission-warn' : 'text-slate-100'}
                />
              </>
            ) : null}
            {data.xray ? (
              <Metric
                label="GOES X-ray flare class"
                value={data.xray.flareClass}
                hint={`long ${(data.xray.longWm2 * 1e6).toFixed(2)} µW/m²`}
                tone={flareTextColor(data.xray.flareClass)}
              />
            ) : null}
            <Metric
              label="aurora likelihood"
              value={`${((data.auroraLikelihood ?? 0) * 100).toFixed(0)}%`}
              hint={`lat ${location.lat.toFixed(1)}°`}
            />
          </div>

          <div className="rounded border border-mission-edge bg-mission-bg/40 p-2 text-[11px] text-slate-300">
            {latitudeNote}
          </div>
        </div>
      )}
    </section>
  );
}
