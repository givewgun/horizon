import { LocalForecast } from './LocalForecast.js';
import { WeatherMap } from './WeatherMap.js';
import { SatelliteImagery } from './SatelliteImagery.js';
import { CityWebcams } from './CityWebcams.js';

export function EarthMode(): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <WeatherMap />
      <SatelliteImagery />
      <CityWebcams />
      <LocalForecast />
    </div>
  );
}
