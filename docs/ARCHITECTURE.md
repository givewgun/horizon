# Architecture

> Snapshot as of **end of Phase 1**. Update at every phase boundary.

## High-level

```
                            +----------------------------+
                            |   Cloudflare Tunnel        |
                            |   horizon.givewgun.com     |
                            +--------------+-------------+
                                           |
                                           v
+----------------------+   same-origin    +-----------------------+      +-----------------+
|   Browser (SPA)      | <-------------- |   Fastify (8080)      | ---> | LL2 / CelesTrak |
|   React + Vite       |    /api/*       |   serves /dist        |      | NOAA SWPC       |
|   - CesiumJS (lazy)  |                  |   serves /api/*       |      | Open-Meteo (P2) |
|   - canvas NightSky  |                  |   runs grammY bot     |      | OWM/Windy   (P2)|
|   - satellite.js     |                  |   reads SQLite        |      | Nominatim   (P2)|
+----------------------+                  +----------+------------+      +-----------------+
                                                     |
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

## Backend layout (Phase 1)

```
packages/backend/src/
  server.ts                  boot, env, register routes, lazy-mount bot in Phase 3
  config.ts                  zod env, feature flags from cred presence
  proxy/
    cache.ts                 TtlCache<T> — TTL + single-flight + lastGood
    http.ts                  fetchUpstream — timeout + UpstreamError
    ll2.ts                   LL2Client + normalizeLaunch
    swpc.ts                  SwpcClient (Kp + solar wind + Bz + GOES X-ray + aurora rule)
    celestrak.ts             CelestrakClient (TLE passthrough)
    youtube.ts               YouTubeLiveClient — scrapes /channel/<CID>/live for live videoId
  routes/
    space.ts                 /api/launches/*, /api/tle/:catnr, /api/spaceweather,
                             /api/live/youtube/:channelId
    stubs.ts                 remaining Phase 2 stubs + geocode + /api/health
  store/db.ts                SQLite: sent_alerts (Phase 3 bot)
```

## Frontend layout (Phase 1)

```
packages/frontend/src/
  app/{Shell,ModeSwitcher}.tsx
  context/LocationContext.tsx
  components/common/{StatusBadge,GlobalClock,FeedFallback,Skeleton,ErrorBoundary}.tsx
  lib/
    api.ts                   typed apiGet<T> against /api/*
    time.ts                  formatUtcAndBangkok + countdown
    orbits.ts                satellite.js wrapper (propagation, ground track, passes)
    skymath.ts               GMST, equatorial→alt-az, stereographic projection
    modeStore.ts             Zustand persistent mode switch
    globeStore.ts            Zustand cross-panel store: globe pin + satellite groups
    satCatalog.ts            Preset satellite groups (stations / observatories / weather / earthObs / navigation)
  modes/space/
    SpaceMode.tsx            globe-as-hero layout + grid for the other four panels
    LaunchTracker.tsx        provider filter chips, live countdowns, detail drawer
    SpaceWeather.tsx         Kp gauge + 3-day strip + solar wind + Bz + X-ray + aurora readout
    NightSky.tsx             planetarium canvas, follows globe pin, twilight + Milky Way + ambient field
    SatelliteGlobe.tsx       Suspense + React.lazy boundary
    SatelliteGlobeInner.tsx  Cesium viewer (OSM imagery), groups + NORAD add, click-to-pin, ISS pass list
    LiveStreams.tsx          tabbed live registry, real videoId per channel via /api/live/youtube/:channelId
  modes/earth/               Phase 2 — still placeholder panels
public/static/constellations.json   curated catalog (see ADR-0003)
```

## Data flow

1. Browser loads SPA from Fastify.
2. SPA calls same-origin `/api/*` (typed via `apiGet<T>()` in `src/lib/api.ts`).
3. Backend proxies upstream APIs, hiding any API keys and caching responses per the TTLs in the build plan. Each route:
   - tries the live client,
   - falls back to `client.lastGood(...)` on upstream failure and demotes the status badge to `SNAPSHOT`,
   - responds 502 with the shared `ApiErr` envelope only when no cache exists at all (frontend then renders `FeedFallback`).
   See ADR-0004.
4. Heavy compute is **client-side**: SGP4 satellite propagation runs in the browser using TLEs pulled per-satellite from `/api/tle/:catnr` (`lib/orbits.ts`). Night-sky alt-az transforms also run in the browser (`lib/skymath.ts`).
5. The Telegram bot is in-process inside the backend. A scheduler (Phase 3) ticks every 5 min, fetches LL2 upcoming, and dispatches deduplicated alerts at T-24h / T-1h / T-10m / liftoff. Dedup state lives in SQLite (`sent_alerts` table).

## Feature flags

The backend reads `OPENWEATHER_KEY`, `WINDY_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` at boot. Missing creds **disable** the related feature with a clean UI fallback — they do NOT crash boot. See `packages/backend/src/config.ts`. The Phase 1 upstreams (LL2, CelesTrak, SWPC) are key-less, so SPACE mode works on a fresh checkout with no `.env` edits.

## Status badge promise (re-stated, enforced by ADR-0004)

| Source                       | Badge in normal operation | Badge when serving cache only |
| ---------------------------- | ------------------------- | ----------------------------- |
| LL2 upcoming / detail        | `~REALTIME`               | `SNAPSHOT` (with `· stale`)   |
| CelesTrak TLE                | `SNAPSHOT`                | `SNAPSHOT` (with `· stale`)   |
| NOAA SWPC                    | `LIVE`                    | `SNAPSHOT` (with `· stale`)   |
| YouTube live lookup          | `LIVE` (when live)        | `SNAPSHOT` (last-good cache) / "not live right now" card when videoId is null |
| Night-sky canvas             | `~REALTIME` (client-computed) | n/a                       |
| Satellite globe              | `~REALTIME` (client-computed) | (TLE chunk demotes per row) |

## What is intentionally NOT done yet

- Open-Meteo / OpenWeatherMap / Windy / Nominatim / RAMMB proxies — Phase 2.
- Telegram bot wiring (grammY scheduler + `leadWindow` / `selectLink` pure logic + tests) — Phase 3.
- Mobile-perf pass for Cesium (it works; reduced-motion + lower-detail toggles are Phase 3 polish).
- ISS pass predictions currently use a naive 30 s sampling scan. Good enough for ≥10° peaks at 48 h horizon; if we add a "tonight only" higher-resolution mode in Phase 3, we'll bisect for entry/exit times.
