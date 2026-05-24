/**
 * NOAA SWPC: planetary K-index, solar-wind plasma + IMF, GOES X-ray flux.
 *
 * Each subscription degrades independently — if solar-wind 404s but K-index
 * works, we still ship a useful payload. The route only fails the whole
 * SpaceWeather call when even the K-index has no fresh AND no cached value.
 *
 * Aurora likelihood is a coarse rule keyed on |latitude|, Kp, and Bz (a
 * southward Bz lowers the threshold). It is intentionally conservative — we
 * don't have a per-location ovation forecast and we'd rather understate than
 * promise.
 */

import type {
  KpReading,
  SolarWindSnapshot,
  SpaceWeather,
  XrayFluxSnapshot,
} from '@horizon/shared';
import { TtlCache } from './cache.js';
import { fetchUpstream } from './http.js';

const TTL_MS = 5 * 60_000;

// Primary K-index products. Format: array-of-arrays, row 0 = header.
// We probe both because SWPC has been known to flip the canonical URL.
const KP_URLS = [
  'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
  'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json',
];
const KP_FORECAST_URL =
  'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';
const PLASMA_URL = 'https://services.swpc.noaa.gov/products/solar-wind/plasma-2-hour.json';
const MAG_URL = 'https://services.swpc.noaa.gov/products/solar-wind/mag-2-hour.json';
const XRAY_URL = 'https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json';

type Row = (string | number | null)[];

