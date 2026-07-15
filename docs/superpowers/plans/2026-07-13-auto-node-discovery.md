# Auto Node Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement auto node discovery — nodes automatically registered when gateway connects or when sensor data arrives, without manual user intervention.

**Architecture:** Gateway-centric with self-registration fallback. User only provides gateway_id when creating farm; nodes auto-appear when gateway registers or when sensor data arrives.

**Tech Stack:** Backend: FastAPI + SQLite. Frontend: React 19 + TypeScript + TanStack Query + Tailwind v4.

---

## Global Constraints

- Backend: Do not modify existing endpoints except where specified
- Frontend: Maintain existing UI/UX patterns, do not add new dependencies
- All backend changes must be backward compatible
- Mock data remains ON during development, can be toggled via `MOCK_FARM_SCENARIO.enabled`
- Use existing project structure and naming conventions

---

## File Structure

```
backend/app/
├── main.py                      # Add new endpoints
├── database.py                  # Add migration for gateway_id column
└── models/schemas.py            # Add Pydantic models

frontend/src/
├── features/
│   ├── addFarm/
│   │   ├── AddFarmPage.tsx     # Remove gatewayId field
│   │   ├── hooks/useAddFarm.ts # Remove gatewayId state
│   │   └── queries.ts          # Update payload type
│   ├── addNode/
│   │   └── AddNodePage.tsx     # DELETE entire feature
│   ├── dashboard/
│   │   ├── queries.ts          # Remove mock fallback
│   │   └── components/         # Update node display
│   └── nodes/
│       ├── NodeListPage.tsx    # Add status display
│       └── queries.ts          # Add status filters
└── types/index.ts              # Update Node type
```

---

## Implementation Tasks

---

### Task 1: Backend — Add Pydantic Models

**Files:**
- Modify: `backend/app/schemas.py`

**Interfaces:**
- Consumes: Nothing (new models)
- Produces: `GatewayRegisterPayload`, `GatewayRegisterResponse`, `NodeCreateResponse`

```python
from pydantic import BaseModel
from typing import Optional

# ─────────────────────────────────────────────────────────────────────────────
# Gateway Registration Models
# ─────────────────────────────────────────────────────────────────────────────

class NodeRegistrationItem(BaseModel):
    """Single node to register via gateway batch endpoint."""
    node_id: str
    name: str
    region: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class GatewayRegisterPayload(BaseModel):
    """Request body for gateway batch node registration."""
    farm_id: str
    nodes: list[NodeRegistrationItem]

class RegisteredNode(BaseModel):
    """Response for a single registered node."""
    id: str
    name: str
    status: str  # "pending" | "active"
    created: bool

class GatewayRegisterResponse(BaseModel):
    """Response for gateway batch registration."""
    gateway_id: str
    farm_id: str
    status: str  # "registered"
    nodes: list[RegisteredNode]
    created_count: int

# ─────────────────────────────────────────────────────────────────────────────
# Self-Registration Response (extends existing)
# ─────────────────────────────────────────────────────────────────────────────

class NodeSelfRegistrationResponse(BaseModel):
    """Response for node self-registration via readings."""
    node_created: bool
    node_id: str
    node_status: str  # "pending" | "active"
```

**Steps:**

- [ ] **Step 1: Read existing schemas.py**

```bash
cat backend/app/models/schemas.py
```

- [ ] **Step 2: Add new models to schemas.py**

```python
# Add at the end of the file, before any existing __all__ if present

class NodeRegistrationItem(BaseModel):
    """Single node to register via gateway batch endpoint."""
    node_id: str
    name: str
    region: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class GatewayRegisterPayload(BaseModel):
    """Request body for gateway batch node registration."""
    farm_id: str
    nodes: list[NodeRegistrationItem]

class RegisteredNode(BaseModel):
    """Response for a single registered node."""
    id: str
    name: str
    status: str
    created: bool

class GatewayRegisterResponse(BaseModel):
    """Response for gateway batch registration."""
    gateway_id: str
    farm_id: str
    status: str
    nodes: list[RegisteredNode]
    created_count: int

class NodeSelfRegistrationResponse(BaseModel):
    """Response for node self-registration via readings."""
    node_created: bool
    node_id: str
    node_status: str
```

- [ ] **Step 3: Verify syntax**

```bash
cd backend && python -c "from app.models.schemas import GatewayRegisterPayload, NodeSelfRegistrationResponse; print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/schemas.py
git commit -m "feat(backend): add Pydantic models for auto node discovery"
```

---

### Task 2: Backend — Add Database Migration

**Files:**
- Modify: `backend/app/database.py`

**Interfaces:**
- Consumes: Nothing (migration only)
- Produces: New columns available in nodes table

**Steps:**

- [ ] **Step 1: Read database.py to find ensure_column section**

