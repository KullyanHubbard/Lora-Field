import { useQuery } from '@tanstack/react-query';
import { fetchWeatherHistory } from './openMeteo';

export function useWeatherHistory(lat: number | undefined, lon: number | undefined) {
  return useQuery({
    queryKey: ['weather-history', lat, lon],
    queryFn: () => fetchWeatherHistory(lat!, lon!),
    enabled: lat != null && lon != null && lat !== 0 && lon !== 0,
    staleTime: 15 * 60_000,
    refetchInterval: 30 * 60_000,
  });
}