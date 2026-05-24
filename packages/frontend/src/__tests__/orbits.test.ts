import { describe, expect, it } from 'vitest';
import { propagateAt, tleToSatrec, metersBetween } from '../lib/orbits.js';
import type { TLE } from '@horizon/shared';

// Real-ish ISS TLE captured for a known epoch. Propagating it at the same
// epoch should land on (or very close to) the sub-satellite point implied by
// the elements themselves — we check the result is sane rather than chasing
// arcsecond-level accuracy.
const ISS_TLE: TLE = {
  catnr: 25544,
  name: 'ISS (ZARYA)',
  line1: '1 25544U 98067A   24001.50000000  .00010000  00000-0  18000-3 0  9990',
  line2: '2 25544  51.6400 100.0000 0001000  90.0000 270.0000 15.50000000000000',
  fetchedAt: new Date().toISOString(),
};

describe('orbits.propagateAt', () => {
  it('returns a lat/lon/alt for a valid TLE at its epoch', () => {
    const rec = tleToSatrec(ISS_TLE);
    // 2024-01-01 12:00 UTC ≈ the TLE epoch above.
    const pos = propagateAt(rec, new Date(Date.UTC(2024, 0, 1, 12, 0, 0)));
    expect(pos).not.toBeNull();
    if (!pos) return;
    expect(pos.lat).toBeGreaterThan(-52);
    expect(pos.lat).toBeLessThan(52);
    expect(pos.lon).toBeGreaterThan(-180);
    expect(pos.lon).toBeLessThan(180);
    // ISS altitude ~400 km; SGP4 should land within a wide sanity window.
    expect(pos.altKm).toBeGreaterThan(300);
    expect(pos.altKm).toBeLessThan(500);
  });

  it('produces continuous motion across a short time step', () => {
    const rec = tleToSatrec(ISS_TLE);
    const t0 = new Date(Date.UTC(2024, 0, 1, 12, 0, 0));
    const t1 = new Date(t0.getTime() + 5_000);
    const a = propagateAt(rec, t0);
    const b = propagateAt(rec, t1);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    if (!a || !b) return;
    // ISS moves ~7.66 km/s ⇒ ~38 km in 5s. Allow generous bound.
    const d = metersBetween(a, b) / 1000;
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(80);
  });
});

describe('orbits.metersBetween', () => {
  it('returns ~111km for 1 degree of latitude at the equator', () => {
    const m = metersBetween({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(m).toBeGreaterThan(110_000);
    expect(m).toBeLessThan(112_000);
  });
});
