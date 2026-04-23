# CLAUDE.md — Game Frontend

## Project overview

A multiplayer real-time strategy game with a world map as the primary interface.
Two blocs (East vs. West) compete by placing military Bases and resource-producing
Trusts on Placements across geographic Zones. Military units move in float
coordinates (lng/lat), with combat detection handled server-side.

## Tech stack

- **Language**: TypeScript
- **Framework**: React (Vite)
- **Map**: MapLibre GL JS — renders the base map, zone polygons (GeoJSON), handles pan/zoom
- **Game entities**: Pixi.js — overlaid transparent canvas for units, bases, trusts, animations
- **State**: Zustand
- **Data fetching**: React Query — short polling at per-resource intervals (no WebSocket)
- **Styling**: Tailwind + CSS variables

## Repository layout (expected)

```
src/
  map/          # MapLibre setup, GeoJSON zone layers
  pixi/         # Pixi app, entity sprites, animation loop
  bridge/       # Coordinate projection: lng/lat ↔ Pixi x/y
  store/        # Zustand slices (zones, units, placements, resources)
  api/          # Backend API client (typed fetch wrappers)
  ui/           # React HUD components (build panel, resource display, etc.)
  types/        # Shared TypeScript types (mirrors backend domain model)
```

## Backend reference

> **Note**: The backend is in a separate Rust repository at `../game-backend`.
> When implementing API calls or data shapes, read the actual source rather than
> guessing. Key locations:
> - API route handlers: `../game-backend/src/api/`
> - Domain types: `../game-backend/src/models/` (or equivalent)
> - The credit-exchanger service has its own API — see backend docs for base URL config.

The backend API is REST (JSON). Base URL comes from `VITE_API_BASE_URL` env var.

---

## Domain model

### Blocs
Two teams: **East** and **West**. Every Zone belongs to one Bloc.
Every Base and military unit belongs to a Bloc.

### Zones
- Represent geographic regions (e.g. "USA + Canada", "Germany + Austria")
- Each Zone belongs to a Bloc
- Each Zone has exactly one Placement by default
- Zones are the economic actors — they pay for Trusts

### Placements
- A possible build location within a Zone
- Can be empty, or occupied by either a **Base** or a **Trust** (not both)
- Rendered on the map as an interactive marker

### Trusts
- Placed on a Placement, paid for by the Zone (≥50%) and optionally a financier (≤50%)
- Produce **money** (Float) and one **resource** (from a typed resource dict)
- Production is updated hourly; negatively affected by nearby enemy units
- Can be disabled, removed, or destroyed by enemy units
- When destroyed: credits the enemy base's `production_count`

### Bases
- Placed on a Placement, paid for by the Bloc (≥50%) and optionally a financier (≤50%)
- Produce military units hourly (budget = `hourly_income × military_expense / 100`)
- Prioritised bases produce units at 2× rate vs. normal bases (0 if disabled)
- Each Base has a configurable **target type**: `trust | base | unit`
  — units spawned here will move toward the nearest enemy of that type
- Can be disabled, removed, destroyed, prioritised
- When destroyed: credits the enemy base's `production_count`

