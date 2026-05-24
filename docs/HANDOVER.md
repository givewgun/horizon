# HANDOVER — you are here

> Overwritten at every phase boundary. Read this first if you're picking up the project cold.

## Status: Phase 1 (SPACE mode) complete. Phase 2 (EARTH mode) next.

> **Rev:** Globe was reworked to be the hero (full-width, visible Earth, 17 preset satellites across 5 togglable groups, click-to-pin location). NightSky now reads the globe pin and renders with twilight gradient + Milky Way ribbon + 900 ambient stars. SpaceWeather expanded to include solar wind + Bz + GOES X-ray, with multi-URL probing so SWPC outages no longer black out the panel. NASA live switched from HDEV to the NASA YouTube channel auto-live.

## How to run (right now)

```bash
pnpm install
cp .env.example .env             # all keys optional for Phase 1 — only LL2/CelesTrak/SWPC are hit
pnpm --filter @horizon/shared build   # build shared types before frontend/backend can typecheck
pnpm dev:backend                 # terminal 1 — Fastify on :8080
pnpm dev:frontend                # terminal 2 — Vite on :5173 (proxies /api -> :8080)

# OR full container:
docker compose up --build        # http://localhost:8080
```

Verification (Phase 1 acceptance):

- `pnpm -r typecheck && pnpm -r test && pnpm -r lint` is clean.
- Visit `/`, switch to SPACE mode. You see five panels:
  1. **Launch tracker** — vertical list with provider filter chips and live countdowns. Clicking a row opens a right-side detail drawer. The webcast iframe only embeds when the launch reports `webcastLive === true` AND a YouTube webcast URL is present; otherwise the drawer shows a countdown + "Open launch page" link.
  2. **Satellite globe (CesiumJS)** — full-width hero. Visible Earth imagery (OSM tiles, no Ion token needed). Day/night terminator on. Sidebar offers togglable preset groups (stations, observatories, weather, Earth obs, navigation — 17 sats total), an "add by NORAD id" box, and the next visible ISS passes for your home location. **Click anywhere on Earth to pin a location** — the Night Sky panel re-centres on that pin.
  3. **Night sky** — planetarium-style alt-az render centred on the globe pin (or your home location if no pin). Radial twilight gradient, faint Milky Way ribbon, ~900 ambient stars + the constellation catalog with glow halos on the brightest stars. Hover any star for constellation name, mythology, brightest star, season. The slider advances the clock up to +12h.
  4. **Space weather** — Kp gauge + 3-day forecast strip + solar-wind speed/density + IMF Bz (with aurora-favourability colour) + GOES X-ray flare class (A/B/C/M/X) + aurora-likelihood readout for your latitude. Each sub-feed degrades independently; only Kp is load-bearing.
  5. **Live · multi-source** — tab row across 7 channels: Earth-from-ISS 24/7 (Space Videos, default), NASA, NSF, SpaceX, ESA, Everyday Astronaut, Spaceflight Now. Each tab queries `/api/live/youtube/:channelId`; the backend's `YouTubeLiveClient` scrapes that channel's `/live` page server-side for the current live videoId (canonical link → og:url → inline JSON, 60s TTL cache). Frontend embeds `/embed/<videoId>` directly — far more reliable than YouTube's `live_stream?channel=...` selector, which silently breaks when the live broadcast has embedding disabled. When the lookup returns `videoId: null` the tab renders a "not live right now" card instead of a broken iframe.
- All five panels render a correct status badge (`LIVE` / `~REALTIME` / `SNAPSHOT`).
- Disabling network on any upstream → panel demotes to `SNAPSHOT · stale` (if anything was cached) or shows `FeedFallback` with a retry button.
- `curl http://localhost:8080/api/launches/upcoming` returns a real LL2 payload, normalized.
- `curl http://localhost:8080/api/spaceweather` returns a current Kp reading from NOAA SWPC.
- `curl http://localhost:8080/api/tle/25544` returns the parsed ISS TLE from CelesTrak.

## What works (added in Phase 1)

- Backend: `LL2Client`, `SwpcClient`, `CelestrakClient` (`packages/backend/src/proxy/*.ts`) with a shared `TtlCache` (single-flight dedup + last-good fallback) and a typed `fetchUpstream` (timeout + structured `UpstreamError`).
- Backend: `registerSpaceRoutes` wires `/api/launches/upcoming`, `/api/launches/:id`, `/api/tle/:catnr`, `/api/spaceweather` to those clients. Stub registration in `routes/stubs.ts` now only covers Phase 2 routes + geocode + `/api/health`.
- Frontend: `lib/orbits.ts` wraps satellite.js (SGP4 propagation, look-angles, ground tracks, pass predictions). `lib/skymath.ts` adds GMST + equatorial→alt-az + stereographic projection helpers.
- Frontend: five SPACE-mode panels (above). `SatelliteGlobeInner` is React.lazy-split so Cesium loads only when SPACE mode renders.
- Static catalog: `packages/frontend/public/static/constellations.json` — 12 IAU constellations, ~70 stars, line segments. See ADR-0003 for the deviation from d3-celestial.
- Shared: `Constellation` + `ConstellationStar` types in `@horizon/shared`.

