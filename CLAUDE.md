# CLAUDE.md

Project-specific guidance for Claude Code on **Orbit & Atmosphere** (a live SPACE + EARTH dashboard with Telegram launch alerts). The original brief is in `prompt.md`; the current "you are here" pointer is `docs/HANDOVER.md`.

## What this project is

- Dual-mode dashboard (SPACE / EARTH) deployed as **one Docker container** on an Oracle Cloud Ampere A1 (ARM64) VM, exposed via the existing Cloudflare Tunnel at `horizon.givewgun.com`.
- One Node/TS process: Fastify serves the built React SPA + `/api/*` + runs the grammY Telegram bot on an internal scheduler.
- The browser computes satellite positions client-side with `satellite.js` (SGP4) — backend caches TLEs, not live positions.

## Stack (fixed — change requires an ADR + user confirmation)

- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS, TanStack Query, Zustand. CesiumJS via `vite-plugin-cesium` (Phase 1, lazy-loaded). d3-celestial (sky map). MapLibre GL JS (weather map).
- **Backend:** Fastify (TS, ESM), grammY (Telegram), better-sqlite3 with `node:sqlite` and in-memory fallbacks, zod for env validation.
- **Repo:** pnpm monorepo, `packages/shared` for TS types shared between frontend and backend.

## Commands

| Command                          | Purpose                              |
| -------------------------------- | ------------------------------------ |
| `pnpm install`                   | Install all workspace deps.          |
| `pnpm --filter @horizon/shared build` | **Run first** if other packages can't resolve types. |
| `pnpm dev:backend`               | Fastify on `:8080` (tsx watch).      |
| `pnpm dev:frontend`              | Vite on `:5173`, proxies `/api` → `:8080`. |
| `pnpm build`                     | Build shared → frontend → backend.   |
| `pnpm -r typecheck`              | `tsc --noEmit` across packages.      |
| `pnpm -r lint`                   | ESLint across packages.              |
| `pnpm -r test`                   | Vitest across packages.              |
| `docker compose up --build`      | Full container on `:8080`.           |

## Hard rules (re-read each session)

- **Strict TypeScript.** `"strict": true`. No `any`; use `unknown` + narrowing. Types live in `packages/shared/src/types.ts` and are imported, never duplicated.
- **No secrets in the frontend.** API keys live in env on the server; the SPA only calls same-origin `/api/*`. No CORS.
- **Honest status badges everywhere.** Every panel renders a `LIVE` / `~REALTIME` / `SNAPSHOT` badge that reflects the actual feed. We do not call a snapshot "live."
- **Graceful degradation.** Every external feed can fail or rate-limit. Each panel must render a clean `FeedFallback` on failure — never a broken iframe or blank space.
- **Times in UTC + Asia/Bangkok.** Use `formatUtcAndBangkok` from `packages/frontend/src/lib/time.ts`. Never display only UTC or only local.
- **Mobile usable.** Both modes work on a phone, including touch gestures on the globe and map.
- **JWST stays at L2.** It is a near-fixed marker. We do not propagate it with SGP4.
- **Telegram bot never sends an empty link.** Early leads (T-24h, T-1h) link to the launch page; late leads (T-10m, liftoff) prefer webcast URL if `vidURLs` is non-empty, otherwise also the launch page. This logic is `selectLink` and is unit-tested.

## Reality-check table (don't build dead features)

| User imagined            | Reality                                    | Build instead                                |
| ------------------------ | ------------------------------------------ | -------------------------------------------- |
| Hubble/JWST live camera  | Observatories, not webcams.                | Marker + latest-released image, `SNAPSHOT`.  |
| JWST position            | L2, ~1.5M km. Not a LEO orbit.             | Fixed marker. No SGP4.                       |
| ISS exterior live cam    | NASA HD Earth on YouTube; cuts to blue.    | Embed + standby detection → `FeedFallback`. |
| City CCTV                | No unified public CCTV API.                | Windy webcams network. Call it "webcams."   |
| Real-time storm imagery  | Geostationary, ~10 min refresh.            | Animate the last N frames.                  |
| "Live" launch video      | Per-launch; goes live near T-0.            | Embed when `webcastLive === true`; else countdown. |

## Working mode (semi-autonomous)

- Build through the four phases in order: **0 setup → 1 SPACE → 2 EARTH → 3 bot + polish**. Stop **only** at phase boundaries.
- At every boundary, update: `docs/ARCHITECTURE.md`, `docs/HANDOVER.md` (overwrite!), `docs/PROGRESS.md` (append), `README.md`, and add ADRs for any notable judgment call.
- Decide implementation details yourself. Pause to ask the user only when a decision involves money/paid services or a material architecture change from `prompt.md`.

## Git conventions

- Branch prefix for Claude: `claude/<short-slug>`.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, etc.). Use `feat:`/`fix:` only for user-facing changes; everything else is internal.
- Never commit unless the user asks. Never bypass commit hooks.
- No secrets in commits. `.env` is gitignored; `.env.example` is the source of truth for env shape.

## Things NOT to do

- Don't introduce a new top-level dependency without an ADR + user confirmation.
- Don't add CORS, public ports, or a second container.
- Don't add fallbacks/error handling for cases that can't happen — boundary validation only.
- Don't write comments that just restate the code.
- Don't claim work is complete before verification commands have actually been run.
