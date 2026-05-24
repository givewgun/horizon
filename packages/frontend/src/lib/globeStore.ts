/**
 * Cross-panel state for the globe. The globe is the hero — clicking its
 * surface "pins" a lat/lon that the Night Sky (and later Weather) panels
 * read. Pin clears when the user shift-clicks the same area or hits Reset.
 *
 * Also stores which preset satellite groups are visible so the toggle UI
 * outside the Cesium viewer stays in sync with the entities inside it.
 */

import { create } from 'zustand';

export interface GlobePin {
  lat: number;
  lon: number;
}

export type SatGroupId =
  | 'stations'
  | 'observatories'
  | 'weather'
  | 'earthObs'
  | 'navigation';

interface GlobeState {
  pin: GlobePin | null;
  setPin: (p: GlobePin | null) => void;
  groups: Record<SatGroupId, boolean>;
  toggleGroup: (id: SatGroupId) => void;
  /** Extra NORAD ids the user typed in. */
  extras: number[];
  addExtra: (catnr: number) => void;
  removeExtra: (catnr: number) => void;
}

export const useGlobeStore = create<GlobeState>((set) => ({
  pin: null,
  setPin: (p) => set({ pin: p }),
  groups: {
    stations: true,
    observatories: true,
    weather: false,
    earthObs: false,
    navigation: false,
  },
  toggleGroup: (id) =>
    set((s) => ({ groups: { ...s.groups, [id]: !s.groups[id] } })),
  extras: [],
  addExtra: (catnr) =>
    set((s) =>
      s.extras.includes(catnr) ? s : { extras: [...s.extras, catnr] },
    ),
  removeExtra: (catnr) =>
    set((s) => ({ extras: s.extras.filter((n) => n !== catnr) })),
}));
