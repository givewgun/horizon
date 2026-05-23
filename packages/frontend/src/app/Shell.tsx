import { useMode } from '../lib/modeStore.js';
import { ModeSwitcher } from './ModeSwitcher.js';
import { GlobalClock } from '../components/common/GlobalClock.js';
import { useLocation } from '../context/LocationContext.js';
import { SpaceMode } from '../modes/space/SpaceMode.js';
import { EarthMode } from '../modes/earth/EarthMode.js';

export function Shell(): JSX.Element {
  const { mode } = useMode();
  const { location } = useLocation();
  return (
    <div className="flex h-full min-h-screen flex-col bg-mission-bg">
      <header className="flex items-center justify-between border-b border-mission-edge bg-mission-panel/60 px-4 py-2">
        <div>
          <div className="font-mono text-sm font-semibold uppercase tracking-widest text-mission-accent">
            Horizon
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
            mission control · phase 0
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden text-right font-mono text-[11px] text-slate-300 sm:block">
            <div>
              {location.label ?? `${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}`}
            </div>
            <div className="text-[10px] uppercase text-slate-500">
              location · {location.source}
            </div>
          </div>
          <GlobalClock />
        </div>
      </header>
      <main className="flex flex-1 overflow-hidden">
        <ModeSwitcher />
        <section className="flex-1 overflow-auto p-4">
          {mode === 'SPACE' ? <SpaceMode /> : <EarthMode />}
        </section>
      </main>
    </div>
  );
}
