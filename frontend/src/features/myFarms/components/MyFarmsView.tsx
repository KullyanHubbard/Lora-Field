import { useTranslation } from 'react-i18next';
import { MyFarmDeleteDialog } from './MyFarmDeleteDialog';
import { MyFarmEditDialog, type MyFarmEditPayload } from './MyFarmEditDialog';
import { MyFarmColorPicker } from './MyFarmColorPicker';
import { MyFarmsList } from './MyFarmsList';
import { MyFarmsLoadingState } from './MyFarmsLoadingState';
import { MyFarmsSearchBar } from './MyFarmsSearchBar';
import { type MarkerColorId } from '@/features/myFarms/farmColorStorage';
import type { Farm } from '@/types';

interface MyFarmsViewProps {
  filter: string;
  visibleFarms: Farm[];
  isLoading: boolean;
  error: Error | null;
  farmPendingDelete: Farm | null;
  isDeleting: boolean;
  onFilterChange: (value: string) => void;
  onRequestDeleteFarm: (farm: Farm) => void;
  onCloseDeleteDialog: () => void;
  onConfirmDeleteFarm: () => void;
  farmPendingEdit: Farm | null;
  farmPendingColor: Farm | null;
  isEditing: boolean;
  currentColor: MarkerColorId;
  onRequestEditFarm: (farm: Farm) => void;
  onCloseEditDialog: () => void;
  onConfirmEditFarm: (payload: MyFarmEditPayload) => void;
  onRequestChangeColorFarm: (farm: Farm) => void;
  onCloseColorPicker: () => void;
  onConfirmColorChange: (colorId: MarkerColorId) => void;
}

export function MyFarmsView({
  filter,
  visibleFarms,
  isLoading,
  error,
  farmPendingDelete,
  isDeleting,
  onFilterChange,
  onRequestDeleteFarm,
  onCloseDeleteDialog,
  onConfirmDeleteFarm,
  farmPendingEdit,
  farmPendingColor,
  isEditing,
  currentColor,
  onRequestEditFarm,
  onCloseEditDialog,
  onConfirmEditFarm,
  onRequestChangeColorFarm,
  onCloseColorPicker,
  onConfirmColorChange,
}: MyFarmsViewProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <MyFarmsSearchBar
        placeholder={t('farms.searchPlaceholder')}
        value={filter}
        onChange={onFilterChange}
      />

      {isLoading ? (
        <MyFarmsLoadingState />
      ) : error ? (
        <p className="text-destructive">{t('farms.errorLoad', { message: error.message })}</p>
      ) : visibleFarms.length === 0 ? (
        <p className="text-muted-foreground">
          {filter ? t('farms.emptyFiltered') : t('farms.empty')}
        </p>
      ) : (
        <MyFarmsList
          farms={visibleFarms}
          onRequestDeleteFarm={onRequestDeleteFarm}
          onRequestEditFarm={onRequestEditFarm}
          onRequestChangeColorFarm={onRequestChangeColorFarm}
        />
      )}

      <MyFarmEditDialog
        key={farmPendingEdit?.id ?? 'none'}
        farm={farmPendingEdit}
        isUpdating={isEditing}
        onClose={onCloseEditDialog}
        onConfirm={onConfirmEditFarm}
      />

      <MyFarmColorPicker
        farmName={farmPendingColor?.name ?? ''}
        isOpen={farmPendingColor != null}
        currentColor={currentColor}
        onColorChange={onConfirmColorChange}
        onClose={onCloseColorPicker}
      />

      <MyFarmDeleteDialog
        farm={farmPendingDelete}
        isDeleting={isDeleting}
        onClose={onCloseDeleteDialog}
        onConfirm={onConfirmDeleteFarm}
      />
    </div>
  );
}
