# Fix Farm Card Hover Border - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix white border issue on farm card hover by applying consistent `summary-subcard-interactive` class pattern.

**Architecture:** Replace hardcoded subcard styling with the established `summary-subcard-interactive` CSS class that handles hover border animation properly.

**Tech Stack:** Tailwind CSS v4, CSS custom class `.summary-subcard-interactive`

## Global Constraints

- Class `summary-subcard-interactive` already defined in `frontend/src/index.css`
- Reference pattern from `GatewayInfoCard.tsx` StatTile component
- Subcards must have: `border border-border` + `summary-subcard-interactive` + gradient background
- No changes to Card wrapper or other components

---

## File Structure

```
frontend/src/features/myFarms/components/MyFarmsCard.tsx  (modify: 3 subcards)
frontend/src/features/selectFarms/components/SelectFarmsList.tsx (verify: no changes needed)
```

---

## Reference Pattern

From `frontend/src/features/gateway/components/GatewayInfoCard.tsx` line 18:

```jsx
className="summary-subcard-interactive rounded-lg border border-border bg-gradient-to-b from-muted/50 to-transparent p-3"
```

CSS class in `frontend/src/index.css` lines 135-181:
- Adds white border on hover via `::before` pseudo-element
- Smooth 180ms transition for border-color
- Proper z-index handling for content overlay

---

## Task Right-Sizing

Each subcard update is independent and can be verified separately.

---

## Tasks

### Task 1: Update MyFarmsCard Subcards

**Files:**
- Modify: `frontend/src/features/myFarms/components/MyFarmsCard.tsx:41,47,53`

**Interfaces:**
- Consumes: Nothing (pure styling change)
- Produces: Same subcard data structure, visual fix only

- [ ] **Step 1: Update subcard 1 (Lokasi)**

In `MyFarmsCard.tsx`, change:
```jsx
<div className="rounded-lg bg-muted/40 p-2">
```
To:
```jsx
<div className="summary-subcard-interactive border border-border rounded-lg bg-gradient-to-b from-muted/50 to-transparent p-2">
```

- [ ] **Step 2: Update subcard 2 (Tanaman)**

In `MyFarmsCard.tsx`, change:
```jsx
<div className="rounded-lg bg-muted/40 p-2">
```
To:
```jsx
<div className="summary-subcard-interactive border border-border rounded-lg bg-gradient-to-b from-muted/50 to-transparent p-2">
```

- [ ] **Step 3: Update subcard 3 (Luas)**

In `MyFarmsCard.tsx`, change:
```jsx
<div className="rounded-lg bg-muted/40 p-2">
```
To:
```jsx
<div className="summary-subcard-interactive border border-border rounded-lg bg-gradient-to-b from-muted/50 to-transparent p-2">
```

- [ ] **Step 4: Verify SelectFarmsList**

Check `frontend/src/features/selectFarms/components/SelectFarmsList.tsx` - the `bg-muted/40 p-4` on line 16 is a container div, not a subcard. No changes needed.

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Verify in browser**

Open `http://localhost:5174` (or port from running dev server). Navigate to Farms/MyFarms page. Hover over farm cards - white border should appear smoothly on subcards, NOT on main card.

---

## Self-Review Checklist

1. **Spec coverage:** Task 1 covers all 3 subcards in MyFarmsCard
2. **Placeholder scan:** No placeholders - all code is complete
3. **Type consistency:** No type changes - purely visual

---

## Execution Handoff

Plan complete and saved to `frontend/docs/superpowers/plans/2026-07-09-farm-card-hover-fix.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** - Execute tasks with subagent review

**2. Inline Execution** - Execute tasks in this session using executing-plans

**Which approach?**
