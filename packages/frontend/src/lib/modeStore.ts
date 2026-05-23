import { create } from 'zustand';

export type AppMode = 'SPACE' | 'EARTH';

const LS_KEY = 'horizon.mode';

function initial(): AppMode {
  try {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem(LS_KEY) : null;
    if (v === 'SPACE' || v === 'EARTH') return v;
  } catch {
    /* ignore */
  }
  return 'SPACE';
}

interface ModeState {
  mode: AppMode;
  setMode: (m: AppMode) => void;
}

export const useMode = create<ModeState>((set) => ({
  mode: initial(),
  setMode: (m) => {
    try {
      window.localStorage.setItem(LS_KEY, m);
    } catch {
      /* ignore */
    }
    set({ mode: m });
  },
}));
