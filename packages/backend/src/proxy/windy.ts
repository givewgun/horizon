/**
 * Windy webcams API proxy (requires WINDY_KEY) with a curated fallback so
 * the panel still shows useful content when no key is configured.
 *
 * Upstream: https://api.windy.com/webcams/api/v3/webcams (header x-windy-api-key).
 */

import type { Webcam } from '@horizon/shared';
import { TtlCache } from './cache.js';
import { fetchUpstream, UpstreamError } from './http.js';

const WEBCAMS_TTL_MS = 60 * 60 * 1000;

interface WindyResult {
  webcamId?: number | string;
  title?: string;
  location?: { latitude?: number; longitude?: number; city?: string; country?: string };
  images?: { current?: { preview?: string; thumbnail?: string } };
  player?: { live?: string; day?: string };
}

interface WindyEnvelope {
  webcams?: WindyResult[];
}

function normalizeWindy(src: WindyResult): Webcam | null {
  const id = src.webcamId !== undefined ? String(src.webcamId) : null;
  const lat = src.location?.latitude;
  const lon = src.location?.longitude;
  if (!id || typeof lat !== 'number' || typeof lon !== 'number') return null;
  const playerUrl = src.player?.live ?? src.player?.day;
  const thumbnailUrl = src.images?.current?.preview ?? src.images?.current?.thumbnail;
  return {
    id,
    title: src.title ?? 'Webcam',
    ...(playerUrl !== undefined && { playerUrl }),
    ...(thumbnailUrl !== undefined && { thumbnailUrl }),
    location: {
      lat,
      lon,
      ...(src.location?.city !== undefined && { city: src.location.city }),
      ...(src.location?.country !== undefined && { country: src.location.country }),
    },
    provider: 'windy',
  };
}

/** Curated YouTube live streams (24/7 city cams), used when WINDY_KEY is missing. */
const CURATED_WEBCAMS: Webcam[] = [
  {
    id: 'yt-DjdUEyjx8GM',
    title: 'Shibuya Crossing · Tokyo',
    playerUrl: 'https://www.youtube.com/watch?v=DjdUEyjx8GM',
    thumbnailUrl: 'https://img.youtube.com/vi/DjdUEyjx8GM/mqdefault.jpg',
    location: { lat: 35.6595, lon: 139.7005, city: 'Tokyo', country: 'JP' },
    provider: 'youtube-fallback',
  },
  {
    id: 'yt-1-iS7LArMPI',
    title: 'Times Square · New York',
    playerUrl: 'https://www.youtube.com/watch?v=1-iS7LArMPI',
    thumbnailUrl: 'https://img.youtube.com/vi/1-iS7LArMPI/mqdefault.jpg',
    location: { lat: 40.758, lon: -73.9855, city: 'New York', country: 'US' },
    provider: 'youtube-fallback',
  },
  {
    id: 'yt-mRe-514tGMg',
    title: 'Abbey Road · London',
    playerUrl: 'https://www.youtube.com/watch?v=mRe-514tGMg',
    thumbnailUrl: 'https://img.youtube.com/vi/mRe-514tGMg/mqdefault.jpg',
    location: { lat: 51.5321, lon: -0.1779, city: 'London', country: 'GB' },
    provider: 'youtube-fallback',
  },
  {
    id: 'yt-Cp4RRAEgpeU',
    title: 'Bangkok skyline',
    playerUrl: 'https://www.youtube.com/watch?v=Cp4RRAEgpeU',
    thumbnailUrl: 'https://img.youtube.com/vi/Cp4RRAEgpeU/mqdefault.jpg',
    location: { lat: 13.7563, lon: 100.5018, city: 'Bangkok', country: 'TH' },
    provider: 'youtube-fallback',
  },
  {
    id: 'yt-86YLFOog4GM',
    title: 'Las Vegas Strip',
    playerUrl: 'https://www.youtube.com/watch?v=86YLFOog4GM',
    thumbnailUrl: 'https://img.youtube.com/vi/86YLFOog4GM/mqdefault.jpg',
    location: { lat: 36.1147, lon: -115.1728, city: 'Las Vegas', country: 'US' },
    provider: 'youtube-fallback',
  },
  {
    id: 'yt-FQbiC9rJBeQ',
    title: 'Venice · St Mark\'s Square',
    playerUrl: 'https://www.youtube.com/watch?v=FQbiC9rJBeQ',
    thumbnailUrl: 'https://img.youtube.com/vi/FQbiC9rJBeQ/mqdefault.jpg',
    location: { lat: 45.4341, lon: 12.3388, city: 'Venice', country: 'IT' },
    provider: 'youtube-fallback',
  },
];

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
}

export class WindyClient {
  private cache = new TtlCache<Webcam[]>(WEBCAMS_TTL_MS);
  private base = 'https://api.windy.com/webcams/api/v3';

  constructor(private apiKey: string) {}

  async nearby(lat: number, lon: number, radiusKm = 250): Promise<{ data: Webcam[]; ageMs: number }> {
    const key = `nearby:${lat.toFixed(2)}:${lon.toFixed(2)}:${radiusKm}`;
    return this.cache.get(key, async () => {
      const url = new URL(`${this.base}/webcams`);
      url.searchParams.set('nearby', `${lat},${lon},${radiusKm}`);
      url.searchParams.set('limit', '12');
      url.searchParams.set('include', 'images,location,player');
      const json = (await fetchUpstream(url.toString(), {
        headers: { 'x-windy-api-key': this.apiKey },
      })) as WindyEnvelope;
      const out: Webcam[] = [];
      for (const r of json.webcams ?? []) {
        const w = normalizeWindy(r);
        if (w) out.push(w);
      }
      if (out.length === 0) throw new UpstreamError('no webcams returned');
      return out;
    });
  }

  lastGoodNearby(lat: number, lon: number, radiusKm = 250): { data: Webcam[]; ageMs: number } | undefined {
    return this.cache.lastGood(`nearby:${lat.toFixed(2)}:${lon.toFixed(2)}:${radiusKm}`);
  }
}

/** Return the curated list, sorted by distance from (lat, lon). Always works. */
export function curatedWebcams(lat: number, lon: number): Webcam[] {
  return [...CURATED_WEBCAMS].sort(
    (a, b) =>
      haversineKm({ lat, lon }, a.location) - haversineKm({ lat, lon }, b.location),
  );
}
