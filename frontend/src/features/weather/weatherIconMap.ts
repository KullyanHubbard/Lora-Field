import {
  Cloud,
  CloudLightning,
  CloudOff,
  CloudRain,
  CloudRainWind,
  CloudSun,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import type { WeatherIconKey } from '@/features/weather/weatherHelpers';

export const weatherIconMap: Record<WeatherIconKey, LucideIcon> = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  'cloud-rain': CloudRain,
  'cloud-showers': CloudRainWind,
  'cloud-bolt': CloudLightning,
  unknown: CloudOff,
};
