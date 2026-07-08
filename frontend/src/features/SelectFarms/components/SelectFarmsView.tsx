import { useTranslation } from 'react-i18next';
import { SelectFarmsList } from './SelectFarmsList';
import { SelectFarmsLoadingState } from './SelectFarmsLoadingState';
import { SelectFarmsMap } from './SelectFarmsMap';
import type { Farm } from '@/types';

interface SelectFarmsViewProps {
  farms: Farm[];
  isLoading: boolean;
  error: Error | null;
  onAddFarm: () => void;
  onOpenFarm: (id: string) => void;
}

export function SelectFarmsView({
  farms,
  isLoading,
  error,
  onAddFarm,
  onOpenFarm,
}: SelectFarmsViewProps) {
  const { t } = useTranslation();

  if (isLoading) return <SelectFarmsLoadingState />;

  if (error) {
    return (
      <p className="text-destructive">{t('selectFarms.errorLoad', { message: error.message })}</p>
    );
  }

  return (
    <div className="w-full rounded-xl border border-border p-4 sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="rounded-xl border border-border bg-muted/40 p-1.5 lg:w-1/2 mb-4 lg:mb-0">
          <SelectFarmsMap farms={farms} />
        </div>

        <div className="lg:w-1/2">
          <SelectFarmsList farms={farms} onAddFarm={onAddFarm} onOpenFarm={onOpenFarm} />
        </div>
      </div>
    </div>
  );
}
