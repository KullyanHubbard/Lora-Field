import { useState } from 'react';
import { filterMyFarms } from './myFarmsHelpers';
import { useDeleteFarm, useUpdateFarm } from './queries';
import { getFarmMarkerColor, setFarmMarkerColor, type MarkerColorId } from './farmColorStorage';
import { useFarms } from '@/features/dashboard/queries';
import type { MyFarmEditPayload } from './components/MyFarmEditDialog';
import type { Farm } from '@/types';

export function useMyFarmsViewModel() {
  const { data, isLoading, error } = useFarms();
  const deleteFarm = useDeleteFarm();
  const updateFarm = useUpdateFarm();
  const [filter, setFilter] = useState('');
  const [farmPendingDelete, setFarmPendingDelete] = useState<Farm | null>(null);
  const [farmPendingEdit, setFarmPendingEdit] = useState<Farm | null>(null);
  const [farmPendingColor, setFarmPendingColor] = useState<Farm | null>(null);
  const [currentColor, setCurrentColor] = useState<MarkerColorId>('blue');

  const farms = data?.items ?? [];
  const visibleFarms = filterMyFarms(farms, filter);

  function confirmDeleteFarm() {
    if (!farmPendingDelete) return;

    deleteFarm.mutate(farmPendingDelete.id, {
      onSuccess: () => setFarmPendingDelete(null),
    });
  }

  function handleEditFarm(farm: Farm) {
    setFarmPendingEdit(farm);
  }

  function handleCloseEditDialog() {
    setFarmPendingEdit(null);
  }

  function handleConfirmEditFarm(payload: MyFarmEditPayload) {
    if (!farmPendingEdit) return;

    updateFarm.mutate(
      { id: farmPendingEdit.id, payload },
      {
        onSuccess: () => setFarmPendingEdit(null),
      },
    );
  }

  function handleChangeColorFarm(farm: Farm) {
    setCurrentColor(getFarmMarkerColor(farm.id));
    setFarmPendingColor(farm);
  }

  function handleCloseColorPicker() {
    setFarmPendingColor(null);
  }

  function handleConfirmColorChange(colorId: MarkerColorId) {
    if (!farmPendingColor) return;
    setFarmMarkerColor(farmPendingColor.id, colorId);
    setFarmPendingColor(null);
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
    farmPendingEdit,
    farmPendingColor,
    isEditing: updateFarm.isPending,
    currentColor,
    onRequestEditFarm: handleEditFarm,
    onCloseEditDialog: handleCloseEditDialog,
    onConfirmEditFarm: handleConfirmEditFarm,
    onRequestChangeColorFarm: handleChangeColorFarm,
    onCloseColorPicker: handleCloseColorPicker,
    onConfirmColorChange: handleConfirmColorChange,
  };
}
