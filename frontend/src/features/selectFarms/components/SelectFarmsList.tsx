import { useTranslation } from 'react-i18next';
import { SelectFarmsAddButton } from './SelectFarmsAddButton';
import { SelectFarmsListItem } from './SelectFarmsListItem';
import type { Farm } from '@/types';

interface SelectFarmsListProps {
  farms: Farm[];
  onAddFarm: () => void;
  onOpenFarm: (id: string) => void;
}

export function SelectFarmsList({ farms, onAddFarm, onOpenFarm }: SelectFarmsListProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
      <div className="mb-3 flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">
        {t('selectFarms.title')}
      </div>
      <div className="divide-y divide-border">
        {farms.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">{t('selectFarms.empty')}</p>
        ) : (
          farms.map((farm) => (
            <SelectFarmsListItem key={farm.id} farm={farm} onOpenFarm={onOpenFarm} />
          ))
        )}
      </div>

      <SelectFarmsAddButton onAddFarm={onAddFarm} />
    </div>
  );
}
