const STORAGE_KEY = 'lorafield_farm_colors';

// Preset warna marker; nilainya CSS variable --marker-* di index.css.
// Label diterjemahkan lewat i18n (markerColor.{id}).
export const MARKER_COLORS = [
  { id: 'blue', value: 'var(--marker-blue)' },
  { id: 'green', value: 'var(--marker-green)' },
  { id: 'yellow', value: 'var(--marker-yellow)' },
  { id: 'red', value: 'var(--marker-red)' },
  { id: 'purple', value: 'var(--marker-purple)' },
  { id: 'orange', value: 'var(--marker-orange)' },
  { id: 'pink', value: 'var(--marker-pink)' },
  { id: 'cyan', value: 'var(--marker-cyan)' },
  { id: 'brown', value: 'var(--marker-brown)' },
  { id: 'gray', value: 'var(--marker-gray)' },
  { id: 'black', value: 'var(--marker-black)' },
  { id: 'lime', value: 'var(--marker-lime)' },
  { id: 'indigo', value: 'var(--marker-indigo)' },
  { id: 'amber', value: 'var(--marker-amber)' },
  { id: 'rose', value: 'var(--marker-rose)' },
  { id: 'teal', value: 'var(--marker-teal)' },
] as const;

export type MarkerColorId = (typeof MARKER_COLORS)[number]['id'];

function getStoredColors(): Record<string, MarkerColorId> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveColor(farmId: string, colorId: MarkerColorId) {
  const colors = getStoredColors();
  colors[farmId] = colorId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
}

export function getFarmMarkerColor(farmId: string): MarkerColorId {
  return getStoredColors()[farmId] ?? 'blue';
}

export function setFarmMarkerColor(farmId: string, colorId: MarkerColorId) {
  saveColor(farmId, colorId);
}
