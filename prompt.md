Build a web app called "Orbit & Atmosphere" — a live space + weather dashboard with two
selectable modes (SPACE and EARTH). This is a portfolio + learning + daily-use project, so
quality of code, docs, and resilience all matter.

================================================================================
WORKING MODE  (read this first — it governs how you operate)
================================================================================
- Semi-autonomous. Build through the phases below WITHOUT stopping for approval on routine
  decisions. STOP only at the four PHASE BOUNDARIES (end of Setup, Space, Earth, Polish).
- Decide freely on implementation details. Only pause to ASK me when a decision involves
  (a) money/paid services, or (b) a material architecture change from what's specified here.
  When you make a notable judgment call, record it as an ADR (see below) rather than asking.
- CONTEXT WILL RUN OUT MID-BUILD. Assume a different session continues your work. Therefore
  documentation is a first-class deliverable, not an afterthought. At EVERY phase boundary you
  MUST update:
    docs/ARCHITECTURE.md      — current system design, data flow, component map
    docs/adr/NNNN-title.md    — one ADR per significant decision (format below)
    docs/HANDOVER.md          — OVERWRITE each phase: what's done, what works, what's stubbed,
                                what's next, how to run it, known issues, where you left off
    docs/PROGRESS.md          — append-only log: date, phase, what changed
    README.md                 — keep runnable: setup, env, run, deploy steps current
  Write these so a cold session with zero memory can resume in 5 minutes.
- ADR format: Title, Status (accepted/superseded), Context, Decision, Consequences, Alternatives considered.

================================================================================
HARD REQUIREMENTS  (non-negotiable, apply everywhere, re-read each phase)
================================================================================
- STRICT TYPESCRIPT: "strict": true, no `any` (use `unknown` + narrowing), full types on all
  functions, API responses, and props. Shared types live in packages/shared and are imported
  by both frontend and backend — never duplicated.
- TESTS + CI FROM THE START: set up Vitest + CI (GitHub Actions) in Phase 0. Every phase adds
  tests for its logic. Minimum: unit tests for orbit math, bot alert-timing logic, time-zone
  formatting, and API-response normalizers; component tests for critical UI states
  (loading / loaded / failed). CI must run typecheck + lint + tests on push.
