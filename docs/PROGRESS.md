# Progress log

Append-only. One line per substantive change.

- 2026-05-23 | Phase 0 | Monorepo scaffold (pnpm workspace, strict TS, ESLint, Prettier, .gitignore/.dockerignore).
- 2026-05-23 | Phase 0 | @horizon/shared shipped with initial domain types (Launch, TLE, SatellitePosition, Forecast, Webcam, SpaceWeather, ApiResult, ResolvedLocation, FeedStatus).
- 2026-05-23 | Phase 0 | @horizon/backend: Fastify boot, zod env config, stub routes for every /api/* endpoint, AlertStore skeleton with better-sqlite3 → node:sqlite → in-memory fallback, /api/health.
- 2026-05-23 | Phase 0 | @horizon/frontend: app shell, persistent SPACE/EARTH switcher (Zustand + localStorage), non-blocking LocationContext with Bangkok fallback + manual city search, StatusBadge / GlobalClock / FeedFallback / Skeleton / ErrorBoundary, placeholder SPACE + EARTH panels.
- 2026-05-23 | Phase 0 | Dockerfile (multi-stage, ARM64-aware), docker-compose (loopback-bound for Cloudflare Tunnel at horizon.givewgun.com), .env.example, GitHub Actions CI (typecheck + lint + test).
- 2026-05-23 | Phase 0 | Tests: lib/time (UTC+Bangkok + countdown), StatusBadge, backend config, backend AlertStore.
- 2026-05-23 | Phase 0 | Docs: ARCHITECTURE, HANDOVER, PROGRESS, ADR-0001 (stack & hosting), README, CLAUDE.md rewritten for this project.
- 2026-05-24 | Phase 1 | Backend: TtlCache (single-flight + last-good), fetchUpstream wrapper, LL2Client + normalizer, SwpcClient (Kp + 3-day forecast + aurora rule), CelestrakClient (TLE passthrough).
- 2026-05-24 | Phase 1 | Backend: registerSpaceRoutes wires real /api/launches, /api/tle, /api/spaceweather. Stubs trimmed to remaining Phase 2 routes + geocode + health.
- 2026-05-24 | Phase 1 | Shared: Constellation + ConstellationStar types.
- 2026-05-24 | Phase 1 | Frontend deps: satellite.js, cesium, vite-plugin-cesium. vite.config wires the Cesium plugin.
- 2026-05-24 | Phase 1 | Frontend lib: orbits.ts (SGP4 wrapper, look-angles, ground tracks, naive pass scan), skymath.ts (GMST, equatorial→alt-az, stereographic).
- 2026-05-24 | Phase 1 | Frontend panels: LaunchTracker (filter chips, live countdowns, conditional webcast drawer), SpaceWeatherPanel (Kp gauge + 3-day strip + aurora readout), NightSky (canvas alt-az + tooltip + scrubber), SatelliteGlobe + lazy SatelliteGlobeInner (Cesium, ISS+Hubble live, NORAD add, JWST L2 marker, pass list), IssHdEarth (NASA HDEV embed + fallback toggle).
- 2026-05-24 | Phase 1 | Static catalog: public/static/constellations.json (12 IAU constellations, ~70 stars, line segments).
- 2026-05-24 | Phase 1 | Tests: backend cache.test, ll2.test (normalizer); frontend orbits.test (TLE→position sanity + great-circle), skymath.test, LaunchTracker.test (loaded + error states).
- 2026-05-24 | Phase 1 | ADRs: 0002 (cesium + vite-plugin), 0003 (canvas night sky vs d3-celestial), 0004 (cache + last-good failure policy). HANDOVER overwritten, ARCHITECTURE updated, README refreshed.
- 2026-05-24 | Phase 1 rev | Globe rework: visible Earth via OpenStreetMap imagery (no Ion token), preset satellite groups (stations / observatories / weather / earth-obs / navigation, 17 sats total), click-to-pin location, group toggles + NORAD-id add/remove. globeStore (Zustand) shared with other panels. Layout: globe is now full-width hero.
- 2026-05-24 | Phase 1 rev | NightSky planetarium pass: radial twilight gradient background, faint Milky Way ribbon (galactic-equator sample, rotated to equatorial), 900-star seeded ambient field, glow halos on mag<1.8 stars, follows globe pin when set. Round canvas mask.
- 2026-05-24 | Phase 1 rev | SpaceWeather expanded: solar wind (speed + density), IMF Bz with aurora-favourability colour, GOES X-ray flare class (A/B/C/M/X). swpc.ts hardened: multi-URL probe for Kp (products + json variants), header-driven column lookup, per-feed graceful degradation. Shared types extended with SolarWindSnapshot + XrayFluxSnapshot.
- 2026-05-24 | Phase 1 rev | NASA live: dropped HDEV-only embed (frequently dark), switched to the NASA YouTube channel's auto-current live stream (UCLA_DiR1FfKNvjuUpBHmylQ).
- 2026-05-24 | Phase 1 rev2 | Live panel reworked from single channel to tabbed multi-source registry: Space Videos 24/7 Earth (default), NASA, NSF, SpaceX, ESA, Everyday Astronaut, Spaceflight Now. Each tab embeds live_stream?channel=... + open-on-YouTube fallback link. Source registry is one-line-add.
- 2026-05-24 | Phase 1 rev3 | Live panel now resolves the real current videoId per channel server-side: new YouTubeLiveClient scrapes /channel/<CID>/live (canonical / og:url / inline JSON) with 60s TTL cache, surfaced via /api/live/youtube/:channelId. Frontend embeds /embed/<videoId> instead of the unreliable live_stream?channel selector, and shows a "not live right now" card with channel link when the lookup returns null.
- 2026-05-24 | Deploy | Oracle VM + Cloudflare Tunnel deployment shape mirrored from gunvest: docker-compose.prod.yml (joins external tunnel-gateway network, container_name horizon-app, no host port, sqlite bind mount), .env.production.example, scripts/oracle-vm-setup.sh (idempotent bootstrap, sqlite-only — postgres pieces commented out for future). CI extended: docker build sanity job + deploy job that SSHes via appleboy/ssh-action, regenerates .env.production from GitHub Secrets each push, then docker compose up -d --build. Branch refs corrected main → master. ADR-0006 records the decision.
- 2026-05-24 | Phase 2 | Open-Meteo proxy + LocalForecast panel (current + 24h hourly + 7d daily, WMO code icons).
- 2026-05-24 | Phase 2 | Nominatim proxy + real `/api/geocode` and `/api/geocode/reverse` (24h cache, ≥1 req/s throttle).
- 2026-05-24 | Phase 2 | WeatherMap panel: MapLibre GL JS map + RainViewer animated radar + OWM layer toggles (clouds/precip/wind/temp) + click-anywhere current weather popup.
- 2026-05-24 | Phase 2 | SatelliteImagery panel: RAMMB SLIDER iframe + sector selector + product toggle + playback controls.
- 2026-05-24 | Phase 2 | CityWebcams panel: Windy webcam grid (thumbnail + title, fallback to featured cities).
- 2026-05-24 | Phase 2 | apiGetWithStatus helper added to lib/api.ts for status badge propagation from ApiResult envelope.
- 2026-05-24 | Phase 2 | OpenWeatherMapClient tile proxy (feature-flagged on OPENWEATHER_KEY, `/api/weather/owm-tile/:layer/:z/:x/:y.png`).
- 2026-05-24 | Phase 2 | Frontend: added maplibre-gl dep. Backend: added OpenWeatherMapClient, NominatimClient, enhanced OpenMeteoClient normalizer.
- 2026-05-24 | Phase 2 rev2 | Critical bugfixes: apiGet/apiGetWithStatus paths corrected (`/api/...` was double-prefixing). Open-Meteo wind speed normalizer no longer wrongly converts km/h to mph. MapLibre CSS imported. WeatherMap container ref fixed (no chicken-and-egg). RainViewer source now fetches `weather-maps.json` metadata then builds proper tile URLs with animation slider + play/pause.
- 2026-05-24 | Phase 2 rev2 | RAMMB iframe replaced with backend `/api/imagery/:sector/:product/latest.jpg` proxy + ImageryClient that fetches verified-working NESDIS CDN URLs (GOES-16/GOES-18 FD GEOCOLOR/13/09 at 1808x1808) and BoM Australia for Himawari. Frontend uses an `<img>` tag with sector/product toggles and auto-refresh.
- 2026-05-24 | Phase 2 rev2 | WindyClient + curated YouTube live cam fallback. `/api/webcams` returns Windy if WINDY_KEY present, else a curated 24/7 city list sorted by distance from the requested point. Frontend grid renders thumbnails + labels with hover effects.