```bash
grep -n "ensure_column" backend/app/database.py
```

- [ ] **Step 2: Add migration for gateway_id and first_seen_at**

Add these `ensure_column` calls after existing ones in `init_db()`:

```python
# After line: ensure_column(connection, "users", "phone", "TEXT NOT NULL DEFAULT ''")

ensure_column(connection, "nodes", "gateway_id", "TEXT")
ensure_column(connection, "nodes", "first_seen_at", "TEXT")
```

- [ ] **Step 3: Verify database migration**

```bash
cd backend && python -c "from app.database import init_db; init_db(); print('Migration OK')"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/database.py
git commit -m "feat(backend): add gateway_id and first_seen_at columns to nodes table"
```

---

### Task 3: Backend — Add Gateway Batch Register Endpoint

**Files:**
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `GatewayRegisterPayload` from models/schemas.py
- Produces: `GatewayRegisterResponse`

**Steps:**

- [ ] **Step 1: Find location to add endpoint (after gateway logs section)**

```bash
grep -n "gateway-logs" backend/app/main.py
```

- [ ] **Step 2: Add endpoint after gateway-logs section**

Add after line ~1136 (after `create_gateway_log` endpoint):

```python
# ---------------------------------------------------------------------------
# Auto Node Discovery - Gateway Registration
# ---------------------------------------------------------------------------

@app.post("/api/gateways/{gateway_id}/register", status_code=200)
def gateway_register_nodes(
    gateway_id: str,
    payload: GatewayRegisterPayload,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> GatewayRegisterResponse:
    """Batch register nodes via gateway.

    Gateway firmware calls this endpoint when it connects, providing
    the list of all node IDs it manages. Nodes are auto-created
    if they don't exist yet.
    """
    import uuid
    from .database import row_to_dict

    registered_nodes = []

    with get_connection() as connection:
        # Verify farm ownership
        farm = connection.execute(
            "SELECT * FROM farms WHERE id = ? AND user_id = ?",
            (payload.farm_id, current_user["id"])
        ).fetchone()

        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found")

        for node_item in payload.nodes:
            # Check if node already exists
            existing = connection.execute(
                "SELECT * FROM nodes WHERE id = ?", (node_item.node_id,)
            ).fetchone()

            if existing:
                # Update gateway_id and status
                connection.execute(
                    """UPDATE nodes
                       SET gateway_id = ?, status = 'online', updated_at = CURRENT_TIMESTAMP
                       WHERE id = ?""",
                    (gateway_id, node_item.node_id)
                )
                registered_nodes.append(RegisteredNode(
                    id=node_item.node_id,
                    name=node_item.name,
                    status="active",
                    created=False
                ))
            else:
                # Create new node
                node_id = node_item.node_id
                connection.execute(
                    """INSERT INTO nodes
                       (id, farm_id, gateway_id, name, location, region,
                        latitude, longitude, status, battery, first_seen_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)""",
                    (
                        node_id,
                        payload.farm_id,
                        gateway_id,
                        node_item.name,
                        node_item.region,
                        node_item.region,
                        node_item.latitude,
                        node_item.longitude,
                        "online",
                        100,  # Default battery until actual reading
                    )
                )
                registered_nodes.append(RegisteredNode(
                    id=node_id,
                    name=node_item.name,
                    status="pending",
                    created=True
                ))

    return GatewayRegisterResponse(
        gateway_id=gateway_id,
        farm_id=payload.farm_id,
        status="registered",
        nodes=registered_nodes,
        created_count=sum(1 for n in registered_nodes if n.created)
    )
```

- [ ] **Step 3: Verify endpoint compiles**

```bash
cd backend && python -c "from app.main import app; print('Gateway endpoint OK')"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(backend): add POST /api/gateways/{id}/register endpoint"
```

---

### Task 4: Backend — Modify Node Readings to Auto-Create Node

**Files:**
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: Existing `/api/nodes/{node_id}/readings` request
- Produces: Extended response with `node_created` field

**Steps:**

- [ ] **Step 1: Find the existing readings endpoint**

```bash
grep -n "POST.*nodes.*readings\|def.*readings" backend/app/main.py
```

- [ ] **Step 2: Read the existing endpoint code**

```bash
sed -n '1225,1320p' backend/app/main.py
```

- [ ] **Step 3: Modify to auto-create node if not exists**

Find the function and add node creation logic at the start:

