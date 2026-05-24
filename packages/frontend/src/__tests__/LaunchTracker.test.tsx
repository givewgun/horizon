import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Launch } from '@horizon/shared';
import { LaunchTracker } from '../modes/space/LaunchTracker.js';
import { LocationProvider } from '../context/LocationContext.js';

const sampleLaunch: Launch = {
  id: 'l1',
  name: 'Falcon 9 | Test',
  net: new Date(Date.now() + 3600_000).toISOString(),
  netPrecision: 'Hour',
  status: { abbrev: 'Go', name: 'Go' },
  provider: { name: 'SpaceX' },
  rocket: { name: 'Falcon 9' },
  pad: { name: 'SLC-40' },
  webcastLive: false,
  webcasts: [],
};

function withProviders(ui: React.ReactNode): JSX.Element {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <LocationProvider>{ui}</LocationProvider>
    </QueryClientProvider>
  );
}

const origFetch = globalThis.fetch;

describe('LaunchTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = origFetch;
  });

  it('renders loaded launches', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, data: [sampleLaunch], status: 'REALTIME' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof fetch;

    render(withProviders(<LaunchTracker />));
    await waitFor(() => {
      expect(screen.getByText(/Falcon 9 \| Test/)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/SpaceX/).length).toBeGreaterThan(0);
  });

  it('renders feed fallback on API error', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, error: 'down' }), { status: 502 }),
    ) as typeof fetch;

    render(withProviders(<LaunchTracker />));
    await waitFor(() => {
      expect(screen.getByText(/launches/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });
});
