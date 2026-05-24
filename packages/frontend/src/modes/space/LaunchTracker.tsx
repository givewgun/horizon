/**
 * Launch tracker panel. Polls `/api/launches/upcoming` and renders a vertical
 * list with provider filter chips, live countdowns, and a detail drawer.
 *
 * The drawer is the only place that conditionally embeds the webcast iframe:
 * only when `webcastLive === true` AND we have a usable URL. Otherwise it
 * shows the countdown and a link to the launch page. This mirrors the bot's
 * `selectLink` policy — we never push the user to an empty stream.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Launch } from '@horizon/shared';
import { apiGet } from '../../lib/api.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Skeleton } from '../../components/common/Skeleton.js';
import { FeedFallback } from '../../components/common/FeedFallback.js';
import {
  countdown,
  formatCountdown,
  formatUtcAndBangkok,
} from '../../lib/time.js';

const PROVIDER_FILTERS = [
  'All',
  'SpaceX',
  'NASA',
  'Rocket Lab',
  'AST SpaceMobile',
  'ESA',
  'JAXA',
  'ISRO',
  'Roscosmos',
] as const;
type ProviderFilter = (typeof PROVIDER_FILTERS)[number];

function matchesProvider(filter: ProviderFilter, providerName: string): boolean {
  if (filter === 'All') return true;
  return providerName.toLowerCase().includes(filter.toLowerCase());
}

function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function LaunchRow({
  launch,
  now,
  onOpen,
}: {
  launch: Launch;
  now: Date;
  onOpen: () => void;
}): JSX.Element {
  const c = countdown(launch.net, now);
  const t = formatUtcAndBangkok(launch.net);
  const goish = launch.status.abbrev === 'Go';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded border border-mission-edge bg-mission-bg/40 p-3 text-left hover:border-mission-accent/60"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-mono text-sm text-slate-100">{launch.name}</div>
          <div className="truncate text-xs text-slate-400">
            {launch.provider.name} · {launch.rocket.name}
          </div>
        </div>
        <div className="text-right font-mono">
          <div
            className={`text-xs ${goish ? 'text-mission-live' : 'text-mission-warn'}`}
            aria-label={`status ${launch.status.name}`}
          >
            {launch.status.abbrev}
          </div>
          <div className="text-xs text-slate-200">{formatCountdown(c)}</div>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-500">
        <span className="truncate">{launch.pad.locationName ?? launch.pad.name}</span>
        <span>{t.utc}</span>
      </div>
      {launch.weatherConcerns ? (
        <div className="mt-1 text-[10px] text-mission-warn">
          weather: {launch.weatherConcerns}
        </div>
      ) : null}
    </button>
  );
}

function LaunchDrawer({
  launch,
  onClose,
}: {
  launch: Launch;
  onClose: () => void;
}): JSX.Element {
  const now = useNow(1000);
  const c = countdown(launch.net, now);
  const t = formatUtcAndBangkok(launch.net);
  const webcast = launch.webcasts[0];
  const showEmbed = launch.webcastLive && webcast && /youtu\.?be/.test(webcast.url);
  const embedUrl = showEmbed ? toEmbed(webcast.url) : null;
  const pageUrl = launch.url ?? webcast?.url;
  return (
    <div
      role="dialog"
      aria-label={`Launch detail: ${launch.name}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col gap-3 overflow-auto border-l border-mission-edge bg-mission-panel p-4 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-sm text-slate-100">{launch.name}</div>
          <div className="text-xs text-slate-400">
            {launch.provider.name} · {launch.rocket.name}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="close detail"
          className="rounded border border-mission-edge px-2 py-1 text-xs hover:bg-mission-edge"
        >
          close
        </button>
      </div>

      <div className="font-mono text-xs text-slate-300">
        <div>{t.utc}</div>
        <div className="text-slate-400">{t.bangkok}</div>
        <div className="mt-1 text-mission-accent">{formatCountdown(c)}</div>
      </div>

      <div className="rounded border border-mission-edge bg-mission-bg/40 p-2 text-xs text-slate-300">
        <div className="text-slate-400">Pad</div>
        <div>
          {launch.pad.name}
          {launch.pad.locationName ? ` · ${launch.pad.locationName}` : ''}
          {launch.pad.countryCode ? ` (${launch.pad.countryCode})` : ''}
        </div>
        {typeof launch.pad.latitude === 'number' &&
        typeof launch.pad.longitude === 'number' ? (
          <div className="font-mono text-[10px] text-slate-500">
            {launch.pad.latitude.toFixed(3)}, {launch.pad.longitude.toFixed(3)}
          </div>
        ) : null}
      </div>

      {launch.mission?.description ? (
        <div className="rounded border border-mission-edge bg-mission-bg/40 p-2 text-xs text-slate-300">
          <div className="text-slate-400">Mission</div>
          <div className="mt-1">{launch.mission.description}</div>
          {launch.mission.orbit ? (
            <div className="mt-1 font-mono text-[10px] text-slate-500">
              orbit: {launch.mission.orbit}
            </div>
          ) : null}
        </div>
      ) : null}

      {showEmbed && embedUrl ? (
        <div className="aspect-video w-full overflow-hidden rounded border border-mission-edge">
          <iframe
            title={`${launch.name} webcast`}
            src={embedUrl}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      ) : (
        <div className="rounded border border-mission-edge bg-mission-bg/40 p-3 text-xs text-slate-300">
          {launch.webcasts.length > 0
            ? 'Stream link available but not yet live. Typically starts ~15 minutes before T-0.'
            : 'No stream link published yet. Typically appears ~15 minutes before T-0.'}
          {pageUrl ? (
            <div className="mt-2">
              <a
                href={pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-mission-accent underline"
              >
                Open launch page
              </a>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function toEmbed(url: string): string {
  // YouTube live/watch → embed; everything else returned as-is (callers gate on
  // `youtu` so we only ever land here for YouTube URLs).
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/))([\w-]+)/);
  if (!m) return url;
  return `https://www.youtube.com/embed/${m[1]}?autoplay=1`;
}

export function LaunchTracker(): JSX.Element {
  const [filter, setFilter] = useState<ProviderFilter>('All');
  const [openId, setOpenId] = useState<string | null>(null);
  const now = useNow(1000);

  const { data, isLoading, isError, refetch } = useQuery<Launch[]>({
    queryKey: ['launches', 'upcoming'],
    queryFn: () => apiGet<Launch[]>('/launches/upcoming'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const filtered = useMemo(
    () => (data ?? []).filter((l) => matchesProvider(filter, l.provider.name)),
    [data, filter],
  );
  const open = useMemo(
    () => (openId ? (data ?? []).find((l) => l.id === openId) ?? null : null),
    [data, openId],
  );

  return (
    <section className="flex h-full flex-col rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">
          Launch tracker
        </h2>
        <StatusBadge status="REALTIME" />
      </header>

      <div className="mb-3 flex flex-wrap gap-1">
        {PROVIDER_FILTERS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setFilter(p)}
            aria-pressed={filter === p}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
              filter === p
                ? 'border-mission-accent bg-mission-accent/15 text-mission-accent'
                : 'border-mission-edge text-slate-400 hover:bg-mission-edge/40'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton rows={5} />
      ) : isError ? (
        <FeedFallback
          feedName="launches"
          message="upstream unavailable"
          onRetry={() => void refetch()}
        />
      ) : filtered.length === 0 ? (
        <div className="text-xs text-slate-500">No upcoming launches match this filter.</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((l) => (
            <li key={l.id}>
              <LaunchRow launch={l} now={now} onOpen={() => setOpenId(l.id)} />
            </li>
          ))}
        </ul>
      )}

      {open ? <LaunchDrawer launch={open} onClose={() => setOpenId(null)} /> : null}
    </section>
  );
}
