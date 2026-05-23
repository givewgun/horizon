/**
 * Time formatting helpers. All "local" times in the app are Asia/Bangkok by
 * design — the user is in Bangkok and launches are global, so UTC + ICT side
 * by side prevents ambiguity.
 */

const BANGKOK_TZ = 'Asia/Bangkok';

interface FormattedTime {
  utc: string;
  bangkok: string;
  iso: string;
}

const dtf = (timeZone: string, opts: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...opts,
  });

export function formatUtcAndBangkok(input: Date | string | number): FormattedTime {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) {
    return { utc: '—', bangkok: '—', iso: '' };
  }
  return {
    utc: `${dtf('UTC').format(d)} UTC`,
    bangkok: `${dtf(BANGKOK_TZ).format(d)} ICT`,
    iso: d.toISOString(),
  };
}

export interface Countdown {
  /** Total milliseconds until target (negative if past). */
  ms: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean;
}

export function countdown(target: Date | string | number, now: Date = new Date()): Countdown {
  const t = target instanceof Date ? target : new Date(target);
  const ms = t.getTime() - now.getTime();
  const abs = Math.abs(ms);
  const seconds = Math.floor(abs / 1000) % 60;
  const minutes = Math.floor(abs / 60_000) % 60;
  const hours = Math.floor(abs / 3_600_000) % 24;
  const days = Math.floor(abs / 86_400_000);
  return { ms, days, hours, minutes, seconds, past: ms < 0 };
}

export function formatCountdown(c: Countdown): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  const prefix = c.past ? 'T+' : 'T-';
  if (c.days > 0) return `${prefix}${c.days}d ${pad(c.hours)}h ${pad(c.minutes)}m`;
  return `${prefix}${pad(c.hours)}:${pad(c.minutes)}:${pad(c.seconds)}`;
}
