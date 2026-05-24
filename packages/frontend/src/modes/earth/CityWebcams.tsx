import { useQuery } from '@tanstack/react-query';
import type { Webcam } from '@horizon/shared';
import { apiGet } from '../../lib/api.js';
import { useLocation } from '../../context/LocationContext.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Skeleton } from '../../components/common/Skeleton.js';
import { FeedFallback } from '../../components/common/FeedFallback.js';

export function CityWebcams(): JSX.Element {
  const { location } = useLocation();

  const { data: webcams, isLoading, error } = useQuery<Webcam[]>({
    queryKey: ['webcams', location.lat, location.lon],
    queryFn: () =>
      apiGet<Webcam[]>(`/webcams?lat=${location.lat}&lon=${location.lon}&radius=500`),
    refetchInterval: 60 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <section className="rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">
            City webcams
          </h2>
          <StatusBadge status="SNAPSHOT" />
        </header>
        <Skeleton rows={3} />
      </section>
    );
  }

  if (error || !webcams) {
    return (
      <section className="rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">
            City webcams
          </h2>
          <StatusBadge status="SNAPSHOT" />
        </header>
        <FeedFallback feedName="webcams" />
      </section>
    );
  }

  const isLiveWindy = webcams.some((c) => c.provider === 'windy');

  return (
    <section className="rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">
          City webcams
        </h2>
        <StatusBadge status={isLiveWindy ? 'LIVE' : 'SNAPSHOT'} />
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {webcams.slice(0, 6).map((cam) => {
          const href = cam.playerUrl ?? `https://www.youtube.com/watch?v=${cam.id.replace(/^yt-/, '')}`;
          return (
            <a
              key={cam.id}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="group overflow-hidden rounded border border-slate-700 bg-slate-900/50 transition-colors hover:border-mission-accent"
            >
              <div className="relative aspect-video bg-black">
                {cam.thumbnailUrl ? (
                  <img
                    src={cam.thumbnailUrl}
                    alt={cam.title}
                    className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-600">
                    no thumbnail
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                  <div className="truncate text-xs font-semibold text-slate-100">{cam.title}</div>
                  <div className="truncate text-[10px] text-slate-400">
                    {cam.location.city ?? ''}
                    {cam.location.country ? ` · ${cam.location.country}` : ''}
                  </div>
                </div>
              </div>
            </a>
          );
        })}
      </div>

      <div className="mt-2 text-[10px] text-slate-500">
        {isLiveWindy
          ? `Source: Windy webcams · ${webcams.length} near you`
          : 'Curated 24/7 YouTube live streams (set WINDY_KEY for nearby webcams).'}
      </div>
    </section>
  );
}
