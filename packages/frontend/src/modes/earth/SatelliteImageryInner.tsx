import { useEffect, useRef, useState } from 'react';
import {
  Cartesian3,
  Color,
  ImageryLayer,
  Ion,
  OpenStreetMapImageryProvider,
  Viewer,
  type Entity,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useLocation } from '../../context/LocationContext.js';
import { FeedFallback } from '../../components/common/FeedFallback.js';

if (typeof window !== 'undefined') {
  Ion.defaultAccessToken = '';
}

export function SatelliteImageryInner(): JSX.Element {
  const { location } = useLocation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const markerRef = useRef<Entity | null>(null);
  const locationRef = useRef(location);
  locationRef.current = location;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    const { lat, lon } = locationRef.current;
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
        shouldAnimate: false,
      });

      viewer.scene.globe.enableLighting = true;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
      viewer.scene.backgroundColor = Color.fromCssColorString('#05060a');

      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(lon, lat, 12_000_000),
      });

      markerRef.current = viewer.entities.add({
        name: 'You are here',
        position: Cartesian3.fromDegrees(lon, lat, 50_000),
        point: {
          pixelSize: 12,
          color: Color.fromCssColorString('#ef4444'),
          outlineColor: Color.fromCssColorString('#fee2e2'),
          outlineWidth: 2,
        },
      });

      viewerRef.current = viewer;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'cesium init failed');
    }

    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    const marker = markerRef.current;
    if (!viewer || !marker) return;

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(location.lon, location.lat, 12_000_000),
      duration: 1.5,
    });

    marker.position = Cartesian3.fromDegrees(
      location.lon,
      location.lat,
      50_000,
    ) as never;
  }, [location.lat, location.lon]);

  const coords = `${location.lat.toFixed(2)}°, ${location.lon.toFixed(2)}°`;

  if (error) {
    return <FeedFallback feedName="satellite globe" message={error} />;
  }

  return (
    <div>
      <p className="mb-2 text-xs text-slate-400">
        Centred on{' '}
        <span className="text-slate-200">{location.label ?? coords}</span>.
      </p>
      <div
        ref={containerRef}
        className="h-96 w-full overflow-hidden rounded border border-slate-700 bg-black"
      />
      <p className="mt-2 text-center font-mono text-[10px] text-slate-500">
        Drag to rotate · scroll to zoom
      </p>
    </div>
  );
}
