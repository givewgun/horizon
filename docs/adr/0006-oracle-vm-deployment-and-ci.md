# ADR-0006 — Oracle VM deployment + GitHub Actions CI/CD

- **Status:** accepted
- **Date:** 2026-05-24

## Context

ADR-0001 already commits us to one Node process, one container, on the existing Oracle Cloud Ampere A1 (ARM64) VM behind the existing Cloudflare Tunnel. What was not yet pinned down: how the container actually gets onto the VM, how secrets reach it, and how the routing is wired. The sister project `gunvest` already runs on this VM with a proven pattern (multi-app Cloudflare Tunnel + `appleboy/ssh-action` deploy), so the cheap move is to reuse that pattern rather than invent a new one.

## Decision

1. **Same VM as gunvest, same global Cloudflare Tunnel.** A single `cloudflared` container on the VM joins the external Docker network `tunnel-gateway`. Each app container also joins that network. Cloudflare's Zero Trust Public Hostname routes `horizon.givewgun.com → http://horizon-app:8080` over the tunnel. No host ports for the app, no inbound firewall holes (only port 22).
2. **Two compose files in the repo.**
   - `docker-compose.yml` — local dev / single-VM hobby use, binds `127.0.0.1:8080`.
   - `docker-compose.prod.yml` — production on the Oracle VM. No port mapping, `container_name: horizon-app`, joins `tunnel-gateway` (external), bind-mounts `./data` for the sqlite file.
3. **GitHub Actions `.github/workflows/ci.yml` is the only deploy mechanism.**
   - `verify` job (always) — install, build shared types, typecheck, lint, test.
   - `docker` job (master only) — sanity-check the Dockerfile builds.
   - `deploy` job (master only) — `appleboy/ssh-action` into the VM as `ubuntu`, `git pull`, regenerate `.env.production`, `docker compose up -d --build`, `docker system prune -f`.
4. **`.env.production` is generated on every deploy from GitHub Secrets.** The SSH script writes it via heredoc using secrets passed through `envs:`. GitHub is the source of truth for runtime config; the VM never holds a hand-edited env file that can silently drift. Missing secret → empty value → the matching panel disables itself via the rule in ADR-0001 / ADR-0004.
5. **One-shot bootstrap is `scripts/oracle-vm-setup.sh`.** Idempotent — skips Docker install and the `tunnel-gateway` network if already present (which they will be, courtesy of gunvest). Clones the repo to `/opt/horizon/app`, drops a placeholder `.env.production`, and brings the stack up. Nothing in this script is required for ongoing deploys — CI handles those.
6. **No database service in production.** We keep SQLite (ADR-0001) bind-mounted at `/opt/horizon/app/data`. The postgres-shaped pieces of gunvest's deploy (pg_isready wait, seed step, daily `pg_dump` cron) are intentionally left out and commented in the bootstrap script as a placeholder for future expansion.

## Consequences

- **One push to `master` = one deploy.** No manual ssh, no env-file edits on the box.
- **Secrets stay in GitHub.** No `.env.production` in git, no copy of it on a developer laptop. Rotating a key is a single edit in repo Settings → Secrets, then a re-deploy.
- **Routing is configured in Cloudflare's UI, not in the repo.** Adding a second hostname or moving the app is dashboard work, not a code change — same trade-off gunvest already accepted.
- **Bootstrap is dirt-cheap to redo.** Wiping the VM and re-running `oracle-vm-setup.sh` rebuilds horizon from scratch in minutes; CI then keeps it current.
- **Shared blast radius with gunvest.** The two apps share Docker, the tunnel, and the host. A misconfigured tunnel route or a runaway container can disturb both. Acceptable at hobby scale; revisit if either app outgrows it.
- **No staging environment.** Same trade-off as gunvest — accepted for a portfolio project; `verify` + the docker-build sanity job catch the common breakage.

## Alternatives considered

- **Docker registry + `docker pull` on the VM instead of `git pull` + rebuild on the VM.** Cleaner, but adds a registry, image tagging, and auth. Rejected for now; reuse gunvest's build-on-VM flow.
- **A second `cloudflared` container dedicated to horizon.** Rejected — the whole point of the gunvest tunnel pattern is "one tunnel, many apps."
- **Hand-edited `.env.production` on the VM (gunvest's original style).** Rejected for horizon — every drift between repo and box has cost us time elsewhere; making CI overwrite the file removes that whole class of bug.
- **Postgres now, "for symmetry with gunvest."** Rejected — ADR-0001 already justified SQLite for the bot's tiny write volume. Adding postgres for symmetry is the exact kind of premature complexity the project rules forbid.

## References

- Pattern reused from the `gunvest` repo: `.github/workflows/ci.yml`, `docker/docker-compose.prod.yml`, `docs/SSL.md` (Cloudflare Tunnel setup), `scripts/oracle-vm-setup.sh`.
- This repo: `docker-compose.prod.yml`, `.github/workflows/ci.yml`, `scripts/oracle-vm-setup.sh`, `.env.production.example`.
