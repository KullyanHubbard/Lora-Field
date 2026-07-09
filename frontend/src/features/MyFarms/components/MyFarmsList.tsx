import { MyFarmsCard } from './MyFarmsCard';
import type { Farm } from '@/types';

interface MyFarmsListProps {
  farms: Farm[];
  onRequestDeleteFarm: (farm: Farm) => void;
  onRequestEditFarm: (farm: Farm) => void;
  onRequestChangeColorFarm: (farm: Farm) => void;
}

export function MyFarmsList({
  farms,
  onRequestDeleteFarm,
  onRequestEditFarm,
  onRequestChangeColorFarm,
}: MyFarmsListProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {farms.map((farm) => (
        <MyFarmsCard
          key={farm.id}
          farm={farm}
          onRequestDelete={onRequestDeleteFarm}
          onRequestEdit={onRequestEditFarm}
          onRequestChangeColor={onRequestChangeColorFarm}
        />
      ))}
    </div>
  );
}
