import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

const DEFAULT_CENTER = [-7.79, 110.3];
const DEFAULT_ZOOM = 9;

function buildFarmIcon(farm, selectedId) {
  const isSelected = farm.id === selectedId ? ' is-selected' : '';
  // status gateway tidak diketahui di list endpoint — default online supaya
  // marker kelihatan hijau. Status real datang dari /summary di Fase 4.
  const statusClass = 'lf-marker-farm-online';
  return L.divIcon({
    className: '',
    html: `<div class="lf-marker lf-marker-farm ${statusClass}${isSelected}"><img src="/static/img/logo.svg" class="marker-logo" alt=""></div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  });
}

function buildPopupHTML(farm) {
  // Escape minimal untuk HTML string (Leaflet popup butuh string, bukan JSX).
  const safeName = String(farm.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<div class="lf-popup-inner">
    <strong class="lf-pop-title">${safeName}</strong>
    <button class="btn btn-primary btn-sm lf-pop-action" type="button" data-farm-id="${encodeURIComponent(farm.id)}">Buka Dashboard</button>
  </div>`;
}

/**
 * Peta interaktif kebun dengan Leaflet.
 *
 * Props:
 *   farms        — array farm (perlu lat & lng untuk plotting)
 *   selectedId   — id farm yang sedang dipilih (kasih highlight marker)
 *   onSelect(id) — callback klik marker
 *   onOpen(id)   — callback klik tombol "Buka Dashboard" di popup
 */
export function FarmMap({ farms, selectedId, onSelect, onOpen }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  // Init map sekali saja.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const container = containerRef.current;
    const map = L.map(container, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;

    // Bug fix: tile setengah load kalau container size berubah setelah init
    // (mis. parent flex/grid masih layout, font CDN belum load, sidebar
    // animation, dll). Solusi standar Leaflet: panggil invalidateSize()
    // begitu container sudah final + observe resize untuk perubahan
    // berikutnya (resize window, devtools dock, dll).
    const invalidate = () => map.invalidateSize({ animate: false });

    // Beberapa frame pertama: paksa recalculate setelah CSS layout settled.
    const rafId = requestAnimationFrame(() => {
      invalidate();
      // Second pass untuk kasus font/CDN yang ubah ukuran setelah load.
      setTimeout(invalidate, 200);
    });

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(invalidate);
      resizeObserver.observe(container);
    }
    window.addEventListener('resize', invalidate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', invalidate);
      if (resizeObserver) resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Re-render markers tiap kali farms / selectedId berubah.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const plottable = farms.filter(
      (f) => Number.isFinite(Number(f.latitude)) && Number.isFinite(Number(f.longitude)),
    );

    plottable.forEach((farm) => {
      const marker = L.marker([Number(farm.latitude), Number(farm.longitude)], {
        icon: buildFarmIcon(farm, selectedId),
      })
        .bindPopup(buildPopupHTML(farm), { className: 'lf-popup', maxWidth: 280 })
        .on('click', () => {
          if (onSelect) onSelect(farm.id);
        });
      layer.addLayer(marker);
    });

    if (plottable.length) {
      const bounds = L.latLngBounds(
        plottable.map((f) => [Number(f.latitude), Number(f.longitude)]),
      );
      map.fitBounds(bounds.pad(0.22));
    }
  }, [farms, selectedId, onSelect]);

  // Event delegation: klik "Buka Dashboard" di popup → onOpen(id).
  useEffect(() => {
    function handler(event) {
      const btn = event.target.closest('.lf-pop-action');
      if (!btn) return;
      event.preventDefault();
      const id = decodeURIComponent(btn.dataset.farmId || '');
      if (id && onOpen) onOpen(id);
    }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [onOpen]);

  return <div ref={containerRef} className="field-osm-map farm-osm-map" aria-label="Peta lokasi kebun" />;
}
