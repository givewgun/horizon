# Orbit & Atmosphere

A live SPACE + EARTH dashboard with two selectable modes, deployed as a single Docker container behind a Cloudflare Tunnel.

> **Status:** Phase 0 (setup) complete. Phase 1 (SPACE) up next. See `docs/HANDOVER.md` for the current "you are here" pointer.

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

- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS, TanStack Query, Zustand. CesiumJS (Phase 1, lazy-loaded), d3-celestial, MapLibre GL JS.
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
