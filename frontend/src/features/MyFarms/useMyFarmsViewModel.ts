import { useState } from 'react';
import { filterMyFarms } from './myFarmsHelpers';
import { useDeleteFarm } from './queries';
import { useFarms } from '@/features/farms/queries';
import type { Farm } from '@/types';

export function useMyFarmsViewModel() {
  const { data, isLoading, error } = useFarms();
  const deleteFarm = useDeleteFarm();
  const [filter, setFilter] = useState('');
  const [farmPendingDelete, setFarmPendingDelete] = useState<Farm | null>(null);

  const farms = data?.items ?? [];
  const visibleFarms = filterMyFarms(farms, filter);

  function confirmDeleteFarm() {
    if (!farmPendingDelete) return;

    deleteFarm.mutate(farmPendingDelete.id, {
      onSuccess: () => setFarmPendingDelete(null),
    });
  }

  return {
    filter,
    visibleFarms,
    isLoading,
    error,
    farmPendingDelete,
    isDeleting: deleteFarm.isPending,
    onFilterChange: setFilter,
    onRequestDeleteFarm: setFarmPendingDelete,
    onCloseDeleteDialog: () => setFarmPendingDelete(null),
    onConfirmDeleteFarm: confirmDeleteFarm,
  };
}
