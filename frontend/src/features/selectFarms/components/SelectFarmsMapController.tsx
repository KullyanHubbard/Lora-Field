import { useMap } from 'react-leaflet';
import { useSelectFarmsMapController } from '@/features/selectFarms/useSelectFarmsMapController';

interface SelectFarmsMapControllerProps {
  points: [number, number][];
}

export function SelectFarmsMapController({ points }: SelectFarmsMapControllerProps) {
  const map = useMap();
  useSelectFarmsMapController(map, points);

  return null;
}
