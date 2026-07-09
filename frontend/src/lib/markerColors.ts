/**
 * Global utility for generating unique marker colors.
 * Uses HSL for optimal color distribution.
 * Caches colors by entity ID for consistency.
 */

const colorCache = new Map<string, string>();

/**
 * Generate a unique HSL color.
 * Saturation and lightness are fixed for good visibility.
 */
function generateHSLColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 65 + Math.floor(Math.random() * 20); // 65-85%
  const lightness = 45 + Math.floor(Math.random() * 15); // 45-60%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Get a unique color for an entity ID.
 * Same ID always returns the same color.
 * Different IDs get different colors.
 */
export function getUniqueColor(entityId: string): string {
  // Check cache first
  if (colorCache.has(entityId)) {
    return colorCache.get(entityId)!;
  }

  // Generate new unique color
  let color: string;
  let attempts = 0;
  const maxAttempts = 100;

  // Keep generating until we find a color not in use
  do {
    color = generateHSLColor();
    attempts++;
  } while ([...colorCache.values()].includes(color) && attempts < maxAttempts);

  // If we somehow ran out of unique colors, just use random
  colorCache.set(entityId, color);
  return color;
}

/**
 * Clear the color cache (useful for testing or reset).
 */
export function clearMarkerColorCache(): void {
  colorCache.clear();
}
