/**
 * Satellite globe panel. Cesium is lazy-loaded — the inner subtree
 * (`./SatelliteGlobeInner`) only chunks in when SPACE mode mounts. The globe
 * is also the SPACE-mode "hero", so the wrapper takes the full width and a
 * tall min-height; the inner layout splits into globe + controls sidebar.
 */

import { lazy, Suspense } from 'react';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Skeleton } from '../../components/common/Skeleton.js';

const Inner = lazy(() =>
  import('./SatelliteGlobeInner.js').then((m) => ({ default: m.SatelliteGlobeInner })),
);

export function SatelliteGlobe(): JSX.Element {
  return (
    <section className="rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">
          Satellite globe · live SGP4 · click Earth to pin
        </h2>
        <StatusBadge status="REALTIME" />
      </header>
      <Suspense fallback={<Skeleton rows={8} />}>
        <Inner />
      </Suspense>
    </section>
  );
}
