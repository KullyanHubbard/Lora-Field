import type { Farm } from '@/types';
import type { FarmStatusTone } from '@/features/dashboard/farmStatusHelpers';

export function filterMyFarms(farms: Farm[], filter: string): Farm[] {
  const q = filter.trim().toLowerCase();
  return q
    ? farms.filter(
        (farm) =>
          (farm.name || '').toLowerCase().includes(q) ||
          (farm.location || '').toLowerCase().includes(q) ||
          (farm.crop_type || '').toLowerCase().includes(q),
      )
    : farms;
}

export function getMyFarmStatusBorderClass(tone: FarmStatusTone): string {
  const statusBorder: Record<FarmStatusTone, string> = {
    green: 'border-l-emerald-500',
    yellow: 'border-l-amber-500',
    red: 'border-l-red-500',
    neutral: 'border-l-muted-foreground/30',
  };

  return statusBorder[tone] ?? 'border-l-border';
}

export function getMyFarmStatusDotClass(tone: FarmStatusTone): string {
  const statusDot: Record<FarmStatusTone, string> = {
    green: 'bg-emerald-500 dark:bg-emerald-400',
    yellow: 'bg-amber-500 dark:bg-amber-400',
    red: 'bg-red-500 dark:bg-red-400',
    neutral: 'bg-muted-foreground/40',
  };

  return statusDot[tone] ?? 'bg-muted-foreground/40';
}

export function getMyFarmStatusRibbonClass(tone: FarmStatusTone): string {
  if (tone === 'green') return 'bg-gradient-to-l from-emerald-500/20 to-transparent';
  if (tone === 'yellow') return 'bg-gradient-to-l from-amber-500/20 to-transparent';
  if (tone === 'red') return 'bg-gradient-to-l from-red-500/20 to-transparent';
  return 'bg-gradient-to-l from-muted-foreground/10 to-transparent';
}
