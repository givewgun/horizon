import { describe, expect, it } from 'vitest';
import { countdown, formatCountdown, formatUtcAndBangkok } from '../lib/time.js';

describe('formatUtcAndBangkok', () => {
  it('renders the same instant in UTC and Asia/Bangkok (+07:00, no DST)', () => {
    // 2024-06-01T12:00:00Z -> Bangkok 19:00 same day
    const t = formatUtcAndBangkok('2024-06-01T12:00:00Z');
    expect(t.utc).toMatch(/12:00 UTC$/);
    expect(t.bangkok).toMatch(/19:00 ICT$/);
    expect(t.iso).toBe('2024-06-01T12:00:00.000Z');
  });

  it('handles a date that rolls over to the next day in Bangkok', () => {
    // 2024-06-01T18:00:00Z -> Bangkok 01:00 on 2024-06-02
    const t = formatUtcAndBangkok('2024-06-01T18:00:00Z');
    expect(t.utc).toMatch(/01 Jun 2024.* 18:00 UTC$/);
    expect(t.bangkok).toMatch(/02 Jun 2024.* 01:00 ICT$/);
  });

  it('returns em-dashes for invalid input rather than throwing', () => {
    const t = formatUtcAndBangkok('not a date');
    expect(t.utc).toBe('—');
    expect(t.bangkok).toBe('—');
    expect(t.iso).toBe('');
  });
});

describe('countdown', () => {
  it('counts down when target is in the future', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const c = countdown('2024-06-01T13:30:25Z', now);
    expect(c.past).toBe(false);
    expect(c.hours).toBe(1);
    expect(c.minutes).toBe(30);
    expect(c.seconds).toBe(25);
    expect(formatCountdown(c)).toBe('T-01:30:25');
  });

  it('switches to T+ when the target is in the past', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const c = countdown('2024-06-01T11:59:50Z', now);
    expect(c.past).toBe(true);
    expect(formatCountdown(c).startsWith('T+')).toBe(true);
  });

  it('shows days for far-future targets', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const c = countdown('2024-06-04T12:00:00Z', now);
    expect(c.days).toBe(3);
    expect(formatCountdown(c)).toMatch(/^T-3d /);
  });
});
