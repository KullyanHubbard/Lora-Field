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
