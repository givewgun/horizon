# ADR-0002 — CesiumJS + vite-plugin-cesium for the satellite globe

- **Status:** Accepted
- **Date:** 2026-05-24 (Phase 1 boundary)

## Context

The SPACE-mode hero panel is a 3D globe that plots live satellite positions
(ISS, Hubble, user-added NORAD ids) with ground tracks and a day/night
terminator. The build plan in `prompt.md` names CesiumJS for this and asks us
to use `vite-plugin-cesium` so the Cesium static assets and web workers load
correctly under Vite.

Cesium is also the single heaviest dependency in the project (~3 MB minified
JS plus worker bundles), so its placement in the bundle matters.

## Decision

- Add `cesium@^1.119` and `vite-plugin-cesium@^1.2` to `@horizon/frontend`.
- Register the plugin in `vite.config.ts` (`plugins: [react(), cesium()]`);
  the plugin handles workers, web-asm assets, and the `CESIUM_BASE_URL`.
- Import the widget CSS once, inside the lazy chunk
  (`import 'cesium/Build/Cesium/Widgets/widgets.css'`).
- The Cesium-using subtree (`SatelliteGlobeInner.tsx`) is loaded via
  `React.lazy()` from `SatelliteGlobe.tsx` so it is split out of the initial
  bundle and only fetched when SPACE mode is mounted.
- Leave `Ion.defaultAccessToken = ''`. Cesium Ion is **paid** and gives the
  globe no imagery on the free tier — we'd just see a black sphere. Instead
  we feed `Viewer` with `baseLayer: new ImageryLayer(new
  OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' }))`.
  OSM tiles are free, attribution-credited inside the widget, and load
  without a key. Switching to a paid Ion token (Bing imagery / 3D Tiles) is
  a future ADR (cost decision per the working-mode rules in `prompt.md`).

## Consequences

- Initial SPA bundle stays small; the globe chunk loads on demand.
- Cesium widgets ship a non-trivial CSS reset; we scope it to the inner
  subtree so it can't bleed into the rest of the UI.
- No additional CDN dependency at runtime — assets are served from the same
  Fastify origin via the Vite plugin's copy step.

## Alternatives considered

- **deck.gl / GlobeView.** Lighter, but ground-track and lighting features
  would need to be hand-written. Cesium is the spec; we follow it.
- **Hand-wiring Cesium static copies.** Possible, fragile, breaks on
  upgrade. The plugin exists for exactly this and is officially
  recommended.
