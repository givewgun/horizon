import type { FeedStatus } from '@horizon/shared';

interface Props {
  status: FeedStatus;
  /** Optional age-in-ms badge appended (e.g. when last-good cache is being served). */
  ageMs?: number;
  className?: string;
}

const LABELS: Record<FeedStatus, string> = {
  LIVE: 'LIVE',
  REALTIME: '~REALTIME',
  SNAPSHOT: 'SNAPSHOT',
};

const COLOR: Record<FeedStatus, string> = {
  LIVE: 'bg-mission-live/15 text-mission-live border-mission-live/50',
  REALTIME: 'bg-mission-realtime/15 text-mission-realtime border-mission-realtime/50',
  SNAPSHOT: 'bg-mission-snapshot/15 text-mission-snapshot border-mission-snapshot/50',
};

export function StatusBadge({ status, ageMs, className = '' }: Props): JSX.Element {
  const stale = typeof ageMs === 'number' && ageMs > 5 * 60_000;
  return (
    <span
      aria-label={`feed status ${LABELS[status]}`}
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${COLOR[status]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[status]}
      {stale ? <span className="opacity-70">· stale</span> : null}
    </span>
  );
}