```python
# Add after the function definition and before any existing logic:
@app.post("/api/nodes/{node_id}/readings", status_code=201)
def create_reading(
    node_id: str,
    adm4: str = Query(..., description="BMKG adm4 code for weather decision"),
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    payload: ReadingIn | None = None,
) -> dict:
    """Insert sensor reading for a node.

    If the node doesn't exist yet, it will be auto-created with
    minimal metadata. This enables self-registration from sensors
    that haven't been registered via gateway.
    """
    from .database import row_to_dict

    # Auto-create node if not exists (self-registration fallback)
    node_created = False
    node_status = "pending"

    with get_connection() as connection:
        existing_node = connection.execute(
            "SELECT * FROM nodes WHERE id = ?", (node_id,)
        ).fetchone()

        if not existing_node:
            # Auto-create node
            farm_id = payload.farm_id if hasattr(payload, 'farm_id') and payload.farm_id else None

            if not farm_id:
                raise HTTPException(
                    status_code=400,
                    detail="farm_id required for first-time node registration"
                )

            connection.execute(
                """INSERT INTO nodes
                   (id, farm_id, name, location, status, battery, first_seen_at)
                   VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)""",
                (node_id, farm_id, f"Node {node_id[:8]}", "", "online", 100)
            )
            node_created = True
            node_status = "pending"
        else:
            node_status = "online"

        # Continue with existing logic for inserting reading...
        # (keep existing code unchanged)
```

- [ ] **Step 4: Update response to include node_created**

Find where the response is returned and extend it:

```python
# Change the return statement from:
return {"reading": reading, "decision": decision}

# To:
return {
    "reading": reading,
    "decision": decision,
    "node_created": node_created,
    "node_status": node_status
}
```

- [ ] **Step 5: Verify compiles**

```bash
cd backend && python -c "from app.main import app; print('Readings endpoint OK')"
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(backend): auto-create node on readings if not exists"
```

---

### Task 5: Frontend — Remove Gateway ID from AddFarmPage

**Files:**
- Modify: `frontend/src/features/addFarm/AddFarmPage.tsx`
- Modify: `frontend/src/features/addFarm/hooks.ts`
- Modify: `frontend/src/types/index.ts`

**Interfaces:**
- Consumes: `CreateFarmPayload` type
- Produces: Form without gateway_id field

**Steps:**

- [ ] **Step 1: Read current AddFarmPage.tsx**

```bash
cat frontend/src/features/addFarm/AddFarmPage.tsx
```

- [ ] **Step 2: Remove gatewayId from AddFarmPage.tsx**

Remove these lines from the JSX:
```tsx
// Remove lines 117-127 (gatewayId input field)
<div className="space-y-1.5">
  <Label htmlFor="farm-gateway-id">{t('farms.addForm.gatewayIdLabel')}</Label>
  <Input
    id="farm-gateway-id"
    ...
  />
</div>

// Also remove from imports if not used elsewhere:
gatewayId, setGatewayId
```

- [ ] **Step 3: Update hooks.ts**

Remove gatewayId state and setter:

```typescript
// Remove from state:
const [gatewayId, setGatewayId] = useState('');

// Remove from return object:
gatewayId,
setGatewayId,
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors (related to this change)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/addFarm/
git commit -m "feat(frontend): remove gatewayId field from AddFarmPage"
```

---

### Task 6: Frontend — Delete AddNodePage

**Files:**
- Delete: `frontend/src/features/addNode/AddNodePage.tsx`
- Delete: `frontend/src/features/addNode/hooks.ts`
- Delete: `frontend/src/features/addNode/index.ts`
- Delete: `frontend/src/features/addNode/` (entire directory)
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/components/layout/AppLayout.tsx`

**Steps:**

- [ ] **Step 1: Check if directory has other files**

```bash
ls -la frontend/src/features/addNode/
```

- [ ] **Step 2: Remove route from router.tsx**

Remove these lines:
```tsx
// Line 16
const AddNodePage = lazy(() => import('@/features/addNode').then(m => ({ default: m.AddNodePage })));

// Line 77
<Route path="/farms/:id/addNode" element={<AddNodePage />} />
```

- [ ] **Step 3: Remove sidebar link from AppLayout.tsx**

```bash
grep -n "addNode\|AddNode" frontend/src/components/layout/AppLayout.tsx
```

Remove the nav item that links to AddNode.

- [ ] **Step 4: Delete the directory**

```bash
rm -rf frontend/src/features/addNode/
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src/features/addNode/
git add frontend/src/app/router.tsx frontend/src/components/layout/AppLayout.tsx
git commit -m "feat(frontend): remove AddNodePage (nodes now auto-discovered)"
```

---

### Task 7: Frontend — Update Dashboard to Show Node Status

**Files:**
- Modify: `frontend/src/features/dashboard/queries.ts`

**Interfaces:**
- Consumes: API response from `/api/farms/{id}/summary`
- Produces: Node display with status indicator

**Steps:**

- [ ] **Step 1: Read current queries.ts**

```bash
cat frontend/src/features/dashboard/queries.ts
```

- [ ] **Step 2: Remove mock fallback from useFarmSummary**

Remove `select: withMockNodeFallback` since we now use real data:

```typescript
// BEFORE:
export function useFarmSummary(farmId: string) {
  return useQuery({
    queryKey: ['farm-summary', farmId],
    queryFn: () => api.getFarmSummary(farmId),
    enabled: !!farmId,
    refetchInterval: 30_000,
    select: withMockNodeFallback,  // REMOVE THIS LINE
  });
}

