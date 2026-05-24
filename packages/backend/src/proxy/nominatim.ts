/**
 * OpenStreetMap Nominatim geocoding proxy (free, no API key).
 * 24h cache, >=1 req/s throttle with descriptive User-Agent.
 */

import type { ResolvedLocation } from '@horizon/shared';
import { TtlCache } from './cache.js';
import { fetchUpstream, UpstreamError } from './http.js';

const GEOCODE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 1100;

interface NominatimAddress {
  country?: string;
  country_code?: string;
  state?: string;
  county?: string;
  city?: string;
  town?: string;
  village?: string;
  [key: string]: string | undefined;
}

interface NominatimResult {
  lat?: string | number;
  lon?: string | number;
  display_name?: string;
  address?: NominatimAddress;
}

function buildLabel(result: NominatimResult): string {
  const { address } = result;
  if (!address) return result.display_name ?? 'Unknown location';

  const parts: string[] = [];
  const city = address.city || address.town || address.village || '';
  const state = address.state || '';
  const country = address.country || '';

  if (city) parts.push(city);
  if (state && state !== city) parts.push(state);
  if (country) parts.push(country);

  return parts.length > 0 ? parts.join(', ') : result.display_name ?? 'Unknown location';
}

function normalizeResult(src: NominatimResult): ResolvedLocation | null {
  const lat = typeof src.lat === 'string' ? Number(src.lat) : src.lat;
  const lon = typeof src.lon === 'string' ? Number(src.lon) : src.lon;

  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const label = buildLabel(src);
  return {
    lat,
    lon,
    label,
    source: 'manual',
  };
}

export class NominatimClient {
  private forwardCache = new TtlCache<ResolvedLocation>(GEOCODE_TTL_MS);
  private reverseCache = new TtlCache<ResolvedLocation>(GEOCODE_TTL_MS);
  private lastRequestTime = 0;
  private base = 'https://nominatim.openstreetmap.org';

  constructor(private userAgent: string) {}

  private async throttledFetch(url: string): Promise<unknown> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
    }
    this.lastRequestTime = Date.now();
    return fetchUpstream(url, { headers: { 'User-Agent': this.userAgent } });
  }

  async forward(
    query: string,
  ): Promise<{ data: ResolvedLocation; ageMs: number }> {
    if (!query || query.trim().length === 0) {
      throw new UpstreamError('empty query');
    }
    const key = `forward:${query.toLowerCase()}`;
    return this.forwardCache.get(key, async () => {
      const url = new URL(`${this.base}/search`);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');

      const json = (await this.throttledFetch(url.toString())) as NominatimResult[];
      if (!Array.isArray(json) || json.length === 0) {
        throw new UpstreamError('no results found');
      }
      const result = normalizeResult(json[0]!);
      if (!result) {
        throw new UpstreamError('invalid coordinates in response');
      }
      return result;
    });
  }

  async reverse(
    lat: number,
    lon: number,
  ): Promise<{ data: ResolvedLocation; ageMs: number }> {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new UpstreamError('invalid coordinates');
    }
    const key = `reverse:${lat}:${lon}`;
    return this.reverseCache.get(key, async () => {
      const url = new URL(`${this.base}/reverse`);
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lon));
      url.searchParams.set('format', 'json');

      const json = (await this.throttledFetch(url.toString())) as NominatimResult;
      const result = normalizeResult(json);
      if (!result) {
        throw new UpstreamError('invalid response from nominatim');
      }
      return result;
    });
  }

  lastGoodForward(query: string): { data: ResolvedLocation; ageMs: number } | undefined {
    return this.forwardCache.lastGood(`forward:${query.toLowerCase()}`);
  }

  lastGoodReverse(lat: number, lon: number): { data: ResolvedLocation; ageMs: number } | undefined {
    return this.reverseCache.lastGood(`reverse:${lat}:${lon}`);
  }
}
