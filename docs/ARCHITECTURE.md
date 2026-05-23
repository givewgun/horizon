# Architecture

> Snapshot as of **end of Phase 0**. Update at every phase boundary.

## High-level

```
                            +----------------------------+
                            |   Cloudflare Tunnel        |
                            |   horizon.givewgun.com     |
                            +--------------+-------------+
                                           |
                                           v
+----------------------+   same-origin    +-----------------------+
|   Browser (SPA)      | <-------------- |   Fastify (8080)      |
|   React + Vite       |    /api/*       |   serves /dist        |
|   - CesiumJS (lazy)  |                  |   serves /api/*       |
|   - MapLibre         |                  |   runs grammY bot     |
|   - d3-celestial     |                  |   reads SQLite        |
|   - satellite.js     |                  +----------+------------+
+----------------------+                             |
                                                     v
                                          +-------------------+
                                          |  SQLite (volume)  |
                                          |  sent_alerts      |
                                          +-------------------+
```

One Node process serves everything. No CORS. No frontend secrets.

## Packages

| Path                 | Name                | Role                                           |
| -------------------- | ------------------- | ---------------------------------------------- |
| `packages/shared`    | `@horizon/shared`   | TS types only — imported by both other pkgs.   |
| `packages/frontend`  | `@horizon/frontend` | Vite SPA. Built into `packages/backend/public` in the Docker image. |
| `packages/backend`   | `@horizon/backend`  | Fastify + grammY bot + SQLite + proxy routes. |

## Data flow

1. Browser loads SPA from Fastify.
2. SPA calls same-origin `/api/*` (typed via `apiGet<T>()` in `src/lib/api.ts`).
3. Backend proxies upstream APIs (LL2, CelesTrak, SWPC, OWM, Windy, Open-Meteo, Nominatim), hiding any API keys and caching responses per the TTLs in the build plan.
4. Heavy compute is **client-side**: SGP4 satellite propagation runs in the browser using TLEs cached server-side and pulled per-satellite by the SPA.
5. The Telegram bot is in-process inside the backend. A scheduler (Phase 3) ticks every 5 min, fetches LL2 upcoming, and dispatches deduplicated alerts at T-24h / T-1h / T-10m / liftoff. Dedup state lives in SQLite (`sent_alerts` table).

## Feature flags

The backend reads `OPENWEATHER_KEY`, `WINDY_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` at boot. Missing creds **disable** the related feature with a clean UI fallback — they do NOT crash boot. See `packages/backend/src/config.ts`.

## Phase 0 deliverables (delivered)

- Monorepo scaffolded (pnpm workspace, strict TS, ESLint, Prettier, root .gitignore/.dockerignore).
- `@horizon/shared` shipped with initial domain types (`Launch`, `TLE`, `SatellitePosition`, `Forecast`, `Webcam`, `SpaceWeather`, `ApiResult<T>`, `ResolvedLocation`, `FeedStatus`).
- `@horizon/backend` shipped with: Fastify boot, zod-validated env config, stub routes for every documented `/api/*` endpoint, AlertStore skeleton (better-sqlite3 → node:sqlite → in-memory fallback), `/api/health`, SPA static + fallback to `index.html`.
- `@horizon/frontend` shipped with: app shell, persistent SPACE/EARTH mode switcher (Zustand + localStorage), non-blocking `LocationContext` with Bangkok fallback + manual city search, `StatusBadge` (LIVE / ~REALTIME / SNAPSHOT), `GlobalClock` (UTC + Asia/Bangkok), `FeedFallback`, `Skeleton`, `ErrorBoundary`, stubbed SPACE and EARTH mode placeholder panels.
- Dockerfile (multi-stage, ARM64-aware, native-build-capable), `docker-compose.yml` (loopback-bound, Cloudflare-tunneled), `.env.example`, GitHub Actions CI (typecheck + lint + test).
- Initial tests: `lib/time.ts` (UTC + Asia/Bangkok formatting + countdown), `StatusBadge`, backend `config`, backend `AlertStore`.

## What is intentionally NOT done yet

- LL2 / CelesTrak / SWPC / OWM / Windy / Open-Meteo / Nominatim proxies — Phase 1 & 2.
- CesiumJS globe and `vite-plugin-cesium` wiring — Phase 1, deferred to keep Phase 0 bundle small.
- Telegram bot wiring (grammY scheduler + `leadWindow` / `selectLink` pure logic + tests) — Phase 3.
- Static `constellations.json`, RAMMB sector tables, featured-city webcam list — Phase 1/2.
