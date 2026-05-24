# HANDOVER — you are here

> Overwritten at every phase boundary. Read this first if you're picking up the project cold.

## Status: Phase 2 (EARTH mode) complete. Phase 3 (Telegram bot + polish) next.

> **Rev:** EARTH mode built with five panels: LocalForecast (Open-Meteo current + 24h + 7d), WeatherMap (MapLibre + RainViewer + OWM toggles), SatelliteImagery (RAMMB SLIDER + sector + product), CityWebcams (Windy grid + featured cities). Nominatim proxy replaces stubs for real geocoding (24h cache, throttled). OWM tile proxy added for weather layer overlays. maplibre-gl added to frontend.

## How to run (right now)

```bash
pnpm install
cp .env.example .env             # open keys optional for Phase 2 — only LL2/Nominatim/SWPC are key-free
pnpm --filter @horizon/shared build   # build shared types before frontend/backend can typecheck
pnpm dev:backend                 # terminal 1 — Fastify on :8080
pnpm dev:frontend                # terminal 2 — Vite on :5173 (proxies /api -> :8080)

# OR full container:
docker compose up --build        # http://localhost:8080
```

Verification (Phase 2 acceptance):

- `pnpm -r typecheck && pnpm -r test && pnpm -r lint` is clean.
- Visit `/`, switch to EARTH mode. You see four panels:
  1. **Weather map** — MapLibre GL with RainViewer radar base layer, OWM layer toggles (clouds/precip/wind/temp), click-anywhere popup shows current conditions from Open-Meteo. Open-Meteo status badge reflects feed health.
  2. **Satellite imagery** — RAMMB SLIDER iframe, sector selector (Himawari/Asia default), product toggles (GeoColor/IR/Water Vapor), playback controls show frame counter.
  3. **City webcams** — Grid of webcam thumbnails (from Windy or fallback list). Each thumbnail is clickable → player URL or YouTube fallback. Location-aware via Nominatim reverse geocode.
  4. **Local forecast** — Current conditions (temp, wind, WMO code icon) + 24h hourly strip (temp, precip %) + 7-day daily (max/min temps, weather code, icon). All times shown in UTC + Bangkok. Open-Meteo status badge.
- All panels render correct status badges (`LIVE` / `REALTIME` / `SNAPSHOT`).
- Disabling network on Open-Meteo/Nominatim → panels degrade gracefully (cache fallback or `FeedFallback`).
- `curl http://localhost:8080/api/forecast?lat=13.7563&lon=100.5018` returns a normalized Forecast payload.
- `curl http://localhost:8080/api/geocode?q=tokyo` returns a ResolvedLocation (Bangkok default if offline).
- `curl http://localhost:8080/api/geocode/reverse?lat=35.6762&lon=139.6503` reverse-geocodes a lat/lon.
- `curl http://localhost:8080/api/weather/owm-tile/clouds/5/10/10.png` returns a PNG tile (503 if OPENWEATHER_KEY is missing).

## What works (added in Phase 2)

- Backend: `OpenMeteoClient`, `NominatimClient`, `OpenWeatherMapClient` proxies in `packages/backend/src/proxy/*.ts`.
- Backend: `/api/forecast`, `/api/geocode`, `/api/geocode/reverse`, `/api/weather/owm-tile/:layer/:z/:x/:y.png` routes wired in `routes/stubs.ts`.
- Backend: OWM tile proxy is feature-flagged on `OPENWEATHER_KEY`; missing key → clean 503 + fallback.
- Frontend: `LocalForecast`, `WeatherMap`, `SatelliteImagery`, `CityWebcams` panels in `modes/earth/*.tsx`.
- Frontend: `apiGetWithStatus<T>()` helper returns full `ApiResult<T>` envelope (for status badge propagation).
- Frontend: MapLibre GL JS lazily imported in `WeatherMap` (click-anywhere popup + layer toggles).
- Frontend deps: added `maplibre-gl@^4.5.0`.
- Shared: `CurrentWeather`, `HourlyForecastPoint`, `DailyForecastPoint`, `Forecast` types already existed; used as-is.

## What is stubbed

- Telegram bot scheduler (Phase 3).
- Webcam map pins on the weather map (deferred to Phase 3 polish).
- ISS pass animation sync with clock slider (deferred to Phase 3 polish).

## Phase 3 plan (your next concrete steps)

In order:

1. **Telegram bot scheduler** — Phase 2 endpoints return live data; Phase 3 wires the grammY scheduler + `leadWindow` / `selectLink` pure logic + tests. Runs every 5 min, fetches LL2 upcoming, dispatches deduplicated alerts at T-24h / T-1h / T-10m / liftoff.
2. **Polish & mobile perf** — Cesium reduced-motion toggle, lower detail on mobile. ISS pass predictions bisect for entry/exit times (replaces naive 30s scan). Webcam map pins on WeatherMap.

Tests to add in Phase 3:

- `bot/scheduler.test.ts` — leadWindow logic + selectLink link preference (YT webcast if live, else launch page).
- `bot/alerts.test.ts` — dedup logic, state transitions.

## Known issues / gotchas

- `pnpm install` is required after pulling — Phase 2 added `maplibre-gl` to `@horizon/frontend`.
- RainViewer radar layer is added via a non-standard source (direct fetch of JSON). This works in dev but may need CORS verification in prod (it doesn't).
- OWM tiles require the OPENWEATHER_KEY. If missing, the button is disabled and `/api/weather/owm-tile/*` returns 503. This is intentional.
- Nominatim has a ≥1 req/s throttle enforced in the client. Burst requests will be delayed transparently.
- The weather map does NOT display OWM tiles by default (the toggle is off) — click a layer button to enable it.
- SatelliteImagery uses an iframe to RAMMB SLIDER. The SLIDER is a third-party tool; frame controls are cosmetic (next/prev/play).
- Webcam thumbnails are from Windy API; if the key is missing, the grid shows the fallback list (no live data).

## Deployment (Oracle VM via Cloudflare Tunnel)

Unchanged from Phase 1. See ADR-0006.

- Production compose: `docker-compose.prod.yml` (no host port, joins external `tunnel-gateway` network, container_name `horizon-app`).
- Cloudflare Zero Trust Public Hostname: `horizon.givewgun.com → http://horizon-app:8080`.
- CI deploys on push to `master`: `verify → docker build → ssh deploy`. The deploy job regenerates `.env.production` on the VM from GitHub Secrets every run.
- Bootstrap a fresh VM with `scripts/oracle-vm-setup.sh <GITHUB_TOKEN>`. Idempotent — skips Docker + `tunnel-gateway` if already provisioned.
- Required GitHub Secrets (Phase 2 additions): `OPENWEATHER_KEY` (optional, feature-flags OWM tiles), `WINDY_KEY` (optional, enables live webcams).

## Useful local commands

```bash
# Run only backend tests
pnpm --filter @horizon/backend test

# Smoke test Open-Meteo
pnpm --filter @horizon/backend exec tsx -e "import {OpenMeteoClient} from './src/proxy/openmeteo.ts'; new OpenMeteoClient().forecast(13.7563, 100.5018).then(r => console.log(JSON.stringify(r,null,2)))"

# Smoke test Nominatim
pnpm --filter @horizon/backend exec tsx -e "import {NominatimClient} from './src/proxy/nominatim.ts'; new NominatimClient('test').forward('Tokyo').then(r => console.log(JSON.stringify(r,null,2)))"

# Tail the container
docker compose logs -f horizon

# Reset only the SQLite volume
docker compose down && rm -f data/horizon.sqlite && docker compose up -d
```
