/**
 * Cesium-using subtree. Loaded via React.lazy from `SatelliteGlobe` so the
 * Cesium runtime stays out of the initial bundle.
 *
 * Visible-Earth imagery without a Cesium Ion token comes from OpenStreetMap
 * tiles (see ADR-0002 update); we never call Ion in production. Day/night
 * lighting is on; the user can toggle preset satellite groups (stations,
 * observatories, weather, Earth obs, navigation), add NORAD ids by hand, and
 * left-click the surface to pin a location that other panels (Night Sky,
 * later the Weather map) read from `useGlobeStore`.
 *
 * JWST is a fixed marker. We do NOT SGP4-propagate it; it sits at Sun–Earth
 * L2 (~1.5M km out) and TLEs don't model it.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cartesian2,
  Cartesian3,
  Color,
  Ellipsoid,
  ImageryLayer,
  Ion,
  OpenStreetMapImageryProvider,
  PolylineGlowMaterialProperty,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
  Math as CMath,
  type Entity,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import type { SatRec } from 'satellite.js';
import type { SatellitePass, TLE } from '@horizon/shared';
import { apiGet } from '../../lib/api.js';
import { useLocation } from '../../context/LocationContext.js';
import { FeedFallback } from '../../components/common/FeedFallback.js';
import {
  groundTrack,
  nextPasses,
  propagateAt,
  tleToSatrec,
} from '../../lib/orbits.js';
import { formatUtcAndBangkok } from '../../lib/time.js';
import { useGlobeStore, type SatGroupId } from '../../lib/globeStore.js';
import { SAT_GROUPS, presetByCatnr, type SatPreset } from '../../lib/satCatalog.js';

// JWST at Sun–Earth L2 anti-Sun direction; for a static pin we render a
// labelled marker high above the equator. Honest fixed marker, not orbit.
const JWST_MARKER = { lat: 0, lon: -160, altKm: 1_500_000 };

if (typeof window !== 'undefined') {
  // Default imagery comes from OSM, not Ion. Leaving this empty silences the
  // Cesium console warning without unlocking any paid tiles.
  Ion.defaultAccessToken = '';
}

async function fetchTle(catnr: number): Promise<TLE> {
  return apiGet<TLE>(`/tle/${catnr}`);
}

function useAnimationFrame(cb: (t: number) => void): void {
  useEffect(() => {
    let raf = 0;
    const tick = (t: number): void => {
      cb(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cb]);
}

interface SatEntities {
  sat: Entity;
  track: Entity;
}

export function SatelliteGlobeInner(): JSX.Element {
  const { location } = useLocation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const entitiesRef = useRef<Map<number, SatEntities>>(new Map());
  const satrecsRef = useRef<Map<number, SatRec>>(new Map());
  const presetsRef = useRef<Map<number, SatPreset>>(new Map());
  const pinEntityRef = useRef<Entity | null>(null);

  const groups = useGlobeStore((s) => s.groups);
  const toggleGroup = useGlobeStore((s) => s.toggleGroup);
  const extras = useGlobeStore((s) => s.extras);
  const addExtra = useGlobeStore((s) => s.addExtra);
  const removeExtra = useGlobeStore((s) => s.removeExtra);
  const pin = useGlobeStore((s) => s.pin);
  const setPin = useGlobeStore((s) => s.setPin);

  const [addInput, setAddInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [passes, setPasses] = useState<SatellitePass[]>([]);

  const activePresets = useMemo<SatPreset[]>(() => {
    const out: SatPreset[] = [];
    for (const [gid, on] of Object.entries(groups) as [SatGroupId, boolean][]) {
      if (on) out.push(...SAT_GROUPS[gid].sats);
    }
    for (const catnr of extras) {
      if (out.some((p) => p.catnr === catnr)) continue;
      out.push(
        presetByCatnr(catnr) ?? {
          catnr,
          label: `NORAD ${catnr}`,
          color: '#a78bfa',
        },
      );
    }
    return out;
  }, [groups, extras]);

  // Boot viewer once.
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    try {
      const viewer = new Viewer(containerRef.current, {
        baseLayer: new ImageryLayer(
          new OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/',
            credit: '© OpenStreetMap contributors',
          }),
          {},
        ),
        baseLayerPicker: false,
        animation: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        shouldAnimate: true,
      });
      viewer.scene.globe.enableLighting = true;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
      viewer.scene.backgroundColor = Color.fromCssColorString('#05060a');

      // JWST fixed marker.
      viewer.entities.add({
        name: 'JWST (L2 marker)',
        position: Cartesian3.fromDegrees(
          JWST_MARKER.lon,
          JWST_MARKER.lat,
          35_000_000,
        ),
        point: {
          pixelSize: 9,
          color: Color.fromCssColorString('#f59e0b'),
          outlineColor: Color.fromCssColorString('#fef3c7'),
          outlineWidth: 1,
        },
        label: {
          text: 'JWST · L2 (fixed)',
          font: '11px monospace',
          fillColor: Color.fromCssColorString('#f59e0b'),
          showBackground: true,
          backgroundColor: Color.fromCssColorString('#111827').withAlpha(0.85),
          pixelOffset: new Cartesian2(0, -16),
        },
      });

      // Click-to-pin handler.
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: { position: Cartesian2 }) => {
        const cart = viewer.camera.pickEllipsoid(click.position, Ellipsoid.WGS84);
        if (!cart) return;
        const cartographic = Ellipsoid.WGS84.cartesianToCartographic(cart);
        const lat = CMath.toDegrees(cartographic.latitude);
        const lon = CMath.toDegrees(cartographic.longitude);
        setPin({ lat, lon });
      }, ScreenSpaceEventType.LEFT_CLICK);

      viewerRef.current = viewer;
      // Frame at a comfortable altitude.
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(100, 13, 20_000_000),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'cesium init failed');
    }
    const entities = entitiesRef.current;
    const satrecs = satrecsRef.current;
    const presets = presetsRef.current;
    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
      entities.clear();
      satrecs.clear();
      presets.clear();
      pinEntityRef.current = null;
    };
  }, [setPin]);

  // Pin entity sync.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (pinEntityRef.current) {
      viewer.entities.remove(pinEntityRef.current);
      pinEntityRef.current = null;
    }
    if (!pin) return;
    pinEntityRef.current = viewer.entities.add({
      name: 'Selected location',
      position: Cartesian3.fromDegrees(pin.lon, pin.lat, 50_000),
      point: {
        pixelSize: 10,
        color: Color.fromCssColorString('#facc15'),
        outlineColor: Color.fromCssColorString('#fef9c3'),
        outlineWidth: 2,
      },
      label: {
        text: `pin · ${pin.lat.toFixed(2)}, ${pin.lon.toFixed(2)}`,
        font: '10px monospace',
        fillColor: Color.fromCssColorString('#fef9c3'),
        showBackground: true,
        backgroundColor: Color.fromCssColorString('#111827').withAlpha(0.85),
        pixelOffset: new Cartesian2(0, -16),
      },
    });
  }, [pin]);

  // Sync tracked satellites with entities + satrecs.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    let cancelled = false;

    (async () => {
      const wantedIds = new Set(activePresets.map((p) => p.catnr));
      // Remove no-longer-tracked.
      for (const [catnr, ent] of entitiesRef.current) {
        if (!wantedIds.has(catnr)) {
          viewer.entities.remove(ent.sat);
          viewer.entities.remove(ent.track);
          entitiesRef.current.delete(catnr);
          satrecsRef.current.delete(catnr);
          presetsRef.current.delete(catnr);
        }
      }
      // Add new ones.
      for (const sat of activePresets) {
        if (entitiesRef.current.has(sat.catnr)) continue;
        try {
          const tle = await fetchTle(sat.catnr);
          if (cancelled) return;
          satrecsRef.current.set(sat.catnr, tleToSatrec(tle));
          presetsRef.current.set(sat.catnr, sat);
          const color = Color.fromCssColorString(sat.color);
          const satEntity = viewer.entities.add({
            name: `${sat.label} (${sat.catnr})`,
            position: Cartesian3.fromDegrees(0, 0, 400_000),
            point: {
              pixelSize: 7,
              color,
              outlineColor: Color.WHITE.withAlpha(0.6),
              outlineWidth: 1,
            },
            label: {
              text: sat.label,
              font: '10px monospace',
              fillColor: color,
              showBackground: true,
              backgroundColor: Color.fromCssColorString('#111827').withAlpha(0.85),
              pixelOffset: new Cartesian2(0, -14),
            },
          });
          const track = viewer.entities.add({
            name: `${sat.label} ground track`,
            polyline: {
              positions: [],
              width: 1.5,
              material: new PolylineGlowMaterialProperty({
                glowPower: 0.15,
                color: color.withAlpha(0.6),
              }),
            },
          });
          entitiesRef.current.set(sat.catnr, { sat: satEntity, track });
        } catch (e) {
          if (!cancelled) {
            // Don't trip the whole panel for one missing TLE — log + drop.
            // eslint-disable-next-line no-console
            console.warn(`tle ${sat.catnr} failed:`, e);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activePresets]);

  // Update positions at 2 Hz.
  const lastTickRef = useRef(0);
  useAnimationFrame((t) => {
    if (t - lastTickRef.current < 500) return;
    lastTickRef.current = t;
    const now = new Date();
    for (const [catnr, ent] of entitiesRef.current) {
      const rec = satrecsRef.current.get(catnr);
      if (!rec) continue;
      const pos = propagateAt(rec, now);
      if (!pos) continue;
      ent.sat.position = Cartesian3.fromDegrees(
        pos.lon,
        pos.lat,
        pos.altKm * 1000,
      ) as never;
      const track = groundTrack(rec, now, { spanMinutes: 45, stepSeconds: 60 });
      if (ent.track.polyline) {
        ent.track.polyline.positions = Cartesian3.fromDegreesArrayHeights(
          track.flatMap((p) => [p.lon, p.lat, p.altKm * 1000]),
        ) as never;
      }
    }
  });

  // ISS passes for the user's home location.
  useEffect(() => {
    const id = window.setInterval(() => {
      const rec = satrecsRef.current.get(25544);
      if (!rec) return;
      setPasses(
        nextPasses(
          rec,
          { latitudeDeg: location.lat, longitudeDeg: location.lon, heightKm: 0 },
          new Date(),
          { horizonMs: 48 * 3600_000, stepMs: 30_000, minPeakElevationDeg: 10 },
        ).slice(0, 3),
      );
    }, 5_000);
    return () => window.clearInterval(id);
  }, [location.lat, location.lon]);

  const addSat = (): void => {
    const n = Number.parseInt(addInput, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    addExtra(n);
    setAddInput('');
  };

  const passList = useMemo(
    () =>
      passes.map((p) => {
        const t = formatUtcAndBangkok(p.start);
        return {
          ...p,
          label: `${t.bangkok} · max el ${p.maxElevationDeg.toFixed(0)}° · ${p.startAzimuthDeg.toFixed(0)}°→${p.endAzimuthDeg.toFixed(0)}°`,
        };
      }),
    [passes],
  );

  if (error) {
    return (
      <FeedFallback
        feedName="satellite globe"
        message={error}
        onRetry={() => setError(null)}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_280px]">
      <div
        ref={containerRef}
        className="aspect-square w-full overflow-hidden rounded border border-mission-edge bg-black lg:aspect-auto lg:h-[640px]"
      />

      <aside className="flex flex-col gap-3 text-xs text-slate-300">
        <section className="rounded border border-mission-edge bg-mission-bg/40 p-2">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate-400">
            satellite groups
          </div>
          <ul className="flex flex-col gap-1">
            {(Object.entries(SAT_GROUPS) as [SatGroupId, (typeof SAT_GROUPS)[SatGroupId]][]).map(
              ([id, g]) => (
                <li key={id}>
                  <label className="flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-0.5 hover:bg-mission-edge/40">
                    <span>
                      <input
                        type="checkbox"
                        checked={groups[id]}
                        onChange={() => toggleGroup(id)}
                        className="mr-2 align-middle"
                      />
                      {g.title}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {g.sats.length}
                    </span>
                  </label>
                </li>
              ),
            )}
          </ul>
        </section>

        <section className="rounded border border-mission-edge bg-mission-bg/40 p-2">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate-400">
            add by NORAD id
          </div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              placeholder="e.g. 44713"
              className="flex-1 rounded border border-mission-edge bg-mission-bg/60 px-2 py-1 font-mono text-xs"
              aria-label="add satellite by NORAD id"
            />
            <button
              type="button"
              onClick={addSat}
              className="rounded border border-mission-edge px-2 py-1 text-xs hover:bg-mission-edge"
            >
              add
            </button>
          </div>
          {extras.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1">
              {extras.map((n) => (
                <li key={n}>
                  <button
                    type="button"
                    onClick={() => removeExtra(n)}
                    className="rounded-full border border-mission-edge px-2 py-0.5 font-mono text-[10px] text-slate-400 hover:border-mission-danger hover:text-mission-danger"
                    title="remove"
                  >
                    {n} ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="rounded border border-mission-edge bg-mission-bg/40 p-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-slate-400">
            <span>click globe to pin location</span>
            {pin ? (
              <button
                type="button"
                onClick={() => setPin(null)}
                className="rounded border border-mission-edge px-1 text-[10px] hover:bg-mission-edge"
              >
                clear
              </button>
            ) : null}
          </div>
          {pin ? (
            <div className="font-mono text-[11px] text-mission-accent">
              {pin.lat.toFixed(3)}, {pin.lon.toFixed(3)}
            </div>
          ) : (
            <div className="text-slate-500">No pin. Night Sky uses your home location.</div>
          )}
        </section>

        <section className="rounded border border-mission-edge bg-mission-bg/40 p-2">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate-400">
            next ISS passes ≥10° peak · {location.label ?? `${location.lat.toFixed(2)},${location.lon.toFixed(2)}`}
          </div>
          {passList.length === 0 ? (
            <div className="text-slate-500">No visible passes in the next 48h.</div>
          ) : (
            <ul className="flex flex-col gap-0.5 font-mono text-[11px] text-slate-300">
              {passList.map((p) => (
                <li key={p.start}>{p.label}</li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
