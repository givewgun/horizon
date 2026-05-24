/**
 * The Space Devs (Launch Library 2) proxy + normalizer.
 *
 * Upstream returns a `detailed` shape that's bigger than we want to ship to the
 * browser. `normalizeLaunch` projects it to the shared `Launch` type and is
 * the only thing the frontend ever sees, so any LL2 field rename only touches
 * this file.
 */

import type { Launch, LaunchNetPrecision, Webcast } from '@horizon/shared';
import { TtlCache } from './cache.js';
import { fetchUpstream, UpstreamError } from './http.js';

const UPCOMING_TTL_MS = 60_000;
const DETAIL_TTL_MS = 30_000;

const PRECISION_MAP: Record<string, LaunchNetPrecision> = {
  second: 'Second',
  minute: 'Minute',
  hour: 'Hour',
  day: 'Day',
  week: 'Week',
  month: 'Month',
  year: 'Year',
};

interface LL2Pad {
  name?: string;
  location?: { name?: string; country_code?: string };
  latitude?: number | string | null;
  longitude?: number | string | null;
}
interface LL2VidUrl {
  url?: string;
  type?: { name?: string } | string;
  source?: string;
  priority?: number;
  title?: string;
}
interface LL2Launch {
  id?: string;
  name?: string;
  net?: string;
  net_precision?: { name?: string; abbrev?: string } | string;
  status?: { abbrev?: string; name?: string };
  launch_service_provider?: { name?: string; type?: { name?: string } | string };
  rocket?: { configuration?: { name?: string; full_name?: string } };
  mission?: {
    name?: string;
    description?: string;
    orbit?: { name?: string } | string;
    type?: string;
  };
  pad?: LL2Pad;
  webcast_live?: boolean;
  vidURLs?: LL2VidUrl[];
  weather_concerns?: string | null;
  url?: string;
}
interface LL2UpcomingEnvelope {
  results?: LL2Launch[];
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function pickPrecision(raw: LL2Launch['net_precision']): LaunchNetPrecision {
  const name =
    typeof raw === 'string' ? raw : typeof raw?.name === 'string' ? raw.name : '';
  return PRECISION_MAP[name.toLowerCase()] ?? 'Hour';
}

function pickWebcasts(raw: LL2VidUrl[] | undefined): Webcast[] {
  if (!Array.isArray(raw)) return [];
  const out: Webcast[] = [];
  for (const v of raw) {
    if (!v || typeof v.url !== 'string' || v.url.length === 0) continue;
    const type =
      typeof v.type === 'string'
        ? v.type
        : typeof v.type?.name === 'string'
          ? v.type.name
          : (v.source ?? 'webcast');
    out.push({
      url: v.url,
      type,
      title: typeof v.title === 'string' ? v.title : undefined,
      priority: typeof v.priority === 'number' ? v.priority : undefined,
    });
  }
  // Lower priority number = higher importance in LL2.
  out.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  return out;
}

export function normalizeLaunch(src: LL2Launch): Launch {
  const provider = src.launch_service_provider?.name ?? 'Unknown';
  const providerType =
    typeof src.launch_service_provider?.type === 'string'
      ? src.launch_service_provider.type
      : src.launch_service_provider?.type?.name;
  const rocketName =
    src.rocket?.configuration?.full_name ?? src.rocket?.configuration?.name ?? 'Unknown rocket';
  const orbit =
    typeof src.mission?.orbit === 'string'
      ? src.mission.orbit
      : src.mission?.orbit?.name;
  return {
    id: src.id ?? 'unknown',
    name: src.name ?? 'Unnamed launch',
    net: src.net ?? new Date().toISOString(),
    netPrecision: pickPrecision(src.net_precision),
    status: {
      abbrev: src.status?.abbrev ?? 'TBD',
      name: src.status?.name ?? 'To Be Determined',
    },
    provider: { name: provider, type: providerType },
    rocket: { name: rocketName },
    mission: src.mission
      ? {
          name: src.mission.name,
          description: src.mission.description,
          orbit,
          type: src.mission.type,
        }
      : undefined,
    pad: {
      name: src.pad?.name ?? 'Unknown pad',
      locationName: src.pad?.location?.name,
      countryCode: src.pad?.location?.country_code,
      latitude: asNumber(src.pad?.latitude),
      longitude: asNumber(src.pad?.longitude),
    },
    webcastLive: src.webcast_live === true,
    webcasts: pickWebcasts(src.vidURLs),
    weatherConcerns:
      typeof src.weather_concerns === 'string' && src.weather_concerns.length > 0
        ? src.weather_concerns
        : undefined,
    url: src.url,
  };
}

export class LL2Client {
  private upcomingCache = new TtlCache<Launch[]>(UPCOMING_TTL_MS);
  private detailCache = new TtlCache<Launch>(DETAIL_TTL_MS);

  constructor(private readonly base: string) {}

  async upcoming(limit = 20): Promise<{ data: Launch[]; ageMs: number }> {
    const key = `upcoming:${limit}`;
    return this.upcomingCache.get(key, async () => {
      const json = (await fetchUpstream(
        `${this.base}/launches/upcoming/?limit=${limit}&mode=detailed`,
      )) as LL2UpcomingEnvelope;
      const results = Array.isArray(json.results) ? json.results : [];
      return results.map(normalizeLaunch);
    });
  }

  async detail(id: string): Promise<{ data: Launch; ageMs: number }> {
    if (!/^[A-Za-z0-9-]{4,}$/.test(id)) {
      throw new UpstreamError(`invalid launch id`, 400);
    }
    const key = `detail:${id}`;
    return this.detailCache.get(key, async () => {
      const json = (await fetchUpstream(
        `${this.base}/launches/${id}/?mode=detailed`,
      )) as LL2Launch;
      return normalizeLaunch(json);
    });
  }

  lastGoodUpcoming(limit = 20): { data: Launch[]; ageMs: number } | undefined {
    return this.upcomingCache.lastGood(`upcoming:${limit}`);
  }

  lastGoodDetail(id: string): { data: Launch; ageMs: number } | undefined {
    return this.detailCache.lastGood(`detail:${id}`);
  }
}
