import { lazy, Suspense } from 'react';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Skeleton } from '../../components/common/Skeleton.js';

const Inner = lazy(() =>
  import('./SatelliteImageryInner.js').then((m) => ({ default: m.SatelliteImageryInner })),
);

export function SatelliteImagery(): JSX.Element {
  return (
    <section className="rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">
          Satellite globe
        </h2>
        <StatusBadge status="REALTIME" />
      </header>
      <Suspense fallback={<Skeleton rows={6} />}>
        <Inner />
      </Suspense>
    </section>
  );
}
