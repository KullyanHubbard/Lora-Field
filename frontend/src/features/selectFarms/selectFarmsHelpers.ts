import type { Farm } from '@/types';

export interface SelectFarmMapPoint {
  farm: Farm;
  pos: [number, number];
}

export function getShortFarmLocation(location: string) {
  return location.length > 30 ? `${location.slice(0, 30)}…` : location;
}

export function getSelectFarmMapPoints(farms: Farm[]): SelectFarmMapPoint[] {
  return farms
    .filter((farm) => Number.isFinite(Number(farm.latitude)) && Number.isFinite(Number(farm.longitude)))
    .map((farm) => ({
      farm,
      pos: [Number(farm.latitude), Number(farm.longitude)] as [number, number],
    }));
}
