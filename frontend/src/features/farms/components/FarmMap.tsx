import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import type { Farm } from '@/types';

// Fix marker icon default Leaflet yang broken di bundler (Vite). `_getIconUrl`
// merekonstruksi path aset secara internal dan menghasilkan 404 (pin jadi titik
// kecil); hapus dulu, lalu set URL aset yang sudah di-resolve Vite.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

const DEFAULT_CENTER: [number, number] = [-7.79, 110.3];
const DEFAULT_ZOOM = 9;

// Leaflet tidak auto-resize di container flex/grid. invalidateSize() begitu layout
// settled + observe resize. fitBounds ke semua marker. Pakai useMap (idiomatik
// react-leaflet), bukan manipulasi DOM manual.
function MapController({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => map.invalidateSize({ animate: false });
    const raf = requestAnimationFrame(() => {
      invalidate();
      window.setTimeout(invalidate, 200);
    });
    window.addEventListener('resize', invalidate);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(invalidate);
      ro.observe(map.getContainer());
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', invalidate);
      ro?.disconnect();
    };
  }, [map]);

  useEffect(() => {
    if (points.length) {
      map.fitBounds(L.latLngBounds(points).pad(0.22));
    }
  }, [map, points]);

  return null;
}

export function FarmMap({ farms }: { farms: Farm[] }) {
  const plottable = useMemo(
    () =>
      farms
        .filter((f) => Number.isFinite(Number(f.latitude)) && Number.isFinite(Number(f.longitude)))
        .map((f) => ({
          farm: f,
          pos: [Number(f.latitude), Number(f.longitude)] as [number, number],
        })),
    [farms],
  );
  const positions = useMemo(() => plottable.map((p) => p.pos), [plottable]);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom={false}
      className="h-[749px] w-full rounded-lg"
      aria-label="Peta lokasi kebun"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {plottable.map(({ farm, pos }) => (
        <Marker key={farm.id} position={pos}>
          <Popup>
            <div className="flex flex-col gap-1">
              <strong>{farm.name}</strong>
              <Link to={`/farms/${farm.id}`} className="text-primary hover:underline">
                Buka Dashboard
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
      <MapController points={positions} />
    </MapContainer>
  );
}