function parseTime(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : raw.replace(' ', 'T') + 'Z';
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

function pickNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function findColumn(header: Row, candidates: string[]): number {
  for (let i = 0; i < header.length; i += 1) {
    const name = String(header[i] ?? '').toLowerCase();
    if (candidates.some((c) => name.includes(c))) return i;
  }
  return -1;
}

function parseKpProduct(body: unknown, kind: KpReading['kind']): KpReading[] {
  if (!Array.isArray(body) || body.length < 2) return [];
  const header = body[0] as Row;
  const rows = body.slice(1) as Row[];
  const tIdx = findColumn(header, ['time']);
  const kIdx = findColumn(header, ['kp']);
  if (tIdx < 0 || kIdx < 0) return [];
  const out: KpReading[] = [];
  for (const row of rows) {
    const time = parseTime(row[tIdx]);
    const kp = pickNumber(row[kIdx]);
    if (!time || kp === null) continue;
    out.push({ time, kp, kind });
  }
  return out;
}

function parseKpJsonObject(body: unknown, kind: KpReading['kind']): KpReading[] {
  if (!Array.isArray(body)) return [];
  const out: KpReading[] = [];
  for (const row of body as Array<Record<string, unknown>>) {
    const time = parseTime(row.time_tag);
    const kp = pickNumber(row.kp_index ?? row.kp);
    if (!time || kp === null) continue;
    out.push({ time, kp, kind });
  }
  return out;
}

async function fetchKpObserved(): Promise<KpReading[]> {
  for (const url of KP_URLS) {
    try {
      const body = await fetchUpstream(url);
      const asArray = parseKpProduct(body, 'estimated');
      if (asArray.length > 0) return asArray;
      const asObjects = parseKpJsonObject(body, 'estimated');
      if (asObjects.length > 0) return asObjects;
    } catch {
      // try next
    }
  }
  return [];
}

async function fetchPlasma(): Promise<SolarWindSnapshot | null> {
  try {
    const body = (await fetchUpstream(PLASMA_URL)) as Row[];
    if (!Array.isArray(body) || body.length < 2) return null;
    const header = body[0];
    const tIdx = findColumn(header, ['time']);
    const speedIdx = findColumn(header, ['speed']);
    const densIdx = findColumn(header, ['density']);
    const last = body.at(-1);
    if (!last) return null;
    const time = parseTime(last[tIdx]);
    const speed = pickNumber(last[speedIdx]);
    const density = pickNumber(last[densIdx]);
    if (!time || speed === null || density === null) return null;
    return { time, speedKms: speed, densityPcc: density, bzNt: 0 };
  } catch {
    return null;
  }
}

async function fetchBz(): Promise<number | null> {
  try {
    const body = (await fetchUpstream(MAG_URL)) as Row[];
    if (!Array.isArray(body) || body.length < 2) return null;
    const header = body[0];
    const bzIdx = findColumn(header, ['bz_gsm', 'bz']);
    if (bzIdx < 0) return null;
    const last = body.at(-1);
    if (!last) return null;
    return pickNumber(last[bzIdx]);
  } catch {
    return null;
  }
}

function classify(longWm2: number): string {
  if (!Number.isFinite(longWm2) || longWm2 <= 0) return 'A';
  const tiers: Array<[string, number]> = [
    ['X', 1e-4],
    ['M', 1e-5],
    ['C', 1e-6],
    ['B', 1e-7],
    ['A', 1e-8],
  ];
  for (const [letter, threshold] of tiers) {
    if (longWm2 >= threshold) {
      const scaled = longWm2 / threshold;
      return `${letter}${scaled.toFixed(scaled >= 10 ? 0 : 1)}`;
    }
  }
  return 'A';
}

async function fetchXray(): Promise<XrayFluxSnapshot | null> {
  try {
    const body = (await fetchUpstream(XRAY_URL)) as Array<Record<string, unknown>>;
    if (!Array.isArray(body) || body.length === 0) return null;
    // Newest entries are at the end; energy band tagged in `energy` like "0.05-0.4nm" / "0.1-0.8nm".
    let shortWm2 = NaN;
    let longWm2 = NaN;
    let time = '';
    for (let i = body.length - 1; i >= 0 && (Number.isNaN(shortWm2) || Number.isNaN(longWm2)); i -= 1) {
      const row = body[i];
      const energy = String(row.energy ?? '').toLowerCase();
      const flux = pickNumber(row.flux);
      if (flux === null) continue;
      const t = parseTime(row.time_tag);
      if (t && !time) time = t;
      if (Number.isNaN(shortWm2) && energy.includes('0.05')) shortWm2 = flux;
      if (Number.isNaN(longWm2) && energy.includes('0.1-0.8')) longWm2 = flux;
    }
    if (!time || Number.isNaN(longWm2)) return null;
    return {
      time,
      shortWm2: Number.isNaN(shortWm2) ? 0 : shortWm2,
      longWm2,
      flareClass: classify(longWm2),
    };
  } catch {
    return null;
  }
}

function auroraLikelihood(kp: number, latAbs: number, bz: number | null | undefined): number {
  // Boundary moves equatorward with rising Kp; southward Bz pulls it ~3° more.
  const bzBonus = bz !== null && bz !== undefined && bz < 0 ? 3 : 0;
  const boundary = Math.max(40, 67 - kp * 2 - bzBonus);
  if (latAbs >= boundary + 5) return 0.9;
  if (latAbs >= boundary) return 0.6;
  if (latAbs >= boundary - 5) return 0.3;
  return 0;
}

export class SwpcClient {
  private cache = new TtlCache<SpaceWeather>(TTL_MS);

  async get(latitude = 13.7563): Promise<{ data: SpaceWeather; ageMs: number }> {
    const key = `sw:${Math.round(latitude)}`;
    return this.cache.get(key, async () => {
      const [observed, fcstJson, plasma, bz, xray] = await Promise.all([
        fetchKpObserved(),
        fetchUpstream(KP_FORECAST_URL).catch(() => [] as unknown),
        fetchPlasma(),
        fetchBz(),
        fetchXray(),
      ]);
      const forecast = parseKpProduct(fcstJson, 'predicted');
      const current = observed.at(-1) ?? forecast[0];
      if (!current) throw new Error('swpc: no Kp readings available');
      const future = forecast.filter((r) => new Date(r.time).getTime() > Date.now());
      const wind: SolarWindSnapshot | undefined =
        plasma !== null
          ? { ...plasma, bzNt: bz ?? plasma.bzNt }
          : bz !== null
            ? {
                time: new Date().toISOString(),
                speedKms: 0,
                densityPcc: 0,
                bzNt: bz,
              }
            : undefined;
      return {
        current,
        forecast: future.slice(0, 24),
        auroraLikelihood: auroraLikelihood(current.kp, Math.abs(latitude), wind?.bzNt ?? null),
        solarWind: wind,
        xray: xray ?? undefined,
        fetchedAt: new Date().toISOString(),
      };
    });
  }

  lastGood(latitude = 13.7563): { data: SpaceWeather; ageMs: number } | undefined {
    return this.cache.lastGood(`sw:${Math.round(latitude)}`);
  }
}
