/**
 * Global utility for generating unique marker colors.
 * Uses deterministic hash to ensure same ID always gets same color.
 * Colors are vivid (high saturation, medium-high lightness).
 */

/**
 * Simple hash function for strings.
 * Returns a consistent integer for the same input.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get a unique color for an entity ID.
 * Same ID always returns the same color (deterministic).
 * Uses HSL with vivid colors (high saturation, good lightness).
 */
export function getUniqueColor(entityId: string): string {
  const hash = hashString(entityId);

  // Hue: full 360 spectrum based on hash
  const hue = hash % 360;

  // Vivid colors: high saturation (85%), medium lightness (50%)
  // This creates vibrant, easily distinguishable colors
  const saturation = 85;
  const lightness = 50;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Clear the color cache (not needed anymore - deterministic).
 */
export function clearMarkerColorCache(): void {
  // No-op: colors are now deterministic, no cache needed
}
