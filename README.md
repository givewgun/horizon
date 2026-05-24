# Horizon

A live SPACE + EARTH dashboard with two selectable modes, deployed as a single Docker container behind a Cloudflare Tunnel.

> **Status:** Phase 1 (SPACE mode) complete. Phase 2 (EARTH) up next. See `docs/HANDOVER.md` for the current "you are here" pointer.

## Quick start

```bash
# 1) Install deps
pnpm install

# 2) Create your env from the example
cp .env.example .env

# 3) Dev (two processes, Vite proxies /api to Fastify)
pnpm dev:backend   # terminal 1 — Fastify on :8080
pnpm dev:frontend  # terminal 2 — Vite on :5173

# Or, full container:
docker compose up --build
# -> http://localhost:8080
```

## Production (Oracle Cloud Ampere A1, ARM64)

```bash
# On the VM (Docker installed)
git clone <this repo> horizon && cd horizon
cp .env.example .env  # fill keys you have; missing keys disable specific panels
docker compose up -d --build
```

### Cloudflare Tunnel ingress

Add to your existing tunnel's `config.yml` (above the wildcard catch-all):

```yaml
ingress:
  - hostname: horizon.givewgun.com
    service: http://localhost:8080
  # ... other rules ...
  - service: http_status:404
```

Then `cloudflared tunnel ingress validate && systemctl reload cloudflared` (or whatever your tunnel uses).

## Stack

- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS, TanStack Query, Zustand. CesiumJS (lazy-loaded), satellite.js (client-side SGP4), canvas night-sky renderer (see ADR-0003 on the d3-celestial deviation), MapLibre GL JS (Phase 2).
- **Backend:** Fastify (TS, ESM), in-process grammY Telegram bot, SQLite (better-sqlite3 with node:sqlite fallback).
- **Build/deploy:** pnpm workspace, multi-stage Dockerfile (ARM64-aware), single container behind Cloudflare Tunnel.

## Repository layout

```
horizon/
  Dockerfile                multi-stage; arm64-aware build of all 3 packages
  docker-compose.yml        single service, bound to 127.0.0.1, tunneled
  .env.example              every supported env var, documented
  .github/workflows/ci.yml  typecheck + lint + test on push / PR
  docs/                     ARCHITECTURE, HANDOVER, PROGRESS, adr/
  packages/
    shared/                 @horizon/shared — TS types only
    frontend/               @horizon/frontend — Vite SPA
    backend/                @horizon/backend — Fastify + bot + SQLite
```

## Scripts (root)

| Command                | What it does                          |
| ---------------------- | ------------------------------------- |
| `pnpm dev:frontend`    | Vite dev server on :5173 (proxies /api to :8080) |
| `pnpm dev:backend`     | Fastify with tsx watch on :8080       |
| `pnpm build`           | Build shared → frontend → backend     |
| `pnpm test`            | Run all package test suites           |
| `pnpm typecheck`       | tsc --noEmit across packages          |
| `pnpm lint`            | ESLint across packages                |

## Documentation

- `docs/ARCHITECTURE.md` — current system design + data flow.
- `docs/HANDOVER.md` — overwritten at every phase boundary; cold-start friendly.
- `docs/PROGRESS.md` — append-only log of phase changes.
- `docs/adr/` — Architecture Decision Records.

## Phase 1 features (live now)

- **Launch tracker** with provider filter chips and live countdowns, backed by The Space Devs (LL2). Detail drawer embeds the webcast iframe **only** when LL2 reports `webcastLive === true`; otherwise it shows a countdown plus a link to the launch page.
- **Satellite globe** (CesiumJS, lazy-loaded). ISS + Hubble track live with ground tracks; add any NORAD id by number; JWST is a fixed L2 marker (never propagated). Side card lists the next visible ISS passes (≥10° peak) for your location, computed locally from the TLE.
- **Night sky** (canvas). Alt-az projection centred on your location and the current time. Hover for constellation name, mythology, brightest star, and best viewing season. `+0…+12h` time scrubber.
- **Space weather** (NOAA SWPC). Current Kp gauge, 3-day forecast strip, aurora-likelihood readout for your latitude.
- **ISS HD Earth** — NASA HDEV YouTube live embed with a manual standby fallback (we can't introspect the iframe cross-origin).

- **Live · multi-source** — tabbed registry of live broadcast sources (NASA, NSF, SpaceX, ESA, Everyday Astronaut, Spaceflight Now, 24/7 Earth-from-ISS). Each tab queries `/api/live/youtube/:channelId`; the backend scrapes the channel's `/live` page server-side for the current live videoId and the frontend embeds it directly. See `docs/adr/0005-youtube-live-scrape-vs-data-api.md`.

Every panel renders a `LIVE` / `~REALTIME` / `SNAPSHOT` badge that demotes to `SNAPSHOT · stale` when the backend is serving last-good cache because an upstream is currently failing. See `docs/adr/0004-graceful-upstream-failure-policy.md`.
