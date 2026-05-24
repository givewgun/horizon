# ADR-0003 — Replace d3-celestial with an in-house canvas star map

- **Status:** Accepted
- **Date:** 2026-05-24 (Phase 1 boundary)

## Context

`prompt.md` names d3-celestial for the night-sky panel: constellation lines,
hover tooltips, alt-az projection, planet labels, time scrubber. d3-celestial
is the canonical library for browser-based celestial maps.

Building it into our Vite + TypeScript + ESM stack turned out to be painful:

- d3-celestial pins **d3 v3** and expects it as a global script tag. Our Vite
  build is ESM with no script-tag globals; making d3 v3 ambient in 2026 means
  shimming a window global and silencing the `d3` import resolution.
- The library has no `@types`; we'd be writing our own ambient declaration
  for every option we touch.
- The full payload (catalogs + library + d3 v3) is several hundred KB and
  duplicates utilities we already pull from satellite.js / our own time
  helpers.

Our actual product need is narrow: 12 prominent constellations, hover for
mythology + brightest star, a "later tonight" time scrubber. We don't need
all-sky milky-way rendering, planet ephemerides, or DSO catalogs at this
phase.

## Decision

- Ship a static `packages/frontend/public/static/constellations.json` with a
  curated catalog (12 IAU constellations, ~70 named stars, line-segment
  pairs). Format is described by `Constellation` and `ConstellationStar` in
  `@horizon/shared`.
- Add `packages/frontend/src/lib/skymath.ts` (GMST, equatorial → alt-az,
  stereographic projection). Pure functions, ~80 LoC, unit tested.
- Render via `<canvas>` in `modes/space/NightSky.tsx`: alt-az stereographic
  projection centred on zenith, mouse-move tooltip with mythology, plus a
  +0…+12h time scrubber.
- No new runtime dependency.

## Consequences

- We deviate from the named stack — this ADR documents the decision so a
  cold session understands the trade.
- Catalog is curated, not exhaustive — sufficient for the panel's promise
  ("constellation lines on by default; hover tooltips with name + mythology
  + brightest star + season"). Extending it is a JSON edit.
- We do not show planets, the Milky Way, or the ecliptic in Phase 1. If
  Phase 3 polish demands those, we revisit (either grow our catalog or
  reintroduce d3-celestial as a one-off lazy chunk and accept the d3 v3
  shim).

## Alternatives considered

- **d3-celestial via npm + d3 v3 shim.** Works, but every Vite upgrade is a
  risk and the panel ends up loading a much heavier chunk than the rest of
  SPACE mode.
- **astronomy-engine.** Excellent positions, but it's a calc library, not a
  renderer; we'd still write the canvas code we wrote here.
