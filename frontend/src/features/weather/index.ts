// Weather feature public API — consumed by farms (WeatherForecastCard), router.

// Page entry point
export { default as WeatherPage } from './WeatherPage';

// Query hooks
export { useFarmSummary } from '@/features/farms/queries';

// Weather helpers (used by farms WeatherForecastCard and internally)
export {
  getWeatherInfo,
  getWeatherCodeInfo,
  pickNumber,
  formatForecastLabel,
  type WeatherIconKey,
  type WeatherCodeInfo,
} from './weatherHelpers';

// Icon map (separate file)
export { weatherIconMap } from './weatherIconMap';
