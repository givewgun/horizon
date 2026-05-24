/**
 * Multi-source live-stream panel.
 *
 * For each channel we ask the backend (`/api/live/youtube/:channelId`) for
 * the *current* live broadcast's videoId. The backend scrapes the channel's
 * `/live` page and parses the canonical / og:url / inline-JSON, which is far
 * more reliable than YouTube's `live_stream?channel=...` embed selector —
 * that selector returns "video unavailable" any time the live video has
 * embedding disabled, even when the channel is visibly live.
 *
 * Once we have a videoId we embed `youtube.com/embed/<id>?autoplay=1`. If the
 * channel isn't live (videoId === null), we show a "not live right now" card
 * with a manual link to the channel.
 *
 * Lookups are cached server-side for 60s. Frontend refetches every 60s so
 * tabs catch a channel going live without manual reload.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Skeleton } from '../../components/common/Skeleton.js';

interface LiveSource {
  id: string;
  label: string;
  blurb: string;
  channelId: string;
}

interface LiveLookup {
  videoId: string | null;
  isLive: boolean;
}

const REGISTRY: LiveSource[] = [
  {
    id: 'nasa',
    label: 'NASA',
    blurb: 'NASA YouTube channel. Briefings, launches, downlink, NASA TV simulcast.',
    channelId: 'UCLA_DiR1FfKNvjuUpBHmylQ',
  },
  {
    id: 'space24',
    label: 'Earth from ISS · 24/7',
    blurb: 'Continuous Earth-from-orbit re-broadcast. Always live.',
    channelId: 'UCakgsBvxbB2Q-czllhKQGUw',
  },
  {
    id: 'nsf',
    label: 'NSF',
    blurb: 'NASASpaceflight (NSF). Pad cameras, launch coverage, range commentary.',
    channelId: 'UCSUu1lih2RifWkKtDOJdsBA',
  },
  {
    id: 'spacex',
    label: 'SpaceX',
    blurb: 'SpaceX official. Live during Falcon / Starship campaigns.',
    channelId: 'UCtI0Hodo5o5dUb67FeUjDeA',
  },
  {
    id: 'esa',
    label: 'ESA',
    blurb: 'European Space Agency. Ariane / Vega launches, ESA Web TV simulcast.',
    channelId: 'UCIBaDdAbGlFDeS33shmlD0A',
  },
  {
    id: 'everyday',
    label: 'Everyday Astronaut',
    blurb: 'Tim Dodd. Launch streams with engineering commentary.',
    channelId: 'UC6uKrU_WqJ1R2HMTY3LIx5Q',
  },
  {
    id: 'spaceflight',
    label: 'Spaceflight Now',
    blurb: 'Independent launch coverage and pad cameras.',
    channelId: 'UCxv3Tzbck5sx7BLfMc7s0wA',
  },
];

function channelUrl(cid: string): string {
  return `https://www.youtube.com/channel/${cid}/live`;
}

function ActiveStream({ source }: { source: LiveSource }): JSX.Element {
  const { data, isLoading, isError, refetch } = useQuery<LiveLookup>({
    queryKey: ['ytlive', source.channelId],
    queryFn: () => apiGet<LiveLookup>(`/live/youtube/${source.channelId}`),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="aspect-video w-full rounded border border-mission-edge bg-mission-bg/40 p-3">
        <Skeleton rows={4} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="aspect-video w-full rounded border border-mission-edge bg-mission-bg/40 p-4 text-xs text-slate-300">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
          {source.label} · lookup failed
        </div>
        <p className="mt-2">
          Couldn&apos;t reach the live-detect endpoint. Try again, or open the channel directly.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded border border-mission-edge px-2 py-1 text-xs hover:bg-mission-edge"
          >
            retry
          </button>
          <a
            href={channelUrl(source.channelId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-mission-accent underline"
          >
            open on YouTube ↗
          </a>
        </div>
      </div>
    );
  }

  if (!data.videoId) {
    return (
      <div className="aspect-video w-full rounded border border-mission-edge bg-mission-bg/40 p-4 text-xs text-slate-300">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
          {source.label} · not live right now
        </div>
        <p className="mt-2">
          This channel doesn&apos;t have a current live broadcast. Try another tab — the
          Earth-from-ISS tab is always live.
        </p>
        <div className="mt-3">
          <a
            href={channelUrl(source.channelId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-mission-accent underline"
          >
            open channel on YouTube ↗
          </a>
        </div>
      </div>
    );
  }

  const embed = `https://www.youtube.com/embed/${data.videoId}?autoplay=1`;
  const watch = `https://www.youtube.com/watch?v=${data.videoId}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-video w-full overflow-hidden rounded border border-mission-edge">
        <iframe
          key={data.videoId}
          title={`${source.label} live`}
          src={embed}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="origin"
          className="h-full w-full"
        />
      </div>
      <div className="flex items-start justify-between gap-2 text-[10px] text-slate-400">
        <span>{source.blurb}</span>
        <a
          href={watch}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-mission-accent underline"
        >
          watch on YouTube ↗
        </a>
      </div>
      <div className="font-mono text-[10px] text-slate-500">
        videoId · {data.videoId}
      </div>
    </div>
  );
}

export function LiveStreams(): JSX.Element {
  const [activeId, setActiveId] = useState<string>(REGISTRY[0]!.id);
  const active = (REGISTRY.find((r) => r.id === activeId) ?? REGISTRY[0])!;

  return (
    <section className="rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">
          Live · multi-source
        </h2>
        <StatusBadge status="LIVE" />
      </header>

      <div className="mb-2 flex flex-wrap gap-1">
        {REGISTRY.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setActiveId(r.id)}
            aria-pressed={r.id === activeId}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
              r.id === activeId
                ? 'border-mission-accent bg-mission-accent/15 text-mission-accent'
                : 'border-mission-edge text-slate-400 hover:bg-mission-edge/40'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <ActiveStream source={active} />
    </section>
  );
}
