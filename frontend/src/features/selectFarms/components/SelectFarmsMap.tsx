import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { SelectFarmsMapController } from './SelectFarmsMapController';
import { useSelectFarmsMapViewModel } from '@/features/selectFarms/useSelectFarmsMapViewModel';
import {
  configureSelectFarmsLeafletIcons,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
  SELECT_FARMS_DEFAULT_CENTER,
  SELECT_FARMS_DEFAULT_ZOOM,
  createColoredMarkerIcon,
} from '@/features/selectFarms/selectFarmsMapConfig';
import { getFarmMarkerColor, MARKER_COLORS } from '@/features/myFarms/farmColorStorage';
import type { Farm } from '@/types';

/** Convert MarkerColorId to hex color (fallback: warna default pertama, biru) */
function markerColorIdToValue(colorId: string): string {
  return (MARKER_COLORS.find((c) => c.id === colorId) ?? MARKER_COLORS[0]).value;
}

configureSelectFarmsLeafletIcons();

export function SelectFarmsMap({ farms }: { farms: Farm[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { points, positions } = useSelectFarmsMapViewModel(farms);

  return (
    <MapContainer
      center={SELECT_FARMS_DEFAULT_CENTER}
      zoom={SELECT_FARMS_DEFAULT_ZOOM}
      scrollWheelZoom={true}
      className="h-full w-full rounded-lg"
      aria-label={t('selectFarms.mapLabel')}
    >
      {/* Tile OpenStreetMap: gratis tanpa key (CARTO kini wajib API key). Server OSM
          dikelola relawan: atribusi wajib tampil dan pemakaian harus wajar. */}
      <TileLayer attribution={MAP_TILE_ATTRIBUTION} url={MAP_TILE_URL} />
      {points.map(({ farm, pos }) => (
        <Marker
          key={farm.id}
          position={pos}
          icon={createColoredMarkerIcon(markerColorIdToValue(getFarmMarkerColor(farm.id)))}
          eventHandlers={{ click: () => navigate(`/farms/${farm.id}`) }}
        >
          <Tooltip direction="top" offset={[0, -35]} opacity={1} permanent={false}>
            <span className="font-medium">{farm.name}</span>
          </Tooltip>
        </Marker>
      ))}
      <SelectFarmsMapController points={positions} />
    </MapContainer>
  );
}
