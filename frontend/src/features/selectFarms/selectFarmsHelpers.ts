import type { Farm } from '@/types';

interface SelectFarmMapPoint {
  farm: Farm;
  pos: [number, number];
}

export function getSelectFarmMapPoints(farms: Farm[]): SelectFarmMapPoint[] {
  return farms
    .filter(
      (farm) => Number.isFinite(Number(farm.latitude)) && Number.isFinite(Number(farm.longitude)),
    )
    .map((farm) => ({
      farm,
      pos: [Number(farm.latitude), Number(farm.longitude)] as [number, number],
    }));
}
