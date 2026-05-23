import type { ApiResult } from '@horizon/shared';

const BASE = '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('/') ? `${BASE}${path}` : `${BASE}/${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    ...init,
  });
  if (!res.ok) {
    throw new ApiError(`GET ${url} failed: ${res.status} ${res.statusText}`, res.status);
  }
  const body = (await res.json()) as ApiResult<T>;
  if (!body.ok) throw new ApiError(body.error || 'api error');
  return body.data;
}
