import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Sprout, Ruler, MoreVertical, Search } from 'lucide-react';
import { useDeleteFarm, useFarms } from './queries';
import { formatAreaHa, timeAgo } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatusLights, farmStatusTone, farmStatusLabelKey } from '@/components/ui/status-lights';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { Farm } from '@/types';

function FarmListCard({ farm }: { farm: Farm }) {
  const { t } = useTranslation();
  const deleteFarm = useDeleteFarm();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const statusTone = farmStatusTone(farm.status);

  const statusBorder: Record<string, string> = {
    green: 'border-l-emerald-500',
    yellow: 'border-l-amber-500',
    red: 'border-l-red-500',
    neutral: 'border-l-muted-foreground/30',
  };

  // Badge tanpa fill berwarna: surface netral; warna status hanya di dot neon.
  const statusDot: Record<string, string> = {
    green: 'bg-emerald-500 dark:bg-emerald-400',
    yellow: 'bg-amber-500 dark:bg-amber-400',
    red: 'bg-red-500 dark:bg-red-400',
    neutral: 'bg-muted-foreground/40',
  };

  return (
    <Card
      className={cn(
        'group relative h-full overflow-hidden border-l-4 p-0 transition-all hover:shadow-md',
        statusBorder[statusTone] ?? 'border-l-border',
      )}
    >
      {/* Strip pita dekoratif tipis di atas */}
      <div
        className={cn(
          'absolute right-0 top-0 h-1 w-1/3 rounded-bl-full',
          statusTone === 'green'
            ? 'bg-gradient-to-l from-emerald-500/20 to-transparent'
            : statusTone === 'yellow'
              ? 'bg-gradient-to-l from-amber-500/20 to-transparent'
              : statusTone === 'red'
                ? 'bg-gradient-to-l from-red-500/20 to-transparent'
                : 'bg-gradient-to-l from-muted-foreground/10 to-transparent',
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
                  className={cn('size-1.5 shrink-0 rounded-full', statusDot[statusTone] ?? 'bg-muted-foreground/40')}
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
        <div className="ml-9 mt-3 grid grid-cols-3 gap-2">
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
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            {t('farms.cardMenuDelete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('farms.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('farms.deleteDescription', { name: farm.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFarm.isPending}>
              {t('farms.deleteCancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              data-variant="destructive"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteFarm.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteFarm.mutate(farm.id, { onSuccess: () => setConfirmOpen(false) });
              }}
            >
              {t('farms.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function FarmsPage() {
  const { data, isLoading, error } = useFarms();
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');

  const farms = data?.items ?? [];
  const q = filter.trim().toLowerCase();
  const visibleFarms = q
    ? farms.filter(
        (f) =>
          (f.name || '').toLowerCase().includes(q) ||
          (f.location || '').toLowerCase().includes(q) ||
          (f.crop_type || '').toLowerCase().includes(q),
      )
    : farms;

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t('farms.searchPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-xl border-border bg-card pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive">{t('farms.errorLoad', { message: error.message })}</p>
      ) : visibleFarms.length === 0 ? (
        <p className="text-muted-foreground">
          {filter ? t('farms.emptyFiltered') : t('farms.empty')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleFarms.map((farm) => (
            <FarmListCard key={farm.id} farm={farm} />
          ))}
        </div>
      )}
    </div>
  );
}
