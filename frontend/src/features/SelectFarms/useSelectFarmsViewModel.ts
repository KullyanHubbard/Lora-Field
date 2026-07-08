import { useNavigate } from 'react-router-dom';
import { useFarms } from '@/features/dashboard/queries';

export function useSelectFarmsViewModel() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useFarms();

  return {
    farms: data?.items ?? [],
    isLoading,
    error,
    onAddFarm: () => navigate('/addFarm'),
    onOpenFarm: (id: string) => navigate(`/farms/${id}`),
  };
}