// AFTER:
export function useFarmSummary(farmId: string) {
  return useQuery({
    queryKey: ['farm-summary', farmId],
    queryFn: () => api.getFarmSummary(farmId),
    enabled: !!farmId,
    refetchInterval: 30_000,
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/dashboard/queries.ts
git commit -m "feat(frontend): use real farm summary data (remove mock fallback)"
```

---

### Task 8: Frontend — Update NodeListPage with Status Display

**Files:**
- Modify: `frontend/src/features/nodes/NodeListPage.tsx`

**Interfaces:**
- Consumes: Node data with status field
- Produces: UI showing pending vs active status

**Steps:**

- [ ] **Step 1: Read current NodeListPage.tsx**

```bash
cat frontend/src/features/nodes/NodeListPage.tsx
```

- [ ] **Step 2: Add status badge display**

Add status indicator next to node name:

```tsx
// In the node table row, add:
<div className="flex items-center gap-2">
  <span>{node.name}</span>
  {node.status === 'pending' && (
    <Badge variant="secondary" className="text-xs">
      ○ Pending
    </Badge>
  )}
  {node.status === 'active' && (
    <Badge variant="default" className="text-xs bg-green-500">
      ● Aktif
    </Badge>
  )}
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/nodes/NodeListPage.tsx
git commit -m "feat(frontend): show node status (pending/active) in list"
```

---

### Task 9: Integration Testing

**Files:**
- Test: Backend endpoint manually
- Test: Frontend UI flow

**Steps:**

- [ ] **Step 1: Start backend**

```bash
cd backend && uvicorn app.main:app --reload
```

- [ ] **Step 2: Test gateway registration with curl**

```bash
# Login first to get token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}' | jq -r '.access_token')

# Register nodes via gateway
curl -X POST http://localhost:8000/api/gateways/gw-001/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "farm_id": "farm-uuid-here",
    "nodes": [
      {"node_id": "node-001", "name": "Node A1", "region": "Lahan Utama"},
      {"node_id": "node-002", "name": "Node A2", "region": "Lahan Cadangan"}
    ]
  }'
```

Expected response:
```json
{
  "gateway_id": "gw-001",
  "farm_id": "farm-uuid-here",
  "status": "registered",
  "nodes": [...],
  "created_count": 2
}
```

- [ ] **Step 3: Test self-registration via readings**

```bash
curl -X POST "http://localhost:8000/api/nodes/node-003/readings?farm_id=farm-uuid-here&adm4=32.01.01" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"soil_moisture": 45.2, "soil_temp": 28.5, "air_temp": 31.2, "air_humidity": 72.0}'
```

Expected response includes:
```json
{
  "node_created": true,
  "node_status": "pending"
}
```

- [ ] **Step 4: Test frontend with dev server**

```bash
cd frontend && npm run dev
```

- [ ] **Step 5: Verify all flows**

1. Create farm → should NOT ask for gateway_id
2. Node auto-appears after gateway registration
3. Node auto-appears after sending readings
4. No "Add Node" button anywhere

- [ ] **Step 6: Final verification**

```bash
# Run TypeScript check
cd frontend && npx tsc --noEmit

# Run linter
cd frontend && npm run lint

# Backend test
cd backend && python -m pytest
```

Expected: All pass with 0 errors

---

## Summary of Changes

| Task | Files Changed | Type |
|------|--------------|------|
| 1. Pydantic Models | `backend/app/models/schemas.py` | New |
| 2. DB Migration | `backend/app/database.py` | Modify |
| 3. Gateway Endpoint | `backend/app/main.py` | New |
| 4. Self-Registration | `backend/app/main.py` | Modify |
| 5. Remove GatewayId | `frontend/src/features/addFarm/*` | Modify |
| 6. Delete AddNodePage | `frontend/src/features/addNode/` | Delete |
| 7. Remove Mock | `frontend/src/features/dashboard/queries.ts` | Modify |
| 8. Node Status UI | `frontend/src/features/nodes/` | Modify |

---

## Post-Implementation Checklist

- [ ] Backend endpoint tested with curl
- [ ] Frontend builds without errors
- [ ] TypeScript compiles with 0 errors
- [ ] ESLint passes
- [ ] No "Add Node" UI exists anymore
- [ ] Gateway registration works
- [ ] Self-registration via readings works
