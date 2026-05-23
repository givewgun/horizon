# HANDOVER — you are here

> Overwritten at every phase boundary. Read this first if you're picking up the project cold.

## Status: Phase 0 complete. Phase 1 (SPACE mode) next.

## How to run (right now)

```bash
pnpm install
cp .env.example .env             # all values can stay empty for Phase 0
pnpm --filter @horizon/shared build   # types must be built before the others typecheck
pnpm dev:backend                 # terminal 1 — Fastify on :8080
pnpm dev:frontend                # terminal 2 — Vite on :5173 (proxies /api -> :8080)
# OR:
docker compose up --build        # one container on http://localhost:8080
```

Verification (Phase 0 acceptance):

- `pnpm -r typecheck && pnpm -r test && pnpm -r lint` is clean.
- Visit `/`: header shows project name + UTC + Asia/Bangkok clocks + resolved location (default "Bangkok, Thailand (default)" until geolocation prompt is allowed).
- Left rail switches SPACE / EARTH; choice persists across reload (`horizon.mode` in localStorage).
- Each placeholder panel renders with the correct status badge (LIVE / ~REALTIME / SNAPSHOT).
- `curl http://localhost:8080/api/health` returns `{ ok: true, ts: ... }`.
- `curl http://localhost:8080/api/launches/upcoming` returns a stub launch.

## What works

- Mode shell, mode switching, persistent mode selection.
- Non-blocking geolocation with Bangkok fallback. Manual city search via `/api/geocode?q=...`.
- All documented `/api/*` routes respond with shape-correct stubs (frontend can be built against them today).
- StatusBadge / GlobalClock / FeedFallback / Skeleton / ErrorBoundary all in place.
- Backend env validation (zod) — boot fails fast with a readable error if config is malformed.
- AlertStore skeleton with three-tier fallback: better-sqlite3 → node:sqlite → in-memory.
- CI on push (typecheck, lint, test).
- Docker image builds end-to-end and serves the SPA + API from one process.

## What is stubbed

- Every backend route returns mocked data — no upstream calls yet.
- Bot is detected by env presence but not wired (Phase 3).
- SPACE and EARTH panels are placeholder cards with `Skeleton` + a note describing what each will become.

## Where you left off / next concrete steps (Phase 1 plan)

In order:

1. **Launch tracker** — replace stub `/api/launches/upcoming` and `/api/launches/:id` with a real LL2 client in `packages/backend/src/proxy/ll2.ts` (cache 60s / 30s). Build the React panel: list with provider chips, live countdown, detail drawer with conditional webcast embed (only when `webcastLive === true`). Use `formatUtcAndBangkok` + `countdown` from `src/lib/time.ts`.
2. **Space weather** — `packages/backend/src/proxy/swpc.ts` proxies NOAA SWPC Kp + aurora. Frontend Kp gauge + 3-day strip + aurora-likelihood-by-latitude readout.
3. **Night sky (d3-celestial)** — ship a static `constellations.json` (name, short mythology, brightest star, season) under `packages/frontend/public/static/`. Mount d3-celestial centered on user location/time.
4. **Satellite globe (CesiumJS)** — install `vite-plugin-cesium`. Lazy-load the globe panel only when SPACE mode is active. Pull TLEs via `/api/tle/:catnr`, propagate client-side with `satellite.js`. ISS first, then Hubble, then user-addable NORAD IDs, then ISS pass predictions, then JWST as **fixed L2 marker** (no SGP4). Day/night terminator + ground track overlays. Side card: NASA ISS HD Earth YouTube live with standby detection → FeedFallback.

Tests to add in Phase 1:

- `lib/orbits.test.ts` — propagate a known TLE at a known instant, assert lat/lon within tolerance.
- `__tests__/launchNormalizer.test.ts` — LL2 response → `Launch` (cover missing `vidURLs`, `net_precision` variants).
- Component tests for `LaunchTracker` loading / loaded / failed states.

## Known issues / gotchas

- The frontend's `tsc` build relies on `@horizon/shared` being built first (we depend on `dist/index.d.ts`). The root `pnpm build` script already orders this correctly. CI runs `pnpm --filter @horizon/shared build` explicitly before `typecheck`.
- Native module compile (better-sqlite3) inside the Dockerfile requires `python3 + build-essential`, already installed in the `deps` stage. If the arm64 build ever fails on Oracle, the `db.ts` fallback chain quietly downgrades to `node:sqlite` (Node 22+) or in-memory — capture in ADR-0002 if we permanently switch.
- Cesium is *not* installed yet on purpose — it's the heaviest dep in the project. Bring it in inside Phase 1 with `vite-plugin-cesium`; do not hand-copy static assets.
- `prompt.md` at the repo root is the original brief and is `.dockerignore`d but **not** `.gitignore`d. Leave it in the repo as living context for handoffs.

## Useful local commands

```bash
# Open a one-shot Fastify against the dev SPA build (no Vite proxy)
pnpm --filter @horizon/frontend build && pnpm --filter @horizon/backend dev

# Tail the container
docker compose logs -f horizon

# Reset only the SQLite volume (no other state)
docker compose down && rm -f data/horizon.sqlite && docker compose up -d
```
