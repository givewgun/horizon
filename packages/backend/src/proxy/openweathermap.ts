/**
 * OpenWeatherMap tile layers proxy (requires OPENWEATHER_KEY).
 * Tiles are cached aggressively (1h) since they change rarely.
 */

import { TtlCache } from './cache.js';
import { UpstreamError } from './http.js';

const TILE_TTL_MS = 60 * 60 * 1000;

export type OWMTileLayer = 'clouds' | 'precipitation' | 'wind' | 'temperature';

const LAYER_MAP: Record<OWMTileLayer, string> = {
  clouds: 'clouds_new',
  precipitation: 'precipitation_new',
  wind: 'wind_new',
  temperature: 'temp_new',
};

export class OpenWeatherMapClient {
  private cache = new TtlCache<Buffer>(TILE_TTL_MS);
  private base = 'https://tile.openweathermap.org';

  constructor(private apiKey: string) {
    if (!apiKey || apiKey.length === 0) {
      throw new UpstreamError('OpenWeatherMap API key required');
    }
  }

  async tile(
    layer: OWMTileLayer,
    z: number,
    x: number,
    y: number,
  ): Promise<{ data: Buffer; ageMs: number }> {
    const key = `tile:${layer}:${z}:${x}:${y}`;
    return this.cache.get(key, async () => {
      const layerCode = LAYER_MAP[layer];
      if (!layerCode) {
        throw new UpstreamError(`unknown layer: ${layer}`);
      }
      const url = `${this.base}/map/${layerCode}/${z}/${x}/${y}.png?appid=${this.apiKey}`;
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 8000);
      try {
        const res = await fetch(url, { method: 'GET', signal: ac.signal });
        if (!res.ok) {
          throw new UpstreamError(
            `owm tile ${res.status}: ${res.statusText}`,
            res.status,
            url,
          );
        }
        return Buffer.from(await res.arrayBuffer());
      } finally {
        clearTimeout(t);
      }
    });
  }

  lastGood(
    layer: OWMTileLayer,
    z: number,
    x: number,
    y: number,
  ): { data: Buffer; ageMs: number } | undefined {
    return this.cache.lastGood(`tile:${layer}:${z}:${x}:${y}`);
  }
}
