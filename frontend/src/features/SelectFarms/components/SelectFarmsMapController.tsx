import { useMap } from 'react-leaflet';
import { useSelectFarmsMapController } from '../hooks/useSelectFarmsMapController';

interface SelectFarmsMapControllerProps {
  points: [number, number][];
}

export function SelectFarmsMapController({ points }: SelectFarmsMapControllerProps) {
  const map = useMap();
  useSelectFarmsMapController(map, points);

  return null;
}
