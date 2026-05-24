/**
 * Remaining Phase 2 / utility stubs. SPACE-mode routes have moved into
 * `routes/space.ts` and hit real upstreams; everything below is still mocked
 * shape-correctly so the frontend can build against the contract.
 */

import type { FastifyInstance } from 'fastify';
import type { ApiOk, Forecast, ResolvedLocation, Webcam } from '@horizon/shared';

const ok = <T,>(data: T, status: ApiOk<T>['status'] = 'SNAPSHOT'): ApiOk<T> => ({
  ok: true,
  data,
  status,
});

const BANGKOK = { lat: 13.7563, lon: 100.5018 };

export function registerStubRoutes(app: FastifyInstance): void {
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
