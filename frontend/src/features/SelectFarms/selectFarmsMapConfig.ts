import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

export const SELECT_FARMS_DEFAULT_CENTER: [number, number] = [-7.79, 110.3];
export const SELECT_FARMS_DEFAULT_ZOOM = 9;

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
 * Uses inline SVG for flexibility.
 */
export function createColoredMarkerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <svg width="25" height="41" viewBox="0 0 25 41" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 21.563 12.5 41 12.5 41C12.5 41 25 21.563 25 12.5C25 5.596 19.404 0 12.5 0Z" fill="${color}"/>
        <circle cx="12.5" cy="12.5" r="5" fill="white"/>
      </svg>
    `,
    iconSize: [25, 41],
    iconAnchor: [12.5, 41],
    popupAnchor: [0, -41],
  });
}
