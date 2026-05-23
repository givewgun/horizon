import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { ResolvedLocation } from '@horizon/shared';
import { apiGet, ApiError } from '../lib/api.js';

const DEFAULT: ResolvedLocation = {
  lat: 13.7563,
  lon: 100.5018,
  label: 'Bangkok, Thailand (default)',
  source: 'default',
};

interface LocationCtx {
  location: ResolvedLocation;
  setManualCity: (query: string) => Promise<void>;
  requestBrowserLocation: () => void;
  /** True while a manual search or reverse geocode is in flight. */
  loading: boolean;
  /** Last error from a manual lookup; null if none. */
  error: string | null;
}

const Ctx = createContext<LocationCtx | null>(null);

export function LocationProvider({ children }: PropsWithChildren): JSX.Element {
  const [location, setLocation] = useState<ResolvedLocation>(DEFAULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fire-and-forget geolocation on mount. NEVER blocks render.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lon: longitude, source: 'browser' });
        apiGet<ResolvedLocation>(`/geocode/reverse?lat=${latitude}&lon=${longitude}`)
          .then((loc) => setLocation({ ...loc, source: 'browser' }))
          .catch(() => {
            /* keep coordinate-only location on reverse-geocode failure */
          });
      },
      () => {
        /* permission denied / unavailable — keep default */
      },
      { timeout: 5000, maximumAge: 600_000 },
    );
  }, []);

  const setManualCity = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const loc = await apiGet<ResolvedLocation>(`/geocode?q=${encodeURIComponent(query)}`);
      setLocation({ ...loc, source: 'manual' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'lookup failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const requestBrowserLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          source: 'browser',
        }),
      (e) => setError(e.message),
    );
  }, []);

  const value = useMemo<LocationCtx>(
    () => ({ location, setManualCity, requestBrowserLocation, loading, error }),
    [location, setManualCity, requestBrowserLocation, loading, error],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocation(): LocationCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLocation must be used within LocationProvider');
  return v;
}
