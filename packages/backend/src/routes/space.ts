/**
 * Phase 1 SPACE-mode routes: launches, TLEs, space weather.
 *
 * Each handler tries the live proxy first, falls back to last-good cache on
 * upstream failure, and only 502s if there's no cached payload at all. The
 * shared `ApiResult<T>` envelope carries a `status` ('LIVE' / 'REALTIME' /
 * 'SNAPSHOT') and optional `ageMs` so the frontend StatusBadge stays honest.
 */

import type { FastifyInstance } from 'fastify';
import type { ApiResult, FeedStatus, Launch, SpaceWeather, TLE } from '@horizon/shared';
import type { LL2Client } from '../proxy/ll2.js';
import type { SwpcClient } from '../proxy/swpc.js';
import type { CelestrakClient } from '../proxy/celestrak.js';
import type { YouTubeLiveClient, LiveLookup } from '../proxy/youtube.js';

interface Deps {
  ll2: LL2Client;
  swpc: SwpcClient;
  tle: CelestrakClient;
  youtube: YouTubeLiveClient;
}

function ok<T>(data: T, status: FeedStatus, ageMs?: number): ApiResult<T> {
  return ageMs && ageMs > 0 ? { ok: true, data, status, ageMs } : { ok: true, data, status };
}

function err(message: string, code?: string): ApiResult<never> {
  return code ? { ok: false, error: message, code } : { ok: false, error: message };
}

export function registerSpaceRoutes(app: FastifyInstance, deps: Deps): void {
  app.get('/api/launches/upcoming', async (_req, reply) => {
    try {
      const { data, ageMs } = await deps.ll2.upcoming(20);
      return ok<Launch[]>(data, 'REALTIME', ageMs);
    } catch (e) {
      const cached = deps.ll2.lastGoodUpcoming(20);
      if (cached) return ok<Launch[]>(cached.data, 'SNAPSHOT', cached.ageMs);
      app.log.warn({ err: e }, 'll2 upcoming failed, no cache');
      return reply.code(502).send(err('launches upstream unavailable', 'LL2_DOWN'));
    }
  });

  app.get<{ Params: { id: string } }>('/api/launches/:id', async (req, reply) => {
    const { id } = req.params;
    try {
      const { data, ageMs } = await deps.ll2.detail(id);
      return ok<Launch>(data, 'REALTIME', ageMs);
    } catch (e) {
      const cached = deps.ll2.lastGoodDetail(id);
      if (cached) return ok<Launch>(cached.data, 'SNAPSHOT', cached.ageMs);
      app.log.warn({ err: e, id }, 'll2 detail failed, no cache');
      return reply.code(502).send(err('launch detail upstream unavailable', 'LL2_DOWN'));
    }
  });

  app.get<{ Params: { catnr: string } }>('/api/tle/:catnr', async (req, reply) => {
    const catnr = Number.parseInt(req.params.catnr, 10);
    if (!Number.isFinite(catnr) || catnr <= 0) {
      return reply.code(400).send(err('catnr must be a positive integer', 'BAD_CATNR'));
    }
    try {
      const { data, ageMs } = await deps.tle.tle(catnr);
      return ok<TLE>(data, 'SNAPSHOT', ageMs);
    } catch (e) {
      const cached = deps.tle.lastGood(catnr);
      if (cached) return ok<TLE>(cached.data, 'SNAPSHOT', cached.ageMs);
      app.log.warn({ err: e, catnr }, 'tle fetch failed, no cache');
      return reply.code(502).send(err('TLE upstream unavailable', 'CELESTRAK_DOWN'));
    }
  });

  app.get<{ Params: { channelId: string } }>(
    '/api/live/youtube/:channelId',
    async (req, reply) => {
      const { channelId } = req.params;
      try {
        const { data, ageMs } = await deps.youtube.live(channelId);
        return ok<LiveLookup>(data, data.isLive ? 'LIVE' : 'SNAPSHOT', ageMs);
      } catch (e) {
        const cached = deps.youtube.lastGood(channelId);
        if (cached) return ok<LiveLookup>(cached.data, 'SNAPSHOT', cached.ageMs);
        app.log.warn({ err: e, channelId }, 'youtube live lookup failed');
        return reply.code(502).send(err('youtube live lookup failed', 'YT_DOWN'));
      }
    },
  );

  app.get<{ Querystring: { lat?: string } }>('/api/spaceweather', async (req, reply) => {
    const lat = Number(req.query.lat);
    const latitude = Number.isFinite(lat) ? lat : 13.7563;
    try {
      const { data, ageMs } = await deps.swpc.get(latitude);
      return ok<SpaceWeather>(data, 'LIVE', ageMs);
    } catch (e) {
      const cached = deps.swpc.lastGood(latitude);
      if (cached) return ok<SpaceWeather>(cached.data, 'SNAPSHOT', cached.ageMs);
      app.log.warn({ err: e }, 'swpc failed, no cache');
      return reply.code(502).send(err('space weather upstream unavailable', 'SWPC_DOWN'));
    }
  });
}
