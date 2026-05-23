/**
 * Phase 0 stubs. Every /api/* route returns shape-correct mock data so the
 * frontend can be developed end-to-end. Phase 1 and Phase 2 replace these
 * handlers one-by-one with real upstream proxies in `src/proxy/*`.
 */

import type { FastifyInstance } from 'fastify';
import type {
  ApiOk,
  Forecast,
  Launch,
  ResolvedLocation,
  SpaceWeather,
  TLE,
  Webcam,
} from '@horizon/shared';

const ok = <T,>(data: T, status: ApiOk<T>['status'] = 'SNAPSHOT'): ApiOk<T> => ({
  ok: true,
  data,
  status,
});

const BANGKOK = { lat: 13.7563, lon: 100.5018 };

const stubLaunch: Launch = {
  id: 'stub-falcon9',
  name: 'Falcon 9 | Starlink Group 0-0 (stub)',
  net: new Date(Date.now() + 6 * 3600_000).toISOString(),
  netPrecision: 'Hour',
  status: { abbrev: 'TBD', name: 'To Be Determined' },
  provider: { name: 'SpaceX', type: 'Commercial' },
  rocket: { name: 'Falcon 9 Block 5' },
  mission: {
    name: 'Starlink Group 0-0',
    description: 'Stub mission used during Phase 0 scaffolding.',
    orbit: 'LEO',
    type: 'Communications',
  },
  pad: {
    name: 'SLC-40',
    locationName: 'Cape Canaveral SFS',
    latitude: 28.5618,
    longitude: -80.5772,
    countryCode: 'USA',
  },
  webcastLive: false,
  webcasts: [],
  url: 'https://thespacedevs.com/',
};

export function registerStubRoutes(app: FastifyInstance): void {
  app.get('/api/launches/upcoming', async () => ok([stubLaunch], 'SNAPSHOT'));

  app.get<{ Params: { id: string } }>('/api/launches/:id', async (req) => {
    return ok({ ...stubLaunch, id: req.params.id }, 'SNAPSHOT');
  });

  app.get<{ Params: { catnr: string } }>('/api/tle/:catnr', async (req) => {
    const catnr = Number.parseInt(req.params.catnr, 10);
    const tle: TLE = {
      catnr: Number.isFinite(catnr) ? catnr : 25544,
      name: 'ISS (ZARYA)',
      line1:
        '1 25544U 98067A   24001.50000000  .00010000  00000-0  18000-3 0  9990',
      line2:
        '2 25544  51.6400 100.0000 0001000  90.0000 270.0000 15.50000000000000',
      fetchedAt: new Date().toISOString(),
    };
    return ok(tle, 'SNAPSHOT');
  });

  app.get('/api/spaceweather', async () => {
    const now = new Date().toISOString();
    const sw: SpaceWeather = {
      current: { time: now, kp: 2.0, kind: 'estimated' },
      forecast: [],
      auroraLikelihood: 0,
      fetchedAt: now,
    };
    return ok(sw, 'SNAPSHOT');
  });

  app.get<{ Querystring: { lat?: string; lon?: string } }>(
    '/api/forecast',
    async (req) => {
      const lat = Number(req.query.lat ?? BANGKOK.lat);
      const lon = Number(req.query.lon ?? BANGKOK.lon);
      const now = new Date().toISOString();
      const forecast: Forecast = {
        location: { lat, lon },
        current: { temperatureC: 30, windKph: 8, weatherCode: 1, at: now },
        hourly: [],
        daily: [],
        fetchedAt: now,
      };
      return ok(forecast, 'SNAPSHOT');
    },
  );

  app.get<{ Querystring: { lat?: string; lon?: string; radius?: string } }>(
    '/api/webcams',
    async (req) => {
      const lat = Number(req.query.lat ?? BANGKOK.lat);
      const lon = Number(req.query.lon ?? BANGKOK.lon);
      const cams: Webcam[] = [
        {
          id: 'stub-cam-1',
          title: 'Bangkok (stub)',
          location: { lat, lon, city: 'Bangkok', country: 'TH' },
          provider: 'youtube-fallback',
        },
      ];
      return ok(cams, 'SNAPSHOT');
    },
  );

  app.get<{ Querystring: { q?: string } }>('/api/geocode', async (req) => {
    const q = (req.query.q ?? '').toLowerCase();
    const loc: ResolvedLocation = q.includes('tokyo')
      ? { lat: 35.6762, lon: 139.6503, label: 'Tokyo, Japan', source: 'manual' }
      : { lat: BANGKOK.lat, lon: BANGKOK.lon, label: 'Bangkok, Thailand', source: 'manual' };
    return ok(loc, 'SNAPSHOT');
  });

  app.get<{ Querystring: { lat?: string; lon?: string } }>(
    '/api/geocode/reverse',
    async (req) => {
      const lat = Number(req.query.lat ?? BANGKOK.lat);
      const lon = Number(req.query.lon ?? BANGKOK.lon);
      const loc: ResolvedLocation = { lat, lon, label: 'Stub location', source: 'browser' };
      return ok(loc, 'SNAPSHOT');
    },
  );

  app.get('/api/health', async () => ({ ok: true, ts: new Date().toISOString() }));
}
