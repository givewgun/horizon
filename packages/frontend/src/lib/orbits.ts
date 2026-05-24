/**
 * Thin satellite.js wrapper: SGP4 propagation + observer look-angles + pass
 * predictions. Everything runs client-side from a TLE; the backend only
 * caches the TLE text, never positions.
 *
 * Coordinate conventions:
 *   - Latitudes in DEGREES, -90..90 (north positive)
 *   - Longitudes in DEGREES, -180..180 (east positive)
 *   - Altitudes in KILOMETRES
 *   - Times are JavaScript Date objects in UTC
 */

import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  eciToEcf,
  ecfToLookAngles,
  degreesLat,
  degreesLong,
  type SatRec,
} from 'satellite.js';
import type { GeoPoint, SatellitePass, SatellitePosition, TLE } from '@horizon/shared';

export interface ObserverGd {
  latitudeDeg: number;
  longitudeDeg: number;
  heightKm: number;
}

export function tleToSatrec(tle: TLE): SatRec {
  return twoline2satrec(tle.line1, tle.line2);
}

export function propagateAt(satrec: SatRec, at: Date): SatellitePosition | null {
  const result = propagate(satrec, at);
  if (!result || typeof result.position === 'boolean' || !result.position) return null;
  const gmst = gstime(at);
  const geo = eciToGeodetic(result.position, gmst);
  const lat = degreesLat(geo.latitude);
  const lon = degreesLong(geo.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, altKm: geo.height, at: at.toISOString() };
}

export interface LookAngle {
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
}

export function lookAnglesFrom(
  satrec: SatRec,
  observer: ObserverGd,
  at: Date,
): LookAngle | null {
  const prop = propagate(satrec, at);
  if (!prop || typeof prop.position === 'boolean' || !prop.position) return null;
  const gmst = gstime(at);
  const ecf = eciToEcf(prop.position, gmst);
  const obs = {
    latitude: (observer.latitudeDeg * Math.PI) / 180,
    longitude: (observer.longitudeDeg * Math.PI) / 180,
    height: observer.heightKm,
  };
  const look = ecfToLookAngles(obs, ecf);
  return {
    azimuthDeg: (look.azimuth * 180) / Math.PI,
    elevationDeg: (look.elevation * 180) / Math.PI,
    rangeKm: look.rangeSat,
  };
}

export interface GroundTrackOpts {
  /** How many minutes ahead/behind to sample. Default ±45 (~half an ISS orbit). */
  spanMinutes?: number;
  /** Seconds between samples. Default 30. */
  stepSeconds?: number;
}

export function groundTrack(
  satrec: SatRec,
  centerAt: Date,
  opts: GroundTrackOpts = {},
): SatellitePosition[] {
  const span = (opts.spanMinutes ?? 45) * 60_000;
  const step = (opts.stepSeconds ?? 30) * 1000;
  const out: SatellitePosition[] = [];
  for (let dt = -span; dt <= span; dt += step) {
    const p = propagateAt(satrec, new Date(centerAt.getTime() + dt));
    if (p) out.push(p);
  }
  return out;
}

export interface PassOpts {
  /** Search horizon (ms). Default 48h. */
  horizonMs?: number;
  /** Sample step (ms). Default 30s. */
  stepMs?: number;
  /** Minimum peak elevation (deg) to count as visible. Default 10. */
  minPeakElevationDeg?: number;
}

/**
 * Naive visible-pass scan: step the propagator at `stepMs`, mark contiguous
 * windows where elevation > 0, keep those with peak elevation >=
 * `minPeakElevationDeg`. Cheap enough for a handful of satellites; for many
 * birds we'd push this into a worker.
 */
export function nextPasses(
  satrec: SatRec,
  observer: ObserverGd,
  now: Date,
  opts: PassOpts = {},
): SatellitePass[] {
  const horizon = opts.horizonMs ?? 48 * 3600_000;
  const step = opts.stepMs ?? 30_000;
  const minPeak = opts.minPeakElevationDeg ?? 10;
  const passes: SatellitePass[] = [];
  let inPass = false;
  let start: Date | null = null;
  let startAz = 0;
  let peakEl = 0;
  let last: { date: Date; look: LookAngle } | null = null;

  for (let t = 0; t <= horizon; t += step) {
    const at = new Date(now.getTime() + t);
    const look = lookAnglesFrom(satrec, observer, at);
    if (!look) continue;
    if (look.elevationDeg > 0) {
      if (!inPass) {
        inPass = true;
        start = at;
        startAz = look.azimuthDeg;
        peakEl = look.elevationDeg;
      } else {
        peakEl = Math.max(peakEl, look.elevationDeg);
      }
    } else if (inPass && start) {
      if (peakEl >= minPeak && last) {
        passes.push({
          start: start.toISOString(),
          end: last.date.toISOString(),
          maxElevationDeg: peakEl,
          startAzimuthDeg: startAz,
          endAzimuthDeg: last.look.azimuthDeg,
        });
      }
      inPass = false;
      start = null;
      peakEl = 0;
    }
    last = { date: at, look };
  }
  return passes;
}

export function metersBetween(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(sa)));
}
