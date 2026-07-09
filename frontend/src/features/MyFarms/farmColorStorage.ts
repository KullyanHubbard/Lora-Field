const STORAGE_KEY = 'lorafield_farm_colors';

// Preset colors for marker
export const MARKER_COLORS = [
  { id: 'blue', label: 'Biru', value: '#3b82f6' },
  { id: 'green', label: 'Hijau', value: '#22c55e' },
  { id: 'yellow', label: 'Kuning', value: '#eab308' },
  { id: 'red', label: 'Merah', value: '#ef4444' },
  { id: 'purple', label: 'Ungu', value: '#a855f7' },
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
