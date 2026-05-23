import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Skeleton } from '../../components/common/Skeleton.js';

interface PanelProps {
  title: string;
  status: 'LIVE' | 'REALTIME' | 'SNAPSHOT';
  note: string;
}

function PlaceholderPanel({ title, status, note }: PanelProps): JSX.Element {
  return (
    <section className="rounded-lg border border-mission-edge bg-mission-panel/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate-200">{title}</h2>
        <StatusBadge status={status} />
      </header>
      <Skeleton rows={3} />
      <p className="mt-3 text-xs text-slate-500">{note}</p>
    </section>
  );
}

export function SpaceMode(): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <PlaceholderPanel
        title="Launch tracker"
        status="REALTIME"
        note="Phase 1: wires to /api/launches/upcoming."
      />
      <PlaceholderPanel
        title="Satellite globe"
        status="REALTIME"
        note="Phase 1: CesiumJS + satellite.js SGP4."
      />
      <PlaceholderPanel
        title="Night sky"
        status="REALTIME"
        note="Phase 1: d3-celestial, alt-az on user location."
      />
      <PlaceholderPanel
        title="Space weather"
        status="LIVE"
        note="Phase 1: NOAA SWPC Kp index + aurora."
      />
    </div>
  );
}
