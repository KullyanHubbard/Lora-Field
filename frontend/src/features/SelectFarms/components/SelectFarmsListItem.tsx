import { useTranslation } from 'react-i18next';
import { StatusLights } from '@/components/ui/status-lights';
import { farmStatusTone } from '@/features/dashboard/farmStatusHelpers';
import { getShortFarmLocation } from '@/features/selectFarms/selectFarmsHelpers';
import type { Farm } from '@/types';

interface SelectFarmsListItemProps {
  farm: Farm;
  onOpenFarm: (id: string) => void;
}

export function SelectFarmsListItem({ farm, onOpenFarm }: SelectFarmsListItemProps) {
  const { t } = useTranslation();
  const tone = farmStatusTone(farm.status);
  const shortLocation = getShortFarmLocation(farm.location);

  return (
    <div
      onClick={() => onOpenFarm(farm.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpenFarm(farm.id);
      }}
      tabIndex={0}
      role="button"
      aria-label={t('selectFarms.openFarm', { name: farm.name })}
      className="flex cursor-pointer items-start justify-between gap-3 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-foreground">{farm.name}</h3>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {farm.crop_type || '—'}
        </p>
        {shortLocation && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {shortLocation}
          </p>
        )}
      </div>
      <StatusLights tone={tone} />
    </div>
  );
}
