import { useQuery } from '@tanstack/react-query';
import { fetchWeatherHistory } from './openMeteo';
import { SLOW_DATA_STALE_MS, WEATHER_REFETCH_INTERVAL_MS } from '@/lib/queryTiming';

export function useWeatherHistory(lat: number | undefined, lon: number | undefined) {
  return useQuery({
    queryKey: ['weather-history', lat, lon],
    queryFn: () => fetchWeatherHistory(lat!, lon!),
    enabled: lat != null && lon != null && lat !== 0 && lon !== 0,
    staleTime: SLOW_DATA_STALE_MS,
    refetchInterval: WEATHER_REFETCH_INTERVAL_MS,
  });
}
