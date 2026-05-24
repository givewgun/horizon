/**
 * Phase 2 EARTH-mode routes + utility stubs.
 * Forecast is real (Open-Meteo); geocode, webcams remain stubbed.
 */

import type { FastifyInstance } from 'fastify';
import type { ApiOk, ApiResult, Forecast, ResolvedLocation, Webcam } from '@horizon/shared';
import type { OpenMeteoClient } from '../proxy/openmeteo.js';
import type { NominatimClient } from '../proxy/nominatim.js';
import type { OpenWeatherMapClient } from '../proxy/openweathermap.js';
import type { ImageryClient, ImagerySector, ImageryProduct } from '../proxy/imagery.js';
import type { WindyClient } from '../proxy/windy.js';
import { curatedWebcams } from '../proxy/windy.js';

const ok = <T,>(data: T, status: ApiOk<T>['status'] = 'SNAPSHOT', ageMs?: number): ApiOk<T> =>
  ageMs && ageMs > 0 ? { ok: true, data, status, ageMs } : { ok: true, data, status };

const err = (message: string, code?: string): ApiResult<never> =>
  code ? { ok: false, error: message, code } : { ok: false, error: message };

const BANGKOK = { lat: 13.7563, lon: 100.5018 };

interface EarthDeps {
  openmeteo: OpenMeteoClient;
  nominatim: NominatimClient;
  openweathermap?: OpenWeatherMapClient;
  imagery: ImageryClient;
  windy?: WindyClient;
}

const VALID_SECTORS: ImagerySector[] = ['goes-east', 'goes-west', 'himawari'];
const VALID_PRODUCTS: ImageryProduct[] = ['geocolor', 'ir', 'wv'];

export function registerStubRoutes(app: FastifyInstance, deps: EarthDeps): void {
  app.get<{ Querystring: { lat?: string; lon?: string } }>(
    '/api/forecast',
    async (req, reply) => {
      const lat = Number(req.query.lat ?? BANGKOK.lat);
      const lon = Number(req.query.lon ?? BANGKOK.lon);
      try {
        const { data, ageMs } = await deps.openmeteo.forecast(lat, lon);
        return ok<Forecast>(data, 'REALTIME', ageMs);
      } catch (e) {
        const cached = deps.openmeteo.lastGood(lat, lon);
        if (cached) return ok<Forecast>(cached.data, 'SNAPSHOT', cached.ageMs);
        app.log.warn({ err: e }, 'openmeteo forecast failed, no cache');
        return reply.code(502).send(err('forecast unavailable', 'OPENMETEO_DOWN'));
      }
    },
  );

  app.get<{ Querystring: { lat?: string; lon?: string; radius?: string } }>(
    '/api/webcams',
    async (req) => {
      const lat = Number(req.query.lat ?? BANGKOK.lat);
      const lon = Number(req.query.lon ?? BANGKOK.lon);
      const radiusKm = Number(req.query.radius ?? 250);
      if (deps.windy) {
        try {
          const { data, ageMs } = await deps.windy.nearby(lat, lon, radiusKm);
          return ok<Webcam[]>(data, 'LIVE', ageMs);
        } catch (e) {
          const cached = deps.windy.lastGoodNearby(lat, lon, radiusKm);
          if (cached) return ok<Webcam[]>(cached.data, 'SNAPSHOT', cached.ageMs);
          app.log.warn({ err: e }, 'windy webcams failed, returning curated list');
        }
      }
      return ok<Webcam[]>(curatedWebcams(lat, lon), 'SNAPSHOT');
    },
  );

  app.get<{ Querystring: { q?: string } }>('/api/geocode', async (req, reply) => {
    const q = req.query.q ?? '';
    try {
      const { data, ageMs } = await deps.nominatim.forward(q);
      return ok<ResolvedLocation>(data, 'REALTIME', ageMs);
    } catch (e) {
      const cached = deps.nominatim.lastGoodForward(q);
      if (cached) return ok<ResolvedLocation>(cached.data, 'SNAPSHOT', cached.ageMs);
      app.log.warn({ err: e }, 'nominatim forward failed, no cache');
      return reply.code(502).send(err('geocode unavailable', 'NOMINATIM_DOWN'));
    }
  });

  app.get<{ Querystring: { lat?: string; lon?: string } }>(
    '/api/geocode/reverse',
    async (req, reply) => {
      const lat = Number(req.query.lat ?? BANGKOK.lat);
      const lon = Number(req.query.lon ?? BANGKOK.lon);
      try {
        const { data, ageMs } = await deps.nominatim.reverse(lat, lon);
        return ok<ResolvedLocation>(data, 'REALTIME', ageMs);
      } catch (e) {
        const cached = deps.nominatim.lastGoodReverse(lat, lon);
        if (cached) return ok<ResolvedLocation>(cached.data, 'SNAPSHOT', cached.ageMs);
        app.log.warn({ err: e }, 'nominatim reverse failed, no cache');
        return reply.code(502).send(err('reverse geocode unavailable', 'NOMINATIM_DOWN'));
      }
    },
  );

  app.get<{ Params: { layer: string; z: string; x: string; y: string } }>(
    '/api/weather/owm-tile/:layer/:z/:x/:y.png',
    async (req, reply) => {
      if (!deps.openweathermap) {
        reply.code(503).send(err('OWM tiles unavailable (key not configured)', 'OWM_DISABLED'));
        return;
      }
      const layer = req.params.layer as 'clouds' | 'precipitation' | 'wind' | 'temperature';
      const z = Number(req.params.z);
      const x = Number(req.params.x);
      const y = Number(req.params.y);

      if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
        return reply.code(400).send(err('invalid tile coordinates'));
      }

      try {
        const { data } = await deps.openweathermap.tile(layer, z, x, y);
        reply.header('Content-Type', 'image/png').header('Cache-Control', 'public, max-age=3600');
        return reply.send(data);
      } catch (e) {
        const cached = deps.openweathermap.lastGood(layer, z, x, y);
        if (cached) {
          reply.header('Content-Type', 'image/png').header('Cache-Control', 'public, max-age=3600');
          return reply.send(cached.data);
        }
        app.log.warn({ err: e }, 'owm tile fetch failed');
        return reply.code(502).send(err('tile unavailable', 'OWM_TILE_DOWN'));
      }
    },
  );

  app.get<{ Params: { sector: string; product: string } }>(
    '/api/imagery/:sector/:product/latest.jpg',
    async (req, reply) => {
      const sector = req.params.sector as ImagerySector;
      const product = req.params.product as ImageryProduct;
      if (!VALID_SECTORS.includes(sector) || !VALID_PRODUCTS.includes(product)) {
        return reply.code(400).send(err('invalid sector or product'));
      }
      try {
        const { data } = await deps.imagery.latest(sector, product);
        reply
          .header('Content-Type', data.contentType)
          .header('Cache-Control', 'public, max-age=300');
        return reply.send(data.bytes);
      } catch (e) {
        const cached = deps.imagery.lastGood(sector, product);
        if (cached) {
          reply
            .header('Content-Type', cached.data.contentType)
            .header('Cache-Control', 'public, max-age=300');
          return reply.send(cached.data.bytes);
        }
        app.log.warn({ err: e }, 'imagery fetch failed');
        return reply.code(502).send(err('imagery unavailable', 'IMAGERY_DOWN'));
      }
    },
  );

  app.get('/api/health', async () => ({ ok: true, ts: new Date().toISOString() }));
}