## What is stubbed

- `/api/forecast`, `/api/webcams`, `/api/geocode`, `/api/geocode/reverse` — Phase 2.
- Telegram bot scheduler — Phase 3.
- EARTH-mode panels remain placeholders.

## Phase 2 plan (your next concrete steps)

In order:

1. **Open-Meteo proxy** — `packages/backend/src/proxy/openmeteo.ts` (no key, 10 min cache). Build `LocalForecast` card on the EARTH grid: current conditions + 24h hourly strip + 7-day strip.
2. **Nominatim proxy** — real `/api/geocode` and `/api/geocode/reverse` (24h cache, ≥1 req/s throttle, descriptive User-Agent from `cfg.NOMINATIM_USER_AGENT`). Replace the stubs that the existing `LocationContext` already calls.
3. **MapLibre weather map** — `WeatherMap` panel. Default base layer + RainViewer animated radar (`api.rainviewer.com/public/weather-maps.json`, fetched client-side, no key). Then OWM layer toggles (clouds/precip/wind/temp) using `/api/weather/owm-tile/:layer/:z/:x/:y.png` proxy that hides the key. Click-anywhere popup with `current_weather` from Open-Meteo for that point. Play/pause/scrub controls.
4. **Satellite imagery** — RAMMB SLIDER. Sector selector (default Himawari/Asia for Bangkok user). Animate last ~12 frames. Product toggle GeoColor/IR/water-vapor. Likely fetched directly from RAMMB if CORS allows; otherwise add `/api/imagery/*` proxy.
5. **City webcams** — Windy `/api/webcams` (real, header `x-windy-api-key`). Near-me grid driven by `LocationContext` + featured-cities list. Map pins on the weather map that open the cam on click. Fallback to a curated YouTube list when the Windy key is missing or quota is hit.

Tests to add in Phase 2:

- `proxy/openmeteo.test.ts` — fixture → normalizer for `Forecast`.
- `proxy/nominatim.test.ts` — ranking, throttling.
- Component tests for `LocalForecast` and `WeatherMap` loading / loaded / failed.

## Known issues / gotchas

- `pnpm install` is required after pulling — Phase 1 added new deps to `@horizon/frontend` (`satellite.js`, `cesium`, `vite-plugin-cesium`). They are not yet in your `node_modules`.
- Cesium needs a CORS-friendly origin for its workers and assets; `vite-plugin-cesium` handles this in dev and in the Vite build. If you ever stop using the plugin, you must wire `CESIUM_BASE_URL` and copy the workers yourself.
- We deliberately leave `Ion.defaultAccessToken = ''`. Default imagery still works without a Cesium Ion token; setting one is a paid-tier decision (would need a new ADR).
- LL2 dev base (`lldev.thespacedevs.com`) is the default in `config.ts`. Move to `ll.thespacedevs.com/2.3.0` for prod by setting `LL2_BASE` in `.env`. The dev base is rate-limited but doesn't need a key.
- NOAA SWPC's Kp forecast JSON occasionally returns 502s during model rollover; the route now falls back to the last-good cached `SpaceWeather` and demotes the badge to `SNAPSHOT` — verify by curling during the brief window after `swpc.noaa.gov` posts a new daily product.
- ISS HD Earth periodically shows a blue/standby card. We can't detect that from inside the YouTube iframe (cross-origin), so we expose a manual "show fallback" toggle. Don't try to scrape the iframe.
- The Night-Sky catalog only covers 12 constellations by design (ADR-0003). Adding more is a JSON edit — no code change.

## Useful local commands

```bash
# Run only backend tests (faster than the workspace -r)
pnpm --filter @horizon/backend test

# Smoke the real LL2 client without booting the frontend
pnpm --filter @horizon/backend exec tsx -e "import {LL2Client} from './src/proxy/ll2.ts'; new LL2Client('https://lldev.thespacedevs.com/2.3.0').upcoming(5).then(r => console.log(JSON.stringify(r,null,2)))"

# Tail the container
docker compose logs -f horizon

# Reset only the SQLite volume (no other state)
docker compose down && rm -f data/horizon.sqlite && docker compose up -d
```