### Military units
- Spawned by Bases, belong to a Bloc
- Positions are **float coordinates (lng/lat)**, not a discrete grid
- Move every minute toward their target (closest enemy trust, base, or unit —
  determined by the spawning base's target setting)
- **Combat is detected server-side** — the backend decides when units are fighting
  based on proximity; the frontend receives combat state via the polling API
- If a unit is killed: enemy base `production_count` += half the unit's creation cost

---

## Unit coordinate system

Unit positions are **float lng/lat coordinates**, not a discrete grid.

**Rendering pipeline:**
```
unit { lng: float, lat: float } → map.project(lng, lat) → Pixi x, y
```

**No client-side combat detection.** Do not attempt to infer combat from position
proximity. Combat state is authoritative from the backend only — it arrives as a
field on unit objects (e.g. `in_combat: boolean` or similar — confirm field name
from `../game-backend`).

**Movement animation:** between polls, animate unit sprites by tweening from their
last known position to the newly received position. Use a fixed tween duration
slightly shorter than the poll interval so sprites arrive before the next update.

---

## Polling strategy

The backend is HTTP-only (no WebSocket). Use React Query's `refetchInterval`
for all live data. Suggested intervals based on backend update cadences:

| Data | Interval | Reason |
|---|---|---|
| Unit positions + combat state | 10s | Units move every minute; 10s gives smooth visual updates |
| Placement / base / trust state | 15s | Changes on player action, want reasonably fast feedback |
| Zone resources / money | 30s | Updated hourly by the backend |

All intervals are tunable — centralise them in `src/api/intervals.ts` so they
can be adjusted without hunting through components.

**Do not optimistically update unit positions.** Unit movement is server-authoritative;
only tween between confirmed positions. Optimistic updates are fine for player
actions (placing a base/trust) where the outcome is deterministic.

---

## Rendering architecture

### Two-canvas overlay
MapLibre owns a `<canvas>` for the map. Pixi gets a sibling `<canvas>` on top:

```css
#pixi-canvas {
  position: absolute;
  top: 0; left: 0;
  pointer-events: none; /* clicks pass through to MapLibre */
}
```

### Coordinate bridge (`src/bridge/project.ts`)
Re-project all unit positions to screen pixels on every map render:

```ts
map.on('render', () => {
  for (const unit of store.getState().units) {
    const { x, y } = map.project([unit.lng, unit.lat]);
    unit.sprite.position.set(x, y);
  }
  pixiApp.renderer.render(pixiApp.stage);
});
```

Also re-render on `map.on('move')` and `map.on('zoom')` to avoid 1-frame lag.

### What lives where
| Thing | Rendered by |
|---|---|
| Base map tiles | MapLibre |
| Zone borders + fills | MapLibre (GeoJSON layer) |
| Placement markers | MapLibre (or Pixi — TBD) |
| Bases, Trusts | Pixi sprites |
| Military units | Pixi sprites |
| Unit movement (tween between polled positions) | Pixi tweened animation |
| Combat indicator (server-flagged units) | Pixi (triggered by `in_combat` flag from API) |
| Movement trails | Pixi (shader-based, fading path behind unit) |
| HUD / build panel / resource bar | React (DOM, outside canvas) |

---

## Key frontend behaviours

### Placing a Base or Trust
1. User clicks a Placement marker on the map
2. HUD shows build panel (Base vs. Trust, financing options)
3. On confirm → POST to backend (see API section)
4. Optimistic UI update in Zustand; rollback on error

### Combat visualisation
Combat is detected server-side. When a unit's API response includes a combat flag:
- Show a distinct visual state on the sprite (e.g. clash animation, colour shift)
- Do not infer combat from position — only trust the backend flag
- Outcome (unit removal) arrives in the next poll; remove the sprite then

### Unit movement
- Positions are float lng/lat coordinates, polled every ~10s
- On each poll, tween each unit sprite from its current screen position to the
  newly projected screen position over ~800ms
- This produces smooth visual movement even though positions update discretely

### Resource / money display
- Poll zone and bloc credit data at a reasonable interval (suggest: 30s)
- Show current money and resource levels in the HUD

---

## API conventions (fill in when confirmed)

> These are placeholders based on the backend spec. Replace with real endpoints
> once the API is confirmed or read from `../game-backend`.

```
GET  /api/zones                              → all zones with bloc + placement info
GET  /api/placements                         → placement states (empty/base/trust)
GET  /api/units                              → current unit positions (float lng/lat) + combat state
POST /api/base/create                        → place a base on a placement
POST /api/trust/create                       → place a trust on a placement
POST /api/base/prioritise?id=&value=         → toggle priority
POST /api/base/target?id=&target=            → set unit target type
POST /api/base/disable?id=                   → disable base
POST /api/base/remove?id=                    → remove base
POST /api/bloc/military_expense?id=&value=   → set military budget %
```

All POST bodies and response shapes: **read the Rust source** at
`../game-backend/src/api/` before implementing — do not guess field names.

---

## Environment variables

```
VITE_API_BASE_URL=http://localhost:8080
VITE_CREDIT_EXCHANGER_URL=...             # if frontend ever calls it directly
```

---

## Open questions (resolve before implementing)

- [ ] Exact field name for combat state on unit objects (read backend source)
- [ ] What resource types exist? (influences Trust build UI)
- [ ] Are Placements fixed per Zone, or can there be multiple per Zone?
- [ ] Does the frontend ever call the credit-exchanger directly, or only the main backend?
- [ ] Authentication / session model — how does the frontend know which Bloc it is?