- SECRETS: never in the frontend bundle or git. All keys server-side, reached via /api/*.
- GRACEFUL DEGRADATION: every external feed can fail or rate-limit. Each panel renders a clean
  "temporarily unavailable" state (FeedFallback component) — NEVER a broken embed/iframe/blank.
  Cache last-good data where sensible and show staleness.
- TIME: show all launch/event times in BOTH UTC and Asia/Bangkok, unambiguously.
- MOBILE: both modes must be usable on a phone, including touch gestures on the globe and map.
- STATUS BADGE on every data panel: LIVE (green) / ~REALTIME (blue: computed or short-interval)
  / SNAPSHOT (grey: latest released). The user must always know what they're looking at.
- HONEST LABELING (see reality-check table) — do not build feeds that can only ever be empty.

================================================================================
REALITY CHECKS  (critical — prevents building dead features)
================================================================================
| User imagined            | Reality                                  | Build instead                               |
| Hubble/JWST live camera   | Observatories, not webcams. Scheduled    | Track POSITION as a marker + latest-released |
|                           | long-exposure images released later.     | image gallery labeled SNAPSHOT.              |
| JWST position             | It's at L2 (~1.5M km), not a LEO orbit.   | Near-fixed marker. DO NOT SGP4-propagate it. |
| ISS exterior live cam     | NASA HD Earth YouTube live exists but     | Embed it; detect standby; show fallback card.|
|                           | periodically cuts to blue/standby.        |                                              |
| City CCTV for weather     | No unified public CCTV API.               | Windy public webcam network. Call them       |
|                           |                                          | "live webcams," not CCTV.                    |
| Real-time storm imagery   | Exists, excellent. Geostationary sats     | Animated imagery layer (last N frames) so    |
|                           | (Himawari/GOES/Meteosat) ~10 min refresh. | typhoons/storms visibly move.                |
| "Live" launch video       | Per-launch; only goes live near T-0.      | Auto-embed when webcast_live; else countdown.|
Every panel resolves to exactly one of: LIVE, ~REALTIME (computed/short-interval), SNAPSHOT.

================================================================================
HOSTING / DEPLOYMENT TARGET  (fixed)
================================================================================
Single Oracle Cloud VM (Ampere A1, ARM64, Docker) behind an EXISTING Cloudflare Tunnel + custom
domain (I already run a tunnel for another project; I'll add an ingress rule). Deploy as ONE
Docker Compose stack. No public ports, no serverless.
ONE Node backend process serves the built frontend AND /api/* AND runs the Telegram bot on an
internal scheduler — one image, one container. Frontend calls backend SAME-ORIGIN under /api/*
so there is NO CORS and all keys stay server-side.
ARM GOTCHA: any native module (better-sqlite3) MUST compile for arm64 inside the Dockerfile —
do not assume x86 prebuilt binaries. If troublesome, use Node's built-in node:sqlite.
Provide a Cloudflare Tunnel ingress snippet mapping orbit.<mydomain> -> http://localhost:8080.

================================================================================
STACK  (fixed — do not substitute without an ADR + asking me)
================================================================================
Frontend: React + Vite + TypeScript + TailwindCSS; TanStack Query (data/caching); Zustand (UI state).
Globe:    CesiumJS — USE the official Cesium Vite plugin (vite-plugin-cesium) so assets/workers
          load correctly; do not hand-wire static copies. This is the heaviest dependency; budget for it.
Sky map:  d3-celestial.
Map:      MapLibre GL JS.
Orbits:   satellite.js (SGP4) + CelesTrak TLEs.
Backend:  one Node/TS service — Fastify (static + /api/*) and grammY (Telegram bot).
Store:    SQLite (better-sqlite3 compiled arm64, or node:sqlite) for alert dedup.
Monorepo with packages/shared for TS types. Use pnpm workspaces.

================================================================================
MONOREPO STRUCTURE
================================================================================
orbit-atmosphere/
  docker-compose.yml
  .github/workflows/ci.yml
  README.md
  .env.example
  docs/{ARCHITECTURE.md, HANDOVER.md, PROGRESS.md, adr/}
  packages/
    shared/src/types.ts        # Launch, SatellitePosition, Webcam, ForecastPoint, etc.
    frontend/
      src/app/                 # shell, SPACE/EARTH mode switcher, routing
      src/context/LocationContext.tsx
      src/components/common/    # StatusBadge, GlobalClock, FeedFallback, Skeleton, ErrorBoundary
      src/modes/space/{LaunchTracker,SatelliteGlobe,NightSky,SpaceWeather}/
      src/modes/earth/{WeatherMap,SatelliteImagery,CityWebcams,LocalForecast}/
      src/lib/api.ts           # typed fetch -> /api/*, caching, backoff
      src/lib/orbits.ts        # satellite.js helpers
      src/lib/time.ts          # UTC + Asia/Bangkok formatting (tested)
    backend/
      src/server.ts            # Fastify: serve built frontend + mount /api/*
      src/proxy/{ll2,owm,windy,imagery,nominatim}.ts   # key-hiding + caching
      src/bot/{index,scheduler,formatters}.ts          # grammY
      src/store/db.ts          # SQLite: sent_alerts(launch_id, lead, sent_at)
      src/config.ts            # zod-validate env on boot; fail fast if missing
      Dockerfile

================================================================================
BACKEND API CONTRACT  (same-origin /api/, with cache TTLs; central fetch layer w/ backoff)
================================================================================
GET /api/launches/upcoming     -> LL2 upcoming, normalized to shared type   (cache 60s)
GET /api/launches/:id          -> LL2 detail incl. best webcast url           (cache 30s)
GET /api/tle/:catnr            -> CelesTrak TLE passthrough                    (cache 3h)
GET /api/spaceweather          -> NOAA SWPC Kp + aurora                        (cache 5m)
GET /api/weather/owm-tile/...  -> OpenWeatherMap tile proxy (hide key)
GET /api/webcams?lat&lon       -> Windy webcams (hide key)                     (cache 10m)
GET /api/forecast?lat&lon      -> Open-Meteo passthrough                       (cache 10m)
GET /api/geocode?q | /api/geocode/reverse?lat&lon -> Nominatim (descriptive User-Agent, cache 24h, throttle ~1 req/s)
RainViewer + RAMMB SLIDER imagery: fetch client-side directly where CORS allows; only route via
/api/imagery/* if blocked. Respect upstream rate limits; honor LL2 throttle headers.

================================================================================
VERIFIED UPSTREAM ENDPOINTS  (use exactly these)
================================================================================
- Launches (prod):  https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=20&mode=detailed
  (dev during build: https://lldev.thespacedevs.com/2.3.0/...  — lower limits, no key)
  Key fields: vidURLs[] (webcasts), webcast_live (bool), net (time), net_precision
  ("Hour"/"Day"...), weather_concerns, launch_service_provider.name, rocket.configuration,
  mission (name/description/orbit), pad.latitude/longitude, status.
- TLEs:  https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle
  (ISS=25544, Hubble=20580; groups: ?GROUP=stations|weather|starlink&FORMAT=tle)
- Space weather:  https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json (+ aurora products)
- Radar (animated, no key):  https://api.rainviewer.com/public/weather-maps.json
  -> animate radar.past[] + radar.nowcast[] tile paths.
- Weather tiles (key):  https://tile.openweathermap.org/map/{layer}/{z}/{x}/{y}.png?appid=KEY
  layers: clouds_new, precipitation_new, wind_new, temp_new, pressure_new
- Webcams (key, header x-windy-api-key):  https://api.windy.com/webcams/api/v3/webcams?nearby={lat},{lon},{radius}
- Geostationary imagery: RAMMB SLIDER https://rammb-slider.cira.colostate.edu/  —
  DEFAULT Himawari, Asia / Southeast-Asia sector (user is in Bangkok).
- Local forecast (no key): https://api.open-meteo.com/v1/forecast?latitude=&longitude=&current=temperature_2m,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto
- Reverse geocode: https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=&lon=

================================================================================
SHARED UX  (both modes)
================================================================================
- Persistent left-rail mode switcher SPACE/EARTH; persist last mode in localStorage; default SPACE.
- LocationContext: browser Geolocation -> reverse geocode (Nominatim); manual city-search override;
  NEVER block the app waiting on geolocation permission (resolve to a sensible default, let user fix).
  Location feeds: night sky, ISS passes, local weather, "near me" webcams.
- Global clock: UTC + Asia/Bangkok.
- Dark "mission control" aesthetic; monospace for telemetry/times; color-coded status badges.
- Accessibility: keyboard nav on controls, alt text, prefers-reduced-motion option (globe/particles heavy).

================================================================================
FEATURE DETAIL  (what each panel shows / does / fails like)
================================================================================
SPACE MODE
  Launch tracker:
    - Vertical list: provider logo, rocket, mission, pad/location, live countdown to net,
      status (Go/TBD/Hold), weather-concern flag. Provider filter chips
      (SpaceX/NASA/Rocket Lab/AST/ESA/JAXA/ISRO/Roscosmos/all).
    - Detail drawer: mission description, payload, orbit, pad map (lat/long), and CONDITIONAL:
      webcast embed when webcast_live===true, else countdown + "stream starts ~15 min before T-0".
    - Loading: skeleton rows. Fail: FeedFallback with retry.
  Satellite globe (CesiumJS) — hero feature:
    - Pull TLEs from CelesTrak; propagate CLIENT-SIDE with satellite.js at 1–4 Hz (do NOT poll a
      remote position API per frame). Refresh TLEs every few hours.
    - ISS (25544): moving marker + ground track + footprint circle. Hubble (20580): marker.
      User-addable satellites by NORAD ID. JWST: near-fixed L2 marker w/ note (no SGP4).
    - Overlays: day/night terminator; toggleable ground tracks/footprints; optional Starlink swarm.
    - ISS pass predictions for user location ("Next visible pass: tonight 20:42, max el 61°, SW->NE")
      computed locally from TLE + observer; N2YO /visualpasses/ only as a sparing fallback.
    - Side card: NASA ISS HD Earth YouTube live embed w/ standby detection -> fallback.
  Night sky (d3-celestial):
    - Centered on user location + current time (alt-az). Pan/zoom/drag.
    - Constellation lines ON by default. Hover/tap TOOLTIPS: name, short mythology, brightest
      star, best viewing season (ship a static JSON of these — no live API).
    - Toggles: constellation art, planet labels, Milky Way, grid, ISS/visible-sat overlay.
    - "Now vs later tonight" time scrubber.
  Space weather (NOAA SWPC):
    - Current Kp gauge, 3-day geomagnetic forecast, aurora-visibility likelihood for user latitude,
      solar-wind quick stats.

EARTH MODE
  Weather map (MapLibre):
    - Layer toggles: RainViewer radar (animated, default, no key), then OWM clouds/precip/wind/
      temp/pressure. Animation playback (play/pause/scrub/speed), opacity slider.
    - Click anywhere -> popup with current conditions for that point.
  Satellite imagery (RAMMB SLIDER):
    - Sector selector (default Himawari/Asia for Bangkok; GOES Americas; Meteosat EU-Africa).
    - Product toggle GeoColor/IR/water-vapor. Frame animation (last ~12–24 frames) so storms move.
  City webcams (Windy):
    - "Near me" (location context) + featured-cities grid (Bangkok, Tokyo, NYC, London, ...).
      Thumbnail -> expand to live stream/player. Pins on the weather map; click pin -> open cam.
    - Fallback if Windy quota/key issue: curated public YouTube live city cams.
  Local forecast (Open-Meteo, no key):
    - Current conditions card (temp, feels-like, wind, humidity, precip chance, sunrise/sunset)
      + next-24h hourly strip + 7-day.

================================================================================
TELEGRAM BOT  (grammY) — "notify + auto-link to live stream"
================================================================================
Lead times: T-24h, T-1h, T-10m, liftoff. Scheduler runs every 5 min.
  fetch LL2 upcoming next ~72h
  for each launch L, each lead in [24h,1h,10m,0]:
    if now within window of (L.net - lead) AND not sent(L.id, lead)
       AND L.net_precision firm enough for that lead
         (DO NOT fire 10m/liftoff alerts when precision is only "Day"):
      link = (lead in [10m,0] AND L.vidURLs nonempty) ? best(L.vidURLs) : launchPageUrl(L)
      send(message); mark sent(L.id, lead)
  if L.net slips later, allow re-sending the crossed lead.
CRITICAL: vidURLs is usually EMPTY until ~15–30 min before T-0. Early alerts (24h,1h) link to the
launch page; only late alerts (10m, liftoff) carry the real stream link, and only once populated.
NEVER send an empty link.
Message: provider + rocket + mission, status, net in UTC AND Asia/Bangkok, pad/location, link.
Dedup via SQLite sent_alerts. Provider scope same first-class list as the filters.
Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, OPENWEATHER_KEY, WINDY_KEY, optional N2YO_KEY.
Unit-test the alert-timing + link-selection logic thoroughly (it's the trickiest logic in the app).

================================================================================
PHASES + ACCEPTANCE CRITERIA  (stop & write docs at each boundary)
================================================================================
PHASE 0 — SETUP  [BOUNDARY: stop, write all docs]
  pnpm monorepo; strict TS; Tailwind; Vitest; GitHub Actions CI (typecheck+lint+test);
  Dockerfile (arm64, compiles native deps, builds frontend, served by Fastify); docker-compose;
  Cloudflare ingress snippet; .env.example; zod env validation; LocationContext; StatusBadge,
  GlobalClock, FeedFallback, Skeleton, ErrorBoundary; SPACE/EARTH shell; stubbed /api/* routes.
  ACCEPTANCE: `docker compose up` serves the shell; CI green; mode switch + location resolution
  work with stubs; docs/ scaffolded + HANDOVER written.

PHASE 1 — SPACE MODE  [BOUNDARY: stop, update all docs + ADRs]
  Launch tracker (+ /api/launches/*), satellite globe (ISS->Hubble->NORAD->passes->ISS video),
  night sky, space weather. Tests for orbit math + time formatting.
  ACCEPTANCE: launches list w/ live countdowns + working detail drawer/webcast; ISS marker
  position matches n2yo.com within ~1–2° at same timestamp, ground track + terminator render;
  night sky centered on location with constellation lines + working tooltips + pan/zoom;
  space weather shows live Kp. All panels have loading + fail states + correct status badges.

PHASE 2 — EARTH MODE  [BOUNDARY: stop, update all docs + ADRs]
  Weather map (RainViewer->OWM->Windy), satellite imagery (Himawari/Asia default), city webcams,
  local forecast.
  ACCEPTANCE: radar animates over a pannable map; layer toggles + click-popup work; imagery
  sector animates and storms visibly move; webcams load near-me + featured; forecast card live.
  Status badges + fallbacks correct everywhere.

PHASE 3 — BOT + POLISH + HANDOVER  [BOUNDARY: stop, finalize all docs]
  Telegram bot end-to-end with dedup + tested timing logic; graceful-failure pass on every feed;
  mobile/touch for globe + map; reduced-motion; dark theme finalization; globe performance pass
  (test heavy Cesium on mobile); README with screenshots; final ARCHITECTURE + HANDOVER.
  ACCEPTANCE: bot fires correct alerts at each lead with correct link selection (verify with a
  near-term real launch or a time-mocked test); app usable on a phone; CI green; a cold session
  could deploy and extend from docs alone.

Begin with Phase 0. Decide implementation details yourself; only ask me on cost or architecture.
At each phase boundary, stop and write the documentation before continuing.