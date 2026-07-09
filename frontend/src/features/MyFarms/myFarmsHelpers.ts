import type { Farm } from '@/types';

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
