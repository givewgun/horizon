/**
 * Satellite imagery proxy.
 *
 * Hides upstream CDN details (NESDIS for GOES, JMA for Himawari) and returns
 * the most recent full-disk image as a single binary response. The backend
 * caches the bytes for 5 min so we don't hammer NOAA/JMA when many tabs are
 * open. CORS handling lives here — the SPA does a same-origin GET.
 */

import { TtlCache } from './cache.js';
import { UpstreamError } from './http.js';

const IMAGE_TTL_MS = 5 * 60 * 1000;

export type ImagerySector = 'goes-east' | 'goes-west' | 'himawari';
export type ImageryProduct = 'geocolor' | 'ir' | 'wv';

interface UpstreamSpec {
  url: string;
  contentType: string;
}

// URLs verified working 2026-05-24. NESDIS full-disk 1808px images for GOES;
// BoM Australia for Himawari (only GeoColor — IR/WV mirrors are unstable, so
// they fall back to GeoColor with the same downstream cache key).
const URL_MAP: Record<ImagerySector, Record<ImageryProduct, UpstreamSpec>> = {
  'goes-east': {
    geocolor: {
      url: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/FD/GEOCOLOR/1808x1808.jpg',
      contentType: 'image/jpeg',
    },
    ir: {
      url: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/FD/13/1808x1808.jpg',
      contentType: 'image/jpeg',
    },
    wv: {
      url: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/FD/09/1808x1808.jpg',
      contentType: 'image/jpeg',
    },
  },
  'goes-west': {
    geocolor: {
      url: 'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/FD/GEOCOLOR/1808x1808.jpg',
      contentType: 'image/jpeg',
    },
    ir: {
      url: 'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/FD/13/1808x1808.jpg',
      contentType: 'image/jpeg',
    },
    wv: {
      url: 'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/FD/09/1808x1808.jpg',
      contentType: 'image/jpeg',
    },
  },
  himawari: {
    geocolor: {
      url: 'https://www.bom.gov.au/gms/IDE00135.jpg',
      contentType: 'image/jpeg',
    },
    ir: {
      url: 'https://www.bom.gov.au/gms/IDE00135.jpg',
      contentType: 'image/jpeg',
    },
    wv: {
      url: 'https://www.bom.gov.au/gms/IDE00135.jpg',
      contentType: 'image/jpeg',
    },
  },
};

export interface ImageryResult {
  bytes: Buffer;
  contentType: string;
}

export class ImageryClient {
  private cache = new TtlCache<ImageryResult>(IMAGE_TTL_MS);

  async latest(
    sector: ImagerySector,
    product: ImageryProduct,
  ): Promise<{ data: ImageryResult; ageMs: number }> {
    const spec = URL_MAP[sector]?.[product];
    if (!spec) {
      throw new UpstreamError(`unknown sector/product: ${sector}/${product}`);
    }
    const key = `${sector}:${product}`;
    return this.cache.get(key, async () => {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 12000);
      try {
        const res = await fetch(spec.url, { method: 'GET', signal: ac.signal });
        if (!res.ok) {
          throw new UpstreamError(
            `imagery upstream ${res.status} ${res.statusText}`,
            res.status,
            spec.url,
          );
        }
        const buf = Buffer.from(await res.arrayBuffer());
        return { bytes: buf, contentType: spec.contentType };
      } finally {
        clearTimeout(t);
      }
    });
  }

  lastGood(
    sector: ImagerySector,
    product: ImageryProduct,
  ): { data: ImageryResult; ageMs: number } | undefined {
    return this.cache.lastGood(`${sector}:${product}`);
  }
}
