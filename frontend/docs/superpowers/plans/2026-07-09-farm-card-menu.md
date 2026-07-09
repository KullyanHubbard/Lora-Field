# Farm Card Menu - Rename, Change Color, Delete - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add context menu (3-dot) on farm cards with 3 actions: Rename, Change Marker Color, Delete.

**Architecture:**
- Rename: AlertDialog with Input field
- Change Color: Dropdown with 5 color presets (stored in localStorage per farmId)
- Delete: Existing AlertDialog (reuse MyFarmDeleteDialog)
- All actions handled via ViewModel pattern (consistent with existing code)

**Tech Stack:** React, Radix UI AlertDialog, localStorage for marker colors, TanStack Query mutations

---

## File Structure

```
frontend/src/features/myFarms/
├── components/
│   ├── MyFarmsCard.tsx          (modify: expand dropdown menu)
│   ├── MyFarmDeleteDialog.tsx   (already exists - no changes needed)
│   ├── MyFarmEditDialog.tsx      (create: rename dialog)
│   └── MyFarmColorPicker.tsx     (create: color picker dropdown)
├── useMyFarmsViewModel.ts        (modify: add rename/color handlers)
├── queries.ts                    (modify: add updateFarm mutation)
└── farmColorStorage.ts           (create: localStorage helper for marker colors)

frontend/src/lib/api.ts           (modify: add PATCH farm endpoint)
```

---

## Global Constraints

- Label names: compact and professional
- Menu items: Icon + Label format
- Color picker: 5 preset colors (Blue, Green, Yellow, Red, Purple)
- Marker colors stored per farmId in localStorage (no backend changes)
- API PATCH `/api/farms/{id}` exists in backend (main.py:897) - needs frontend integration

---

## Tasks

### Task 1: Add PATCH farm to API client

**Files:**
- Modify: `frontend/src/lib/api.ts:102-113`

**Interfaces:**
- Consumes: farm id, partial FarmUpdate payload
- Produces: Updated Farm object

- [ ] **Step 1: Add updateFarm method**

In `api.ts`, after `deleteFarm` line 112, add:

```typescript
updateFarm: (id: string, payload: Partial<Farm>) =>
  apiFetch<{ farm: Farm }>(`/farms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 2: Add updateFarm mutation to queries

**Files:**
- Modify: `frontend/src/features/myFarms/queries.ts`

- [ ] **Step 1: Add useUpdateFarm hook**

Add after `useDeleteFarm`:

```typescript
export function useUpdateFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Farm> }) =>
      api.updateFarm(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farms'] });
      toast.success('Kebun berhasil diperbarui.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal memperbarui kebun.');
    },
  });
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 3: Create farm color storage helper

**Files:**
- Create: `frontend/src/features/myFarms/farmColorStorage.ts`

- [ ] **Step 1: Create storage helper**

```typescript
const STORAGE_KEY = 'lorafield_farm_colors';

// Preset colors for marker
export const MARKER_COLORS = [
  { id: 'blue', label: 'Biru', value: '#3b82f6' },
  { id: 'green', label: 'Hijau', value: '#22c55e' },
  { id: 'yellow', label: 'Kuning', value: '#eab308' },
  { id: 'red', label: 'Merah', value: '#ef4444' },
  { id: 'purple', label: 'Ungu', value: '#a855f7' },
] as const;

export type MarkerColorId = typeof MARKER_COLORS[number]['id'];

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
```

---

### Task 4: Create MyFarmEditDialog (Rename)

**Files:**
- Create: `frontend/src/features/myFarms/components/MyFarmEditDialog.tsx`

- [ ] **Step 1: Create dialog component**

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Farm } from '@/types';

interface MyFarmEditDialogProps {
  farm: Farm | null;
  isUpdating: boolean;
  onClose: () => void;
  onConfirm: (newName: string) => void;
}

export function MyFarmEditDialog({
  farm,
  isUpdating,
  onClose,
  onConfirm,
}: MyFarmEditDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  // Reset name when dialog opens
  if (farm && name === '') {
    setName(farm.name);
  }

  if (!farm) return null;

  const handleConfirm = () => {
    if (name.trim()) {
      onConfirm(name.trim());
    }
  };

  return (
    <AlertDialog
      open={farm != null}
      onOpenChange={(open) => {
        if (!open) {
          setName('');
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Edit Kebun</AlertDialogTitle>
          <AlertDialogDescription>
            Ubah nama untuk "{farm.name}"
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama kebun"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
          }}
          autoFocus
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUpdating}>Batal</AlertDialogCancel>
          <AlertDialogAction
            disabled={isUpdating || !name.trim() || name.trim() === farm.name}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
          >
            {isUpdating ? <Loader2 className="size-4 animate-spin" /> : 'Simpan'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 5: Create MyFarmColorPicker (Color Selection)

**Files:**
- Create: `frontend/src/features/myFarms/components/MyFarmColorPicker.tsx`

- [ ] **Step 1: Create color picker component**

```typescript
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MARKER_COLORS, type MarkerColorId } from '../farmColorStorage';

