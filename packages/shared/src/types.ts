/**
 * Shared types — single source of truth for both frontend and backend.
 *
 * Keep this file framework-free (no React, no Node, no Fastify imports).
 */

// ---------- Status badges (UI semantics) ----------
export type FeedStatus = 'LIVE' | 'REALTIME' | 'SNAPSHOT';

// ---------- Location ----------
export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface ResolvedLocation extends GeoPoint {
  /** Human label, e.g. "Bangkok, Thailand". May be missing if reverse geocode fails. */
  label?: string;
  /** "browser" = HTML5 geolocation, "manual" = city search, "default" = fallback. */
  source: 'browser' | 'manual' | 'default';
}

// ---------- Launches (LL2 / The Space Devs, normalized) ----------
export type LaunchNetPrecision = 'Year' | 'Month' | 'Week' | 'Day' | 'Hour' | 'Minute' | 'Second';

export interface Webcast {
  url: string;
  /** e.g. "YouTube", "Twitter", "Official" */
  type: string;
  title?: string;
  priority?: number;
}

export interface LaunchPad {
  name: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  countryCode?: string;
}

export interface LaunchStatus {
  /** LL2 abbrev: Go, TBD, TBC, Hold, Success, Failure, ... */
  abbrev: string;
  name: string;
}

export interface Launch {
  id: string;
  name: string;
  /** ISO 8601 UTC; "no earlier than" target time */
  net: string;
  netPrecision: LaunchNetPrecision;
  status: LaunchStatus;
  provider: { name: string; type?: string };
  rocket: { name: string };
  mission?: {
    name?: string;
    description?: string;
    orbit?: string;
    type?: string;
  };
  pad: LaunchPad;
  webcastLive: boolean;
  webcasts: Webcast[];
  weatherConcerns?: string;
  /** Canonical detail page on TSD that's always safe to link. */
  url?: string;
}

// ---------- Satellites / orbits ----------
export interface TLE {
  /** NORAD catalog number, e.g. 25544 for ISS */
  catnr: number;
  name: string;
  line1: string;
  line2: string;
  /** When the TLE was fetched (ISO 8601). */
  fetchedAt: string;
}

export interface SatellitePosition {
  /** Degrees, -90..90 */
  lat: number;
  /** Degrees, -180..180 */
  lon: number;
  /** Kilometers above the WGS84 ellipsoid */
  altKm: number;
  /** ISO 8601 UTC instant the position is valid for */
  at: string;
}

export interface SatellitePass {
  /** ISO 8601 start of visibility window */
  start: string;
  end: string;
  /** Maximum elevation in degrees (0..90) */
  maxElevationDeg: number;
  /** Compass bearing at start, in degrees (0..360) */
  startAzimuthDeg: number;
  endAzimuthDeg: number;
}

// ---------- Constellations (static catalog shipped with the SPA) ----------
export interface ConstellationStar {
  /** Bayer designation or HIP id. */
  id: string;
  name: string;
  /** Right ascension in hours (0..24). */
  raHours: number;
  /** Declination in degrees (-90..90). */
  decDeg: number;
  /** Apparent visual magnitude (lower = brighter). */
  mag: number;
}

export interface Constellation {
  /** IAU abbreviation, e.g. "Ori". */
  abbr: string;
  name: string;
  /** Short mythology / lore blurb. */
  myth: string;
  /** Common name of brightest star. */
  brightestStar: string;
  /** Best evening-viewing season at mid-northern latitudes. */
  season: 'Spring' | 'Summer' | 'Autumn' | 'Winter' | 'Year-round';
  /** Stars referenced by the line segments below. */
  stars: ConstellationStar[];
  /** Pairs of star ids that should be joined to draw the figure. */
  lines: [string, string][];
}

// ---------- Space weather ----------
export interface KpReading {
  /** ISO 8601 UTC */
  time: string;
  /** Planetary K-index, 0..9 */
  kp: number;
  /** "observed" | "estimated" | "predicted" */
  kind: 'observed' | 'estimated' | 'predicted';
}

export interface SolarWindSnapshot {
  /** ISO 8601 UTC */
  time: string;
  /** Solar-wind bulk speed km/s */
  speedKms: number;
  /** Proton density n/cm^3 */
  densityPcc: number;
  /** Interplanetary-magnetic-field Bz GSM, nT (negative = southward = aurora-favourable) */
  bzNt: number;
}

export interface XrayFluxSnapshot {
  /** ISO 8601 UTC */
  time: string;
  /** GOES short-wavelength flux (0.05–0.4 nm), W/m^2 */
  shortWm2: number;
  /** GOES long-wavelength flux (0.1–0.8 nm), W/m^2 — what flare classes index */
  longWm2: number;
  /** Letter-class summary derived from longWm2, e.g. "M1.4", "X2.3", "C5.0", "B" */
  flareClass: string;
}

export interface SpaceWeather {
  current: KpReading;
  forecast: KpReading[];
  /** 0..1 likelihood of aurora visibility at the requested latitude */
  auroraLikelihood?: number;
  solarWind?: SolarWindSnapshot;
  xray?: XrayFluxSnapshot;
  fetchedAt: string;
}

// ---------- Weather ----------
export interface CurrentWeather {
  temperatureC: number;
  windKph: number;
  /** WMO weather code (Open-Meteo). */
  weatherCode: number;
  at: string;
}

export interface HourlyForecastPoint {
  at: string;
  temperatureC: number;
  /** 0..100 */
  precipProbability: number;
}

export interface DailyForecastPoint {
  date: string;
  weatherCode: number;
  tMaxC: number;
  tMinC: number;
}

export interface Forecast {
  location: GeoPoint;
  current: CurrentWeather;
  hourly: HourlyForecastPoint[];
  daily: DailyForecastPoint[];
  /** IANA tz the upstream attached, may be useful for clients that want local hours. */
  timezone?: string;
  fetchedAt: string;
}

// ---------- Webcams ----------
export interface Webcam {
  id: string;
  title: string;
  /** Embedded HTML player URL provided by Windy. */
  playerUrl?: string;
  thumbnailUrl?: string;
  location: { lat: number; lon: number; city?: string; country?: string };
  provider: 'windy' | 'youtube-fallback';
}

// ---------- Generic envelope for API responses ----------
export interface ApiOk<T> {
  ok: true;
  data: T;
  status: FeedStatus;
  /** Set when data is older than this many ms; clients can show staleness. */
  ageMs?: number;
}

export interface ApiErr {
  ok: false;
  error: string;
  code?: string;
  /** Optional last-good payload if the server cached one. */
  lastGood?: unknown;
}

export type ApiResult<T> = ApiOk<T> | ApiErr;
