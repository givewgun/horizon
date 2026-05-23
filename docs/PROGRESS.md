# Progress log

Append-only. One line per substantive change.

- 2026-05-23 | Phase 0 | Monorepo scaffold (pnpm workspace, strict TS, ESLint, Prettier, .gitignore/.dockerignore).
- 2026-05-23 | Phase 0 | @horizon/shared shipped with initial domain types (Launch, TLE, SatellitePosition, Forecast, Webcam, SpaceWeather, ApiResult, ResolvedLocation, FeedStatus).
- 2026-05-23 | Phase 0 | @horizon/backend: Fastify boot, zod env config, stub routes for every /api/* endpoint, AlertStore skeleton with better-sqlite3 → node:sqlite → in-memory fallback, /api/health.
- 2026-05-23 | Phase 0 | @horizon/frontend: app shell, persistent SPACE/EARTH switcher (Zustand + localStorage), non-blocking LocationContext with Bangkok fallback + manual city search, StatusBadge / GlobalClock / FeedFallback / Skeleton / ErrorBoundary, placeholder SPACE + EARTH panels.
- 2026-05-23 | Phase 0 | Dockerfile (multi-stage, ARM64-aware), docker-compose (loopback-bound for Cloudflare Tunnel at horizon.givewgun.com), .env.example, GitHub Actions CI (typecheck + lint + test).
- 2026-05-23 | Phase 0 | Tests: lib/time (UTC+Bangkok + countdown), StatusBadge, backend config, backend AlertStore.
- 2026-05-23 | Phase 0 | Docs: ARCHITECTURE, HANDOVER, PROGRESS, ADR-0001 (stack & hosting), README, CLAUDE.md rewritten for this project.
