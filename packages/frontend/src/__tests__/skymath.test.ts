import { describe, expect, it } from 'vitest';
import { altAzToStereographic, equatorialToHorizontal, gmstHours } from '../lib/skymath.js';

describe('gmstHours', () => {
  it('is in [0, 24)', () => {
    const g = gmstHours(new Date(Date.UTC(2026, 4, 24, 12, 0, 0)));
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThan(24);
  });
});

describe('equatorialToHorizontal', () => {
  it('returns altitude in [-90, 90] and azimuth in [0, 360]', () => {
    const r = equatorialToHorizontal(5.919, 7.407, 13.7563, 100.5018, new Date());
    expect(r.altDeg).toBeGreaterThanOrEqual(-90);
    expect(r.altDeg).toBeLessThanOrEqual(90);
    expect(r.azDeg).toBeGreaterThanOrEqual(0);
    expect(r.azDeg).toBeLessThanOrEqual(360);
  });

  it('puts the celestial pole near the horizon at the equator', () => {
    // RA arbitrary; Dec = +90 → altitude should ≈ observer latitude.
    const r = equatorialToHorizontal(0, 90, 0, 0, new Date());
    expect(Math.abs(r.altDeg)).toBeLessThan(1);
  });
});

describe('altAzToStereographic', () => {
  it('drops below-horizon points', () => {
    expect(altAzToStereographic({ altDeg: -1, azDeg: 0 })).toBeNull();
  });

  it('puts the zenith at the origin', () => {
    const p = altAzToStereographic({ altDeg: 90, azDeg: 0 });
    expect(p).not.toBeNull();
    if (!p) return;
    expect(Math.hypot(p.x, p.y)).toBeLessThan(1e-6);
  });
});
