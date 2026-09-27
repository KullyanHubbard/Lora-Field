import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Tampilan awal seluruh Indonesia. Kalau user punya kebun, peta langsung fitBounds ke kebunnya.
export const SELECT_FARMS_DEFAULT_CENTER: [number, number] = [-2.5, 118];
export const SELECT_FARMS_DEFAULT_ZOOM = 5;

export const MAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Jeda sebelum invalidateSize, menunggu layout flex selesai mengukur container peta.
export const MAP_RESIZE_DELAY_MS = 200;

let leafletIconsConfigured = false;

export function configureSelectFarmsLeafletIcons() {
  if (leafletIconsConfigured) return;

  // Fix marker icon default Leaflet yang broken di bundler (Vite). `_getIconUrl`
  // merekonstruksi path aset secara internal dan menghasilkan 404 (pin jadi titik
  // kecil); hapus dulu, lalu set URL aset yang sudah di-resolve Vite.
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });
  leafletIconsConfigured = true;
}

/**
 * Create a Leaflet DivIcon with colored pin.
 * `color` boleh CSS variable; dipasang lewat style karena atribut fill SVG tidak membaca var().
 */
export function createColoredMarkerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <svg width="25" height="41" viewBox="0 0 25 41" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 21.563 12.5 41 12.5 41C12.5 41 25 21.563 25 12.5C25 5.596 19.404 0 12.5 0Z" style="fill: ${color}"/>
        <circle cx="12.5" cy="12.5" r="5" style="fill: var(--marker-dot)"/>
      </svg>
    `,
    iconSize: [25, 41],
    iconAnchor: [12.5, 41],
    popupAnchor: [0, -41],
  });
}
