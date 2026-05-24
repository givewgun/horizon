/**
 * Tiny in-memory TTL cache + single-flight dedup for upstream proxies.
 *
 * Each entry remembers when it was fetched. `get` returns cached data while
 * fresh; otherwise it awaits `loader()`. Concurrent misses for the same key
 * share one in-flight promise so we never hammer an upstream when many
 * clients arrive at once. The previous-good payload is kept after expiry and
 * served via `lastGood()` when a fresh fetch fails.
 */

interface Entry<T> {
  data: T;
  fetchedAt: number;
}

export class TtlCache<T> {
  private store = new Map<string, Entry<T>>();
  private inflight = new Map<string, Promise<T>>();

  constructor(private readonly ttlMs: number) {}

  has(key: string): boolean {
    const e = this.store.get(key);
    return !!e && Date.now() - e.fetchedAt < this.ttlMs;
  }

  peek(key: string): { data: T; ageMs: number } | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    return { data: e.data, ageMs: Date.now() - e.fetchedAt };
  }

  lastGood(key: string): { data: T; ageMs: number } | undefined {
    return this.peek(key);
  }

  set(key: string, data: T): void {
    this.store.set(key, { data, fetchedAt: Date.now() });
  }

  async get(key: string, loader: () => Promise<T>): Promise<{ data: T; ageMs: number }> {
    const fresh = this.peek(key);
    if (fresh && fresh.ageMs < this.ttlMs) return fresh;

    const pending = this.inflight.get(key);
    if (pending) {
      const data = await pending;
      return { data, ageMs: 0 };
    }
    const p = loader()
      .then((data) => {
        this.set(key, data);
        return data;
      })
      .finally(() => {
        this.inflight.delete(key);
      });
    this.inflight.set(key, p);
    const data = await p;
    return { data, ageMs: 0 };
  }
}
