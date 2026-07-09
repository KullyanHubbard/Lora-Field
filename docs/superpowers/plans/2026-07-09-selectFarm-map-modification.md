# Global Unique Marker Colors Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create global utility for unique random marker colors, unlimited palette.

**Architecture:** Create `frontend/src/lib/markerColors.ts` with HSL-based color generation. Each call generates a unique color. Store color mapping by entity ID in memory/cache for consistency.

---

## Global Constraints

- Use HSL color space for better color distribution
- Random hue (0-360), fixed saturation/lightness for visibility
- Global function accessible from any feature

---

## File Structure

```
frontend/src/lib/
├── markerColors.ts    (CREATE: global unique color utility)
├── index.ts           (MODIFY: export new utility)

frontend/src/features/selectFarms/
├── selectFarmsMapConfig.ts    (MODIFY: use global utility)
```

---

### Task 1: Create Global Marker Color Utility

**Files:**
- Create: `frontend/src/lib/markerColors.ts`

**Interfaces:**
- Produces: `getUniqueColor(entityId: string): string` - returns hex color

- [ ] **Step 1: Create markerColors.ts**

```ts
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
```

- [ ] **Step 2: Export from lib/index.ts**

Add to `frontend/src/lib/index.ts`:
```ts
export * from './markerColors';
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/markerColors.ts
git add frontend/src/lib/index.ts
git commit -m "feat(lib): add global unique marker color utility"
```

---

### Task 2: Update SelectFarms to Use Global Utility

**Files:**
- Modify: `frontend/src/features/selectFarms/selectFarmsMapConfig.ts`

- [ ] **Step 1: Read current selectFarmsMapConfig.ts**

Current colored marker code (lines 21-68):
```ts
// Color palette for farm markers - visually distinct colors
export const FARM_MARKER_COLORS = [
  '#10B981', // emerald
  // ... 10 colors
] as const;

// Delete old color functions and replace with:
export function getFarmMarkerColor(farmId: string): string {
  // Uses local palette - needs to be replaced
}

export function createColoredMarkerIcon(color: string): L.DivIcon {
  // Uses inline SVG with color
}
```

- [ ] **Step 2: Replace with global utility**

Remove the old `FARM_MARKER_COLORS` and `getFarmMarkerColor`, then update to:

```ts
import { getUniqueColor } from '@/lib';

// Remove FARM_MARKER_COLORS constant

// Remove getFarmMarkerColor function - use getUniqueColor directly

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
```

- [ ] **Step 3: Update SelectFarmsMap.tsx to use global function**

Change import from `getFarmMarkerColor` to `getUniqueColor`:
```tsx
import {
  configureSelectFarmsLeafletIcons,
  SELECT_FARMS_DEFAULT_CENTER,
  SELECT_FARMS_DEFAULT_ZOOM,
  createColoredMarkerIcon,
} from '../selectFarmsMapConfig';
import { getUniqueColor } from '@/lib';
```

Change marker creation:
```tsx
icon={createColoredMarkerIcon(getUniqueColor(farm.id))}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/SelectFarms/selectFarmsMapConfig.ts
git add frontend/src/features/SelectFarms/components/SelectFarmsMap.tsx
git commit -m "refactor(selectFarms): use global unique color utility"
```

---

## Summary

| Task | File | Changes |
|------|------|---------|
| 1 | `lib/markerColors.ts` | CREATE: global unique color utility |
| 1 | `lib/index.ts` | Export new utility |
| 2 | `selectFarmsMapConfig.ts` | Remove old palette, use global |
| 2 | `SelectFarmsMap.tsx` | Use `getUniqueColor` from lib |

## Verification Checklist

- [ ] Each farm gets a unique color
- [ ] Same farm always gets same color (cached)
- [ ] Colors are visually distinct (HSL distribution)
- [ ] `getUniqueColor` available globally from `@/lib`
- [ ] Can be reused in any feature (not just selectFarms)
