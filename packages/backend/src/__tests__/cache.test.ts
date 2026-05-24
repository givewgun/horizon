import { describe, expect, it, vi } from 'vitest';
import { TtlCache } from '../proxy/cache.js';

describe('TtlCache', () => {
  it('caches within ttl and refetches after expiry', async () => {
    const cache = new TtlCache<number>(50);
    let calls = 0;
    const loader = (): Promise<number> => {
      calls += 1;
      return Promise.resolve(calls);
    };
    const a = await cache.get('k', loader);
    const b = await cache.get('k', loader);
    expect(a.data).toBe(1);
    expect(b.data).toBe(1);
    expect(calls).toBe(1);
    await new Promise((r) => setTimeout(r, 60));
    const c = await cache.get('k', loader);
    expect(c.data).toBe(2);
    expect(calls).toBe(2);
  });

  it('dedups concurrent in-flight requests', async () => {
    const cache = new TtlCache<number>(1000);
    let calls = 0;
    const loader = async (): Promise<number> => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return 42;
    };
    const [a, b, c] = await Promise.all([
      cache.get('k', loader),
      cache.get('k', loader),
      cache.get('k', loader),
    ]);
    expect(a.data).toBe(42);
    expect(b.data).toBe(42);
    expect(c.data).toBe(42);
    expect(calls).toBe(1);
  });

  it('lastGood returns expired entry with positive ageMs', async () => {
    const cache = new TtlCache<number>(10);
    await cache.get('k', () => Promise.resolve(7));
    await new Promise((r) => setTimeout(r, 20));
    const lg = cache.lastGood('k');
    expect(lg?.data).toBe(7);
    expect(lg?.ageMs).toBeGreaterThanOrEqual(10);
  });

  it('exposes a fresh-or-not check via has()', async () => {
    const cache = new TtlCache<string>(50);
    expect(cache.has('k')).toBe(false);
    await cache.get('k', () => Promise.resolve('v'));
    expect(cache.has('k')).toBe(true);
  });

  it('peek returns undefined for unknown keys', () => {
    expect(new TtlCache<number>(50).peek('nope')).toBeUndefined();
  });

  it('vi import is wired (smoke)', () => {
    expect(vi).toBeDefined();
  });
});
