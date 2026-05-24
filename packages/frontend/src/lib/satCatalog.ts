/**
 * Preset satellite groups for the globe. Catalog numbers are stable; names
 * are display labels (the live name comes from the TLE itself, but we want
 * a friendly label before the TLE arrives).
 *
 * Adding a new satellite is one line here — no other code change needed.
 */

import type { SatGroupId } from './globeStore.js';

export interface SatPreset {
  catnr: number;
  label: string;
  /** Tailwind-ish hex used for the marker, label, and ground track. */
  color: string;
}

export const SAT_GROUPS: Record<SatGroupId, { title: string; sats: SatPreset[] }> = {
  stations: {
    title: 'Space stations',
    sats: [
      { catnr: 25544, label: 'ISS', color: '#22c55e' },
      { catnr: 48274, label: 'Tiangong', color: '#f97316' },
    ],
  },
  observatories: {
    title: 'Observatories',
    sats: [
      { catnr: 20580, label: 'Hubble', color: '#38bdf8' },
      { catnr: 25867, label: 'Chandra X-ray', color: '#c084fc' },
      { catnr: 27370, label: 'INTEGRAL', color: '#fbbf24' },
    ],
  },
  weather: {
    title: 'Weather sats',
    sats: [
      { catnr: 43013, label: 'NOAA-20', color: '#60a5fa' },
      { catnr: 51850, label: 'GOES-18', color: '#60a5fa' },
      { catnr: 41866, label: 'GOES-16', color: '#60a5fa' },
      { catnr: 37849, label: 'Suomi NPP', color: '#93c5fd' },
    ],
  },
  earthObs: {
    title: 'Earth observation',
    sats: [
      { catnr: 25994, label: 'Terra', color: '#a3e635' },
      { catnr: 27424, label: 'Aqua', color: '#a3e635' },
      { catnr: 28376, label: 'Aura', color: '#bef264' },
      { catnr: 49260, label: 'Landsat-9', color: '#84cc16' },
      { catnr: 40697, label: 'Sentinel-2A', color: '#65a30d' },
    ],
  },
  navigation: {
    title: 'Navigation',
    sats: [
      { catnr: 41019, label: 'GPS IIF-12', color: '#f472b6' },
      { catnr: 39741, label: 'GPS IIF-6', color: '#f472b6' },
      { catnr: 32711, label: 'GPS IIR-19', color: '#f472b6' },
    ],
  },
};

export const ALL_PRESETS: SatPreset[] = Object.values(SAT_GROUPS).flatMap((g) => g.sats);

export function presetByCatnr(catnr: number): SatPreset | undefined {
  return ALL_PRESETS.find((p) => p.catnr === catnr);
}
