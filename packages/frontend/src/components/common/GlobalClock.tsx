import { useEffect, useState } from 'react';
import { formatUtcAndBangkok } from '../../lib/time.js';

export function GlobalClock(): JSX.Element {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const t = formatUtcAndBangkok(now);
  return (
    <div className="flex flex-col items-end font-mono text-[11px] leading-tight">
      <span aria-label="current UTC time">{t.utc}</span>
      <span className="text-slate-400" aria-label="current Bangkok time">
        {t.bangkok}
      </span>
    </div>
  );
}
