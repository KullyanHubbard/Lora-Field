import { useNavigate } from 'react-router-dom';
import { useFarms } from '@/features/farms/queries';

export function useSelectFarmsViewModel() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useFarms();

  return {
    farms: data?.items ?? [],
    isLoading,
    error,
    onAddFarm: () => navigate('/farms/add'),
    onOpenFarm: (id: string) => navigate(`/farms/${id}`),
  };
}
