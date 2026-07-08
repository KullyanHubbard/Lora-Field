import { useTranslation } from 'react-i18next';
import { MyFarmDeleteDialog } from './MyFarmDeleteDialog';
import { MyFarmsList } from './MyFarmsList';
import { MyFarmsLoadingState } from './MyFarmsLoadingState';
import { MyFarmsSearchBar } from './MyFarmsSearchBar';
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
        <MyFarmsList farms={visibleFarms} onRequestDeleteFarm={onRequestDeleteFarm} />
      )}

      <MyFarmDeleteDialog
        farm={farmPendingDelete}
        isDeleting={isDeleting}
        onClose={onCloseDeleteDialog}
        onConfirm={onConfirmDeleteFarm}
      />
    </div>
  );
}
