# ADR-0001 — Stack, hosting, and deployment shape

- **Status:** accepted
- **Date:** 2026-05-23

## Context

We need to ship a dual-mode (SPACE / EARTH) live dashboard with multiple flaky third-party feeds, a Telegram bot for launch alerts, and a working deploy on an existing Oracle Cloud Ampere A1 (ARM64) VM that already runs a Cloudflare Tunnel. The build is staged across four phases, with the realistic expectation that context will be lost between sessions — so the choice should be boring, durable, and easy for a cold session to extend.

## Decision

1. **One Node/TypeScript process for everything.** Fastify serves both the built React SPA and `/api/*`; the Telegram bot runs in the same process on an internal scheduler. One image, one container, one port (8080), one set of logs.
2. **Single Docker Compose stack on the existing VM, bound to 127.0.0.1.** Public exposure is the existing Cloudflare Tunnel only (`horizon.givewgun.com -> http://localhost:8080`). No serverless. No public ports. No CORS.
3. **Monorepo with pnpm workspaces and `packages/shared` for TS types.** Shared types are imported, never duplicated, so frontend and backend cannot drift.
4. **Same-origin `/api/*` is the only network surface for the SPA.** All API keys (OpenWeatherMap, Windy, Telegram, optional N2YO) live server-side; the frontend bundle is key-free.
5. **Strict TypeScript with `"strict": true` plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.** No `any`; use `unknown` + narrowing at boundaries.
6. **Free tiers and dev endpoints during the build.** Default `LL2_BASE` is `lldev.thespacedevs.com/2.3.0`; flip to prod via env. Key-gated panels (OWM tiles, Windy webcams, Telegram bot) **disable themselves at runtime** when their credentials are missing, returning a clean `FeedFallback` instead of crashing boot. Frontend never knows the key — it just sees the feature flag through API responses / behavior.
7. **SQLite via `better-sqlite3`, with a runtime fallback chain.** First-choice is `better-sqlite3` (sync, fast, well-suited to the bot's small write volume). On ARM64 native-build failure, we fall back to Node's `node:sqlite` (Node 22+). If neither is available, an in-memory store keeps the rest of the system functional — at the cost of losing dedup state across restarts, which is acceptable in dev.
8. **Dark "mission control" aesthetic with monospace telemetry.** Status of every data panel is conveyed by an honest badge: `LIVE`, `~REALTIME`, or `SNAPSHOT`. No feed labeled higher than what it actually is.
9. **Docs are first-class.** `docs/ARCHITECTURE.md`, `docs/HANDOVER.md`, `docs/PROGRESS.md`, and per-decision ADRs are written and updated at every phase boundary. `HANDOVER.md` is overwritten so a cold session always has a current "you are here."

## Consequences

- **Operational simplicity.** One container, one deploy step (`docker compose up -d --build`). Tunnel already exists, so there is no DNS/cert work for us to do.
- **No CORS, no frontend secrets.** Eliminates an entire category of bugs and a real-world security risk.
- **Locked vertical scaling.** If load grows beyond what the A1 instance can carry, we move to two containers (frontend behind nginx, backend separate) and re-evaluate. Not a concern at this scale.
- **Strict TS adds friction up front; we accept this trade for long-term editability.** Shared types in `@horizon/shared` give us refactor leverage we'd lose with duplicated DTOs.
- **The bot runs in the same process as the web server.** If the process crashes, both stop together — which is fine, because Compose restarts on failure. We do not need queueing or a worker tier.
- **ARM64 native compile risk** is mitigated by the `tryBetterSqlite3 → tryNodeSqlite → memory` chain in `packages/backend/src/store/db.ts`.

## Alternatives considered

- **Vercel / Cloudflare Pages / Functions for the SPA, separate API on the VM.** Rejected: introduces CORS, splits secrets, doubles deploys, and adds an extra moving piece for no real benefit at this size.
- **Two containers (Vite preview + Fastify API) behind a reverse proxy.** Rejected: needless complexity given that Fastify can serve static files perfectly well.
- **Worker tier for the Telegram bot (BullMQ + Redis).** Rejected: at five-minute tick + low volume, an in-process `setInterval` is correct and simpler. Revisit only if alert latency or fan-out grows.
- **Prisma + Postgres.** Rejected for the alert-dedup table — one tiny table with PRIMARY KEY (launch_id, lead) doesn't justify a server-grade database; SQLite + a volume is right-sized.
- **Loose TS (`"strict": false`).** Rejected: this is a portfolio + learning project explicitly built to refactor over time. Strict is cheap insurance.
