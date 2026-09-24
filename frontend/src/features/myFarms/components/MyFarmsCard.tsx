import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EMPTY_VALUE, formatAreaHa } from '@/lib/format';
import type { Farm } from '@/types';

interface MyFarmsCardProps {
  farm: Farm;
  onRequestDelete: (farm: Farm) => void;
  onRequestEdit: (farm: Farm) => void;
  onRequestChangeColor: (farm: Farm) => void;
}

export function MyFarmsCard({
  farm,
  onRequestDelete,
  onRequestEdit,
  onRequestChangeColor,
}: MyFarmsCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="relative h-full overflow-hidden p-0 transition-all hover:shadow-md">
      <Link to={`/farms/${farm.id}`} className="block p-6">
        {/* Header: nama + owner */}
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-col">
            <h3 className="truncate text-lg font-semibold text-foreground">{farm.name}</h3>
            {farm.owner && <span className="mt-1 text-sm text-muted-foreground">{farm.owner}</span>}
          </div>
        </div>

        {/* Detail info */}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">{t('myFarms.cardLocation')}</div>
            <p className="mt-1 truncate text-sm font-medium text-foreground">
              {farm.location || EMPTY_VALUE}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">{t('myFarms.cardCrop')}</div>
            <p className="mt-1 truncate text-sm font-medium text-foreground">
              {farm.crop_type || EMPTY_VALUE}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">{t('myFarms.cardArea')}</div>
            <p className="mt-1 text-sm font-medium tabular-nums text-foreground">
              {formatAreaHa(farm.area_ha)}
            </p>
          </div>
        </div>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('farms.cardMenuOpen')}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-3 top-3 z-10"
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onSelect={() => onRequestEdit(farm)}>
            {t('myFarms.cardMenuEdit')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onRequestChangeColor(farm)}>
            {t('myFarms.cardMenuMarker')}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => onRequestDelete(farm)}>
            {t('myFarms.cardMenuDelete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}
