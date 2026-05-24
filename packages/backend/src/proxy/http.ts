/**
 * Thin fetch wrapper: timeout, JSON parse, descriptive errors.
 * Node 22 has global fetch; no extra dep.
 */

export interface FetchOpts {
  headers?: Record<string, string>;
  timeoutMs?: number;
  accept?: 'json' | 'text';
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly upstream?: string,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

export async function fetchUpstream(
  url: string,
  opts: FetchOpts = {},
): Promise<unknown> {
  const timeout = opts.timeoutMs ?? 8000;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...(opts.headers ?? {}) },
      signal: ac.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new UpstreamError(
        `upstream ${res.status} ${res.statusText}: ${body.slice(0, 200)}`,
        res.status,
        url,
      );
    }
    if (opts.accept === 'text') return await res.text();
    return await res.json();
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new UpstreamError(`upstream timeout after ${timeout}ms`, undefined, url);
    }
    throw new UpstreamError(
      err instanceof Error ? err.message : 'unknown upstream error',
      undefined,
      url,
    );
  } finally {
    clearTimeout(t);
  }
}
