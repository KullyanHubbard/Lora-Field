import { useFarms } from '@/features/dashboard/queries';

export function useSelectFarmsViewModel() {
  const { data, isLoading, error } = useFarms();

  return {
    farms: data?.items ?? [],
    isLoading,
    error,
  };
}
