import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { SelectFarmsMapController } from './SelectFarmsMapController';
import { useSelectFarmsMapViewModel } from '../hooks/useSelectFarmsMapViewModel';
import {
  configureSelectFarmsLeafletIcons,
  SELECT_FARMS_DEFAULT_CENTER,
  SELECT_FARMS_DEFAULT_ZOOM,
} from '../utils/selectFarmsMapConfig';
import type { Farm } from '@/types';

configureSelectFarmsLeafletIcons();

export function SelectFarmsMap({ farms }: { farms: Farm[] }) {
  const { points, positions } = useSelectFarmsMapViewModel(farms);

  return (
    <MapContainer
      center={SELECT_FARMS_DEFAULT_CENTER}
      zoom={SELECT_FARMS_DEFAULT_ZOOM}
      scrollWheelZoom={false}
      className="h-[320px] w-full rounded-lg sm:h-[420px] lg:h-[560px] xl:h-[680px]"
      aria-label="Peta lokasi kebun"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {points.map(({ farm, pos }) => (
        <Marker key={farm.id} position={pos}>
          <Popup>
            <div className="flex flex-col gap-1">
              <strong>{farm.name}</strong>
              <Link to={`/farms/${farm.id}`} className="text-primary hover:underline">
                Buka Ringkasan Kebun
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
      <SelectFarmsMapController points={positions} />
    </MapContainer>
  );
}