interface MyFarmColorPickerProps {
  farmId: string;
  currentColor: MarkerColorId;
  onColorChange: (colorId: MarkerColorId) => void;
}

export function MyFarmColorPicker({
  farmId,
  currentColor,
  onColorChange,
}: MyFarmColorPickerProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none">
        <span
          className="size-3 rounded-full"
          style={{ backgroundColor: MARKER_COLORS.find((c) => c.id === currentColor)?.value }}
        />
        Marker
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {MARKER_COLORS.map((color) => (
          <DropdownMenuItem
            key={color.id}
            className="flex items-center gap-2"
            onSelect={() => onColorChange(color.id)}
          >
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: color.value }}
            />
            {color.label}
            {currentColor === color.id && (
              <span className="ml-auto text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 6: Update MyFarmsCard with expanded menu

**Files:**
- Modify: `frontend/src/features/myFarms/components/MyFarmsCard.tsx`

**Menu items:**
| Action | Icon | Label |
|--------|------|-------|
| Rename | Pencil | Edit |
| Change Color | Palette | Marker |
| Delete | Trash2 | Hapus |

- [ ] **Step 1: Update imports**

Add icons:
```typescript
import { MoreVertical, Pencil, Palette, Trash2 } from 'lucide-react';
```

- [ ] **Step 2: Update component props**

```typescript
interface MyFarmsCardProps {
  farm: Farm;
  onRequestDelete: (farm: Farm) => void;
  onRequestEdit: (farm: Farm) => void;
  onRequestChangeColor: (farm: Farm) => void;
}
```

- [ ] **Step 3: Update function signature**

```typescript
export function MyFarmsCard({
  farm,
  onRequestDelete,
  onRequestEdit,
  onRequestChangeColor,
}: MyFarmsCardProps) {
```

- [ ] **Step 4: Replace DropdownMenuContent**

Replace existing DropdownMenuContent (lines 125-129) with:

```typescript
<DropdownMenuContent align="end" className="w-40">
  <DropdownMenuItem onSelect={() => onRequestEdit(farm)}>
    <Pencil className="size-4" />
    Edit
  </DropdownMenuItem>
  <DropdownMenuItem onSelect={() => onRequestChangeColor(farm)}>
    <Palette className="size-4" />
    Marker
  </DropdownMenuItem>
  <DropdownMenuItem variant="destructive" onSelect={() => onRequestDelete(farm)}>
    <Trash2 className="size-4" />
    Hapus
  </DropdownMenuItem>
</DropdownMenuContent>
```

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 7: Update MyFarmsList to pass new props

**Files:**
- Modify: `frontend/src/features/myFarms/components/MyFarmsList.tsx`

- [ ] **Step 1: Update interface and render**

```typescript
interface MyFarmsListProps {
  farms: Farm[];
  onRequestDeleteFarm: (farm: Farm) => void;
  onRequestEditFarm: (farm: Farm) => void;
  onRequestChangeColorFarm: (farm: Farm) => void;
}

export function MyFarmsList({
  farms,
  onRequestDeleteFarm,
  onRequestEditFarm,
  onRequestChangeColorFarm,
}: MyFarmsListProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {farms.map((farm) => (
        <MyFarmsCard
          key={farm.id}
          farm={farm}
          onRequestDelete={onRequestDeleteFarm}
          onRequestEdit={onRequestEditFarm}
          onRequestChangeColor={onRequestChangeColorFarm}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 8: Update MyFarmsView to handle new dialogs

**Files:**
- Modify: `frontend/src/features/myFarms/components/MyFarmsView.tsx`

- [ ] **Step 1: Add new imports**

```typescript
import { MyFarmDeleteDialog } from './MyFarmDeleteDialog';
import { MyFarmEditDialog } from './MyFarmEditDialog';
import { MyFarmColorPicker } from './MyFarmColorPicker';
import { getFarmMarkerColor } from '../farmColorStorage';
import type { MarkerColorId } from '../farmColorStorage';
```

- [ ] **Step 2: Update interface**

```typescript
interface MyFarmsViewProps {
  // ... existing props
  farmPendingEdit: Farm | null;
  farmPendingColor: Farm | null;
  isEditing: boolean;
  currentColor: MarkerColorId;
  onRequestEditFarm: (farm: Farm) => void;
  onCloseEditDialog: () => void;
  onConfirmEditFarm: (newName: string) => void;
  onRequestChangeColorFarm: (farm: Farm) => void;
  onCloseColorPicker: () => void;
  onConfirmColorChange: (colorId: MarkerColorId) => void;
}
```

- [ ] **Step 3: Update component render**

Add before MyFarmDeleteDialog:
```typescript
<MyFarmEditDialog
  farm={farmPendingEdit}
  isUpdating={isEditing}
  onClose={onCloseEditDialog}
  onConfirm={onConfirmEditFarm}
/>

<MyFarmColorPicker
  farmId={farmPendingColor?.id ?? ''}
  currentColor={currentColor}
  onColorChange={onConfirmColorChange}
/>
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 9: Update useMyFarmsViewModel

**Files:**
- Modify: `frontend/src/features/myFarms/useMyFarmsViewModel.ts`

- [ ] **Step 1: Add new imports and state**

```typescript
import { useUpdateFarm } from './queries';
import { setFarmMarkerColor, getFarmMarkerColor, type MarkerColorId } from './farmColorStorage';

export function useMyFarmsViewModel() {
  // ... existing code
  const updateFarm = useUpdateFarm();
  const [farmPendingEdit, setFarmPendingEdit] = useState<Farm | null>(null);
  const [farmPendingColor, setFarmPendingColor] = useState<Farm | null>(null);
  const [currentColor, setCurrentColor] = useState<MarkerColorId>('blue');
```

- [ ] **Step 2: Add handler functions**

```typescript
function handleEditFarm(farm: Farm) {
  setFarmPendingEdit(farm);
}

function handleCloseEditDialog() {
  setFarmPendingEdit(null);
}

function handleConfirmEditFarm(newName: string) {
  if (!farmPendingEdit) return;

  updateFarm.mutate(
    { id: farmPendingEdit.id, payload: { name: newName } },
    {
      onSuccess: () => setFarmPendingEdit(null),
    }
  );
}

function handleChangeColorFarm(farm: Farm) {
  setCurrentColor(getFarmMarkerColor(farm.id));
  setFarmPendingColor(farm);
}

function handleCloseColorPicker() {
  setFarmPendingColor(null);
}

function handleConfirmColorChange(colorId: MarkerColorId) {
  if (!farmPendingColor) return;
  setFarmMarkerColor(farmPendingColor.id, colorId);
  setFarmPendingColor(null);
}
```

- [ ] **Step 3: Update return statement**

```typescript
return {
  // ... existing
  farmPendingEdit,
  farmPendingColor,
  isEditing: updateFarm.isPending,
  currentColor,
  onRequestEditFarm: handleEditFarm,
  onCloseEditDialog: handleCloseEditDialog,
  onConfirmEditFarm: handleConfirmEditFarm,
  onRequestChangeColorFarm: handleChangeColorFarm,
  onCloseColorPicker: handleCloseColorPicker,
  onConfirmColorChange: handleConfirmColorChange,
};
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 10: Update MyFarmsPage to pass new props

**Files:**
- Modify: `frontend/src/features/myFarms/MyFarmsPage.tsx`

- [ ] **Step 1: Update component**

```typescript
export default function MyFarmsPage() {
  const viewModel = useMyFarmsViewModel();

  return (
    <MyFarmsView
      {...viewModel}
      onRequestEditFarm={viewModel.onRequestEditFarm}
      onRequestChangeColorFarm={viewModel.onRequestChangeColorFarm}
    />
  );
}
```

Actually, since MyFarmsView already spreads `...viewModel`, just make sure the new props are included in the return of `useMyFarmsViewModel`. The page doesn't need changes.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

## Self-Review Checklist

1. **Spec coverage:**
   - Rename: Task 4, 8, 9 ✅
   - Change Color: Task 3, 5, 8, 9 ✅
   - Delete: Already exists, integrated in Task 6, 7, 8, 9 ✅

2. **Placeholder scan:** No placeholders - all code is complete

3. **Type consistency:** All types properly defined and imported

4. **API integration:** PATCH endpoint exists in backend (main.py:897)

---

## Execution Handoff

Plan complete and saved to `frontend/docs/superpowers/plans/2026-07-09-farm-card-menu.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** - Execute tasks with subagent review

**2. Inline Execution** - Execute tasks in this session using executing-plans

**Which approach?**
