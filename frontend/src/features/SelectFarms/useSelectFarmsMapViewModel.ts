import { useMemo } from 'react';
import { getSelectFarmMapPoints } from './selectFarmsHelpers';
import type { Farm } from '@/types';

export function useSelectFarmsMapViewModel(farms: Farm[]) {
  const points = useMemo(() => getSelectFarmMapPoints(farms), [farms]);
  const positions = useMemo(() => points.map((point) => point.pos), [points]);

  return { points, positions };
}
