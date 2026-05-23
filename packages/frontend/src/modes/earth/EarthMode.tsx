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

export function EarthMode(): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <PlaceholderPanel
        title="Weather map"
        status="REALTIME"
        note="Phase 2: MapLibre + RainViewer animated radar + OWM toggles."
      />
      <PlaceholderPanel
        title="Satellite imagery"
        status="SNAPSHOT"
        note="Phase 2: RAMMB SLIDER, default Himawari/Asia sector."
      />
      <PlaceholderPanel
        title="City webcams"
        status="LIVE"
        note="Phase 2: Windy webcams near-me + featured cities."
      />
      <PlaceholderPanel
        title="Local forecast"
        status="LIVE"
        note="Phase 2: Open-Meteo current + 24h + 7d card."
      />
    </div>
  );
}
