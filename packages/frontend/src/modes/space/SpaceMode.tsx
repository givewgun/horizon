import { LaunchTracker } from './LaunchTracker.js';
import { SatelliteGlobe } from './SatelliteGlobe.js';
import { NightSky } from './NightSky.js';
import { SpaceWeatherPanel } from './SpaceWeather.js';
import { LiveStreams } from './LiveStreams.js';

/**
 * SPACE mode layout. The globe is the hero — full-width row at the top. The
 * remaining panels share a responsive grid below it. The night sky listens to
 * the globe's location pin so clicking the Earth re-centres the planetarium.
 */
export function SpaceMode(): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <SatelliteGlobe />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <LaunchTracker />
        <NightSky />
        <SpaceWeatherPanel />
        <LiveStreams />
      </div>
    </div>
  );
}
