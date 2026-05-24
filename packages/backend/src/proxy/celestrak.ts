/**
 * CelesTrak TLE passthrough. Returns the parsed 3-line element set so the
 * frontend can hand it straight to satellite.js without re-parsing.
 *
 * Cached per-catalog-number for 3h — TLE precision degrades quickly past that,
 * but spamming CelesTrak for ISS on every page load is rude.
 */

import type { TLE } from '@horizon/shared';
import { TtlCache } from './cache.js';
import { fetchUpstream, UpstreamError } from './http.js';

const TTL_MS = 3 * 3600_000;

function parseTle(catnr: number, raw: string): TLE {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length < 3) {
    throw new UpstreamError(`celestrak: invalid TLE payload for ${catnr}`);
  }
  const [name, line1, line2] = lines as [string, string, string];
  if (!line1.startsWith('1 ') || !line2.startsWith('2 ')) {
    throw new UpstreamError(`celestrak: malformed TLE lines for ${catnr}`);
  }
  return { catnr, name: name.trim(), line1, line2, fetchedAt: new Date().toISOString() };
}

export class CelestrakClient {
  private cache = new TtlCache<TLE>(TTL_MS);

  async tle(catnr: number): Promise<{ data: TLE; ageMs: number }> {
    if (!Number.isInteger(catnr) || catnr <= 0 || catnr > 9_999_999) {
      throw new UpstreamError('celestrak: invalid catalog number', 400);
    }
    return this.cache.get(`tle:${catnr}`, async () => {
      const body = (await fetchUpstream(
        `https://celestrak.org/NORAD/elements/gp.php?CATNR=${catnr}&FORMAT=tle`,
        { accept: 'text' },
      )) as string;
      return parseTle(catnr, body);
    });
  }

  lastGood(catnr: number): { data: TLE; ageMs: number } | undefined {
    return this.cache.lastGood(`tle:${catnr}`);
  }
}
