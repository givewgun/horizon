# ADR-0004 — Cache + last-good fallback policy for upstream proxies

- **Status:** Accepted
- **Date:** 2026-05-24 (Phase 1 boundary)

## Context

Every Phase 1 / Phase 2 panel is fed by a third-party API: LL2, CelesTrak,
NOAA SWPC, Open-Meteo, OpenWeatherMap, Windy, Nominatim. They all rate-limit,
go down, change schemas, or simply time out. The hard requirements in
`CLAUDE.md` insist on (a) honest status badges, (b) clean `FeedFallback` on
failure, (c) no broken iframes / blank panels.

We needed one consistent way to handle:

1. Cache freshness windows per upstream (LL2 60s, TLE 3h, SWPC 5m, …).
2. Thundering-herd protection when many clients miss the cache at once.
3. Behaviour when the upstream is currently failing but we have a stale-but-
   recent payload from before.

## Decision

- `packages/backend/src/proxy/cache.ts` ships a tiny `TtlCache<T>` with:
  - per-key TTL,
  - single-flight `inflight` map so concurrent misses share one fetch,
  - `lastGood(key)` that returns the cached entry even after expiry, with
    an `ageMs`.
- `packages/backend/src/proxy/http.ts` provides `fetchUpstream(url, opts)`
  with a timeout (default 8s), JSON-or-text parsing, and a typed
  `UpstreamError`.
- Each route in `routes/space.ts` follows the same three-step pattern:
  1. Try the live client; on success, respond `ok(data, 'REALTIME' | 'LIVE')`
     with `ageMs` if any.
  2. On upstream failure, call `client.lastGood(...)`; if present, respond
     `ok(data, 'SNAPSHOT', ageMs)` — the badge demotes itself.
  3. If there is no cached payload at all, return HTTP 502 with the shared
     `ApiErr` envelope so the SPA renders `FeedFallback`.

## Consequences

- The badge promise stays truthful end-to-end: when an upstream is degraded,
  the user sees `SNAPSHOT · stale` automatically.
- The backend never holds more than one in-flight request per cache key,
  even under burst load.
- The system degrades to "last-known-good" before degrading to "broken",
  which is exactly what we want for a portfolio app that may run with stale
  free-tier creds.

## Alternatives considered

- **Per-route ad-hoc caching.** Faster to write, impossible to reason about
  collectively, and inevitably misses one of the failure modes above.
- **Stale-while-revalidate with no error path.** Looks clean on the happy
  path; lies to the user on the sad path because the badge never demotes.
