/**
 * Minimal astronomical helpers for the NightSky panel.
 *
 * We convert (RA, Dec) → (azimuth, altitude) for an observer at (lat, lon, t).
 * Formulae from Meeus, "Astronomical Algorithms" §12 — accurate to well within
 * the eye's resolution, which is all we need for a hover-tooltip star map.
 */

const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);

function julianDay(d: Date): number {
  return d.getTime() / 86_400_000 + 2440587.5;
}

/** Greenwich Mean Sidereal Time in hours [0, 24). */
export function gmstHours(d: Date): number {
  const jd = julianDay(d);
  const t = (jd - 2451545.0) / 36525;
  let gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * t * t -
    (t * t * t) / 38710000;
  gmst = ((gmst % 360) + 360) % 360;
  return gmst / 15;
}

export interface AltAz {
  /** Degrees above horizon, -90..90. */
  altDeg: number;
  /** Degrees clockwise from north, 0..360. */
  azDeg: number;
}

export function equatorialToHorizontal(
  raHours: number,
  decDeg: number,
  latDeg: number,
  lonDeg: number,
  when: Date,
): AltAz {
  const lstHours = (gmstHours(when) + lonDeg / 15 + 24) % 24;
  const haDeg = (lstHours - raHours) * 15;
  const ha = (haDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const lat = (latDeg * Math.PI) / 180;
  const sinAlt =
    Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const cosAz =
    (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) /
    (Math.cos(alt) * Math.cos(lat));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(ha) > 0) az = 2 * Math.PI - az;
  return { altDeg: (alt * 180) / Math.PI, azDeg: (az * 180) / Math.PI };
}

/** Stereographic projection from alt/az to a unit disk centred on the zenith. */
export interface Xy {
  x: number;
  y: number;
}

export function altAzToStereographic(a: AltAz): Xy | null {
  if (a.altDeg < 0) return null;
  const zenithAngle = (90 - a.altDeg) * (Math.PI / 180);
  const r = Math.tan(zenithAngle / 2);
  const az = (a.azDeg * Math.PI) / 180;
  // North up; +x = east.
  return { x: r * Math.sin(az), y: -r * Math.cos(az) };
}

void J2000;
