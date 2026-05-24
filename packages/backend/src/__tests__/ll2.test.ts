import { describe, expect, it } from 'vitest';
import { normalizeLaunch } from '../proxy/ll2.js';

describe('normalizeLaunch', () => {
  it('projects an LL2 detailed launch to the shared shape', () => {
    const out = normalizeLaunch({
      id: 'abc-123',
      name: 'Falcon 9 | Starlink',
      net: '2026-06-01T12:00:00Z',
      net_precision: { name: 'Hour' },
      status: { abbrev: 'Go', name: 'Go for Launch' },
      launch_service_provider: { name: 'SpaceX', type: { name: 'Commercial' } },
      rocket: { configuration: { full_name: 'Falcon 9 Block 5', name: 'Falcon 9' } },
      mission: {
        name: 'Starlink Group X',
        description: 'Communications',
        orbit: { name: 'LEO' },
        type: 'Communications',
      },
      pad: {
        name: 'SLC-40',
        location: { name: 'Cape Canaveral', country_code: 'USA' },
        latitude: '28.5618',
        longitude: '-80.5772',
      },
      webcast_live: false,
      vidURLs: [],
      url: 'https://thespacedevs.com/launch/abc-123',
    });
    expect(out.id).toBe('abc-123');
    expect(out.provider).toEqual({ name: 'SpaceX', type: 'Commercial' });
    expect(out.rocket.name).toBe('Falcon 9 Block 5');
    expect(out.mission?.orbit).toBe('LEO');
    expect(out.pad.latitude).toBeCloseTo(28.5618);
    expect(out.netPrecision).toBe('Hour');
  });

  it('handles missing vidURLs and defaults precision conservatively', () => {
    const out = normalizeLaunch({
      id: 'x',
      name: 'Test',
      net: '2026-06-01T12:00:00Z',
      net_precision: 'Day',
      status: { abbrev: 'TBD', name: 'TBD' },
      pad: {},
    });
    expect(out.webcasts).toEqual([]);
    expect(out.webcastLive).toBe(false);
    expect(out.netPrecision).toBe('Day');
  });

  it('sorts webcasts by priority (low number = first)', () => {
    const out = normalizeLaunch({
      id: 'x',
      name: 'Test',
      net: '2026-06-01T12:00:00Z',
      net_precision: 'Hour',
      pad: {},
      webcast_live: true,
      vidURLs: [
        { url: 'https://youtube.com/watch?v=BBB', priority: 5, type: { name: 'YouTube' } },
        { url: 'https://youtube.com/watch?v=AAA', priority: 1, type: 'YouTube' },
      ],
    });
    expect(out.webcasts[0]!.url).toContain('AAA');
    expect(out.webcastLive).toBe(true);
  });

  it('defaults missing precision to "Hour"', () => {
    const out = normalizeLaunch({
      id: 'x',
      name: 'Test',
      net: '2026-06-01T12:00:00Z',
      pad: {},
    });
    expect(out.netPrecision).toBe('Hour');
  });
});
