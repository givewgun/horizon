import { useMode, type AppMode } from '../lib/modeStore.js';

const MODES: { id: AppMode; label: string; hint: string }[] = [
  { id: 'SPACE', label: 'SPACE', hint: 'launches · satellites · sky' },
  { id: 'EARTH', label: 'EARTH', hint: 'weather · imagery · webcams' },
];

export function ModeSwitcher(): JSX.Element {
  const { mode, setMode } = useMode();
  return (
    <nav
      aria-label="application mode"
      className="flex flex-col gap-2 border-r border-mission-edge bg-mission-panel/40 p-3"
    >
      {MODES.map((m) => {
        const active = m.id === mode;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            aria-pressed={active}
            className={`rounded-md border px-3 py-2 text-left font-mono text-xs uppercase tracking-widest transition-colors ${
              active
                ? 'border-mission-accent bg-mission-accent/15 text-mission-accent'
                : 'border-mission-edge text-slate-300 hover:bg-mission-edge/40'
            }`}
          >
            <div>{m.label}</div>
            <div className="mt-0.5 text-[10px] normal-case tracking-normal text-slate-400">
              {m.hint}
            </div>
          </button>
        );
      })}
    </nav>
  );
}
