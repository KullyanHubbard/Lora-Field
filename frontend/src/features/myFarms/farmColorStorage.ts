const STORAGE_KEY = 'lorafield_farm_colors';

// Preset colors for marker - translations handled by i18n (markerColor.{id})
export const MARKER_COLORS = [
  { id: 'blue', value: '#3b82f6' },
  { id: 'green', value: '#22c55e' },
  { id: 'yellow', value: '#eab308' },
  { id: 'red', value: '#ef4444' },
  { id: 'purple', value: '#a855f7' },
  { id: 'orange', value: '#f97316' },
  { id: 'pink', value: '#ec4899' },
  { id: 'cyan', value: '#06b6d4' },
  { id: 'brown', value: '#a16207' },
  { id: 'gray', value: '#6b7280' },
  { id: 'black', value: '#1f2937' },
  { id: 'lime', value: '#84cc16' },
  { id: 'indigo', value: '#6366f1' },
  { id: 'amber', value: '#f59e0b' },
  { id: 'rose', value: '#f43f5e' },
  { id: 'teal', value: '#14b8a6' },
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
