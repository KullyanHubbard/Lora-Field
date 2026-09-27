import { useEffect } from 'react';
import L, { type Map as LeafletMap } from 'leaflet';
import { MAP_RESIZE_DELAY_MS } from '@/features/selectFarms/selectFarmsMapConfig';

export function useSelectFarmsMapController(map: LeafletMap, points: [number, number][]) {
  useEffect(() => {
    const invalidate = () => map.invalidateSize({ animate: false });
    const raf = requestAnimationFrame(() => {
      invalidate();
      window.setTimeout(invalidate, MAP_RESIZE_DELAY_MS);
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
}
