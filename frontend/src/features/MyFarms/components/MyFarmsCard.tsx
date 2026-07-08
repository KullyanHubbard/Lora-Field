import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, MoreVertical, Ruler, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusLights } from '@/components/ui/status-lights';
import {
  getMyFarmStatusBorderClass,
  getMyFarmStatusDotClass,
  getMyFarmStatusRibbonClass,
} from '@/features/MyFarms/myFarmsHelpers';
import { farmStatusLabelKey, farmStatusTone } from '@/features/farms/farmHelpers';
import { formatAreaHa, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Farm } from '@/types';

interface MyFarmsCardProps {
  farm: Farm;
  onRequestDelete: (farm: Farm) => void;
}

export function MyFarmsCard({ farm, onRequestDelete }: MyFarmsCardProps) {
  const { t } = useTranslation();
  const statusTone = farmStatusTone(farm.status);

  return (
    <Card
      className={cn(
        'group relative h-full overflow-hidden border-l-4 p-0 transition-all hover:shadow-md',
        getMyFarmStatusBorderClass(statusTone),
      )}
    >
      {/* Strip pita dekoratif tipis di atas */}
      <div
        className={cn(
          'absolute right-0 top-0 h-1 w-1/3 rounded-bl-full',
          getMyFarmStatusRibbonClass(statusTone),
        )}
        aria-hidden="true"
      />

      <Link to={`/farms/${farm.id}`} className="block p-5">
        {/* Header: nama + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sprout className="size-3.5" />
              </span>
              <h3 className="truncate font-semibold text-foreground">{farm.name}</h3>
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider text-muted-foreground">
                <span
                  className={cn('size-1.5 shrink-0 rounded-full', getMyFarmStatusDotClass(statusTone))}
                  aria-hidden="true"
                />
                {t(farmStatusLabelKey(farm.status))}
              </span>
            </div>
            {farm.owner && (
              <span className="ml-9 mt-0.5 text-xs text-muted-foreground">{farm.owner}</span>
            )}
          </div>
          <StatusLights
            tone={statusTone}
            label={t(farmStatusLabelKey(farm.status))}
            className="shrink-0"
          />
        </div>

        {/* Detail info */}
        <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:ml-9 min-[420px]:grid-cols-3">
          <div className="rounded-lg bg-muted/40 p-2">
            <div className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
              <MapPin className="size-2.5" />
              <span>Lokasi</span>
            </div>
            <p className="mt-0.5 truncate text-xs font-medium text-foreground">
              {farm.location || '—'}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <div className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
              <Sprout className="size-2.5" />
              <span>Tanaman</span>
            </div>
            <p className="mt-0.5 truncate text-xs font-medium text-foreground">
              {farm.crop_type || '—'}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <div className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
              <Ruler className="size-2.5" />
              <span>Luas</span>
            </div>
            <p className="mt-0.5 text-xs font-medium tabular-nums text-foreground">
              {formatAreaHa(farm.area_ha)}
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="ml-9 mt-3 text-[0.65rem] text-muted-foreground">
          {t('farms.cardUpdated')} {timeAgo(farm.updated_at, t)}
        </p>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('farms.cardMenuOpen')}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-3 top-3 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => onRequestDelete(farm)}>
            {t('farms.cardMenuDelete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}
