interface Props {
  feedName: string;
  message?: string;
  lastSuccessAt?: string;
  onRetry?: () => void;
}

export function FeedFallback({
  feedName,
  message = 'temporarily unavailable',
  lastSuccessAt,
  onRetry,
}: Props): JSX.Element {
  return (
    <div
      role="status"
      className="flex flex-col items-start gap-2 rounded-md border border-mission-edge bg-mission-panel/60 p-4 text-sm text-slate-300"
    >
      <div className="font-mono text-xs uppercase tracking-wider text-slate-400">
        {feedName} · {message}
      </div>
      {lastSuccessAt ? (
        <div className="text-xs text-slate-500">
          last good: <span className="font-mono">{lastSuccessAt}</span>
        </div>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-mission-edge px-2 py-1 text-xs hover:bg-mission-edge"
        >
          retry
        </button>
      ) : null}
    </div>
  );
}
