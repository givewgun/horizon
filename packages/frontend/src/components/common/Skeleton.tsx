interface Props {
  className?: string;
  /** Number of rows to render (default 1). */
  rows?: number;
}

export function Skeleton({ className = '', rows = 1 }: Props): JSX.Element {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 w-full animate-pulse rounded bg-mission-edge/60" />
      ))}
    </div>
  );
}
