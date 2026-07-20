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

> **Note**: The backend is the sibling Rust project at `../simulation` (not a
> separate `game-backend` repo, as earlier drafts of this file assumed). When
> implementing API calls or data shapes, read the actual source rather than
> guessing. Key locations:
> - API route handlers: `../simulation/src/handlers/` (one file per resource:
>   `bases.rs`, `trusts.rs`, `units.rs`, `blocs.rs`, `placements.rs`,
>   `combats.rs`, `zones.rs`, `auth.rs`)
> - Domain types: `../simulation/src/domain/`
> - The credit-exchanger service is only ever called server-side (see
>   `../simulation/src/services/credit_exchange_service/`) — the frontend
>   never calls it directly.

The backend API is REST (JSON), documented live via Swagger UI at
`http://127.0.0.1:8080/swagger-ui/` (raw OpenAPI spec at
`/api-docs/openapi.json`) whenever the backend is running (`cargo run` from
`../simulation`). Base URL comes from the `VITE_API_BASE_URL` env var.

**→ See [`API_INTEGRATION.md`](./API_INTEGRATION.md) for the authoritative,
continuously-updated map of every backend endpoint to its frontend wiring
status — what's called and how, and what params a not-yet-wired endpoint
would need.** Update that file (not this one) in the same commit whenever
`src/api/*.ts` changes.

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
proximity. Combat state is authoritative from the backend only — but it does
**not** arrive as a field on unit objects. There is no `in_combat` (or
similarly named) field on `UnitResponse` — combat is a separate resource at
`GET /api/combats`, polled via `useCombats()` (`src/api/combats.ts`) and
cross-referenced by unit ID in `App.tsx` (see "Combat visualisation" below).
See `API_INTEGRATION.md` for the full response shape.

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
| Combat indicator (units/structures in `GET /api/combats`) | MapLibre — see below |
| Movement trails | Pixi (shader-based, fading path behind unit) |
| HUD / build panel / resource bar | React (DOM, outside canvas) |

> **Note on the rows above:** "Bases, Trusts" / "Military units" / "Unit
> movement" describe the intended Pixi-based architecture, but as
> implemented today those are MapLibre symbol-layer icons (`PlacementsLayer.tsx`,
> `UnitsLayer.tsx`, `placementIcons.ts`), not Pixi sprites — `PixiOverlay.tsx`
> currently mounts an empty, transparent canvas with nothing drawn on it. The
> combat indicator follows the pattern that's actually in place today: it's a
> red ring drawn into a unit's existing MapLibre marker icon (new `'combat'`
> `IconState` in `placementIcons.ts`), driven by `useCombats()` — see "Combat
> visualisation" below and `API_INTEGRATION.md`'s Combats section. If/when
> bases/trusts/units migrate to actual Pixi sprites, move this along with them.

### Adding a new MapLibre source/layer (gotcha)

`MapView.tsx` adds several sources asynchronously inside its `load` handler
(world-map raster image, zone GeoJSON, and — going forward — anything else
mounted the same way, e.g. new zone overlays or marker layers). Any component
that adds its own source/layer to the shared map (see `PlacementsLayer.tsx`
for the working pattern) must not gate purely on:

```ts
map.isStyleLoaded()   // checked once
map.on('styledata', ensureLayer)  // retried only on this event
```

`styledata` is **not guaranteed to fire again** once those other sources
finish loading — MapLibre can settle straight into a single `idle` event
instead. If `isStyleLoaded()` is false on the first synchronous call (e.g.
because a sibling source added in `MapView.tsx`'s `load` handler is still
fetching) and no further `styledata` event happens to land, the retry gated
on `styledata` alone silently never fires again and the layer never gets
added — no error, nothing in the console, it just doesn't render.

**Fix pattern:** listen for both `map.on('styledata', ensureLayer)` **and**
`map.on('idle', ensureLayer)` (with matching `.off()` cleanup for both). This
was the root cause of Placement markers silently not appearing even though
the API data loaded correctly — see `PlacementsLayer.tsx`'s `ensureLayer`
for the fixed version. Apply the same dual-listener pattern to any future
map layer (unit sprites' underlying markers, new zone overlays, etc.) that
adds itself to the map after mount.

---

## Key frontend behaviours

### Placing a Base or Trust
1. User clicks a Placement marker on the map
2. HUD shows build panel (Base vs. Trust, financing options)
3. On confirm → POST to backend (see API section)
4. Optimistic UI update in Zustand; rollback on error

### Combat visualisation
Combat is detected server-side, but **not** surfaced as a flag on unit objects —
it lives at `GET /api/combats`, polled by `useCombats()` (`src/api/combats.ts`,
same cadence as units) and consumed as follows:
- `App.tsx` cross-references every `ongoing` combat's `units[].unitIds`
  against currently-rendered units into a `combatUnitIds: Set<string>`, and
  threads that into `UnitsLayer`/`placementIcons.ts` (a red ring on the
  unit's marker icon — new `'combat'` `IconState`) and `UnitMenu` (a red
  "In combat" badge on hover)
- Do not infer combat from position — only trust data from this endpoint
- **Not yet built:** a combat's `structure`/`position` fields, and its
  `events` (`unitsKilled` / `trustDestroyed` / `baseDestroyed`) which
  describe outcomes as they happen — consuming these would mean
  cross-referencing `events` against the next `/api/units`, `/api/bases`, or
  `/api/trusts` poll before removing a sprite/marker, e.g. for a kill-feed or
  a marker at the combat's location. See `API_INTEGRATION.md`'s Combats
  section for the exact shape.

### Unit movement
- Positions are float lng/lat coordinates, polled every ~10s
- On each poll, tween each unit sprite from its current screen position to the
  newly projected screen position over ~800ms
- This produces smooth visual movement even though positions update discretely

### Resource / money display
- Poll zone and bloc credit data at a reasonable interval (suggest: 30s)
- Show current money and resource levels in the HUD

---

## API conventions

The placeholder endpoint list that used to live here has been confirmed
against the live OpenAPI spec and superseded by
[`API_INTEGRATION.md`](./API_INTEGRATION.md) — several of the old guesses were
wrong (e.g. `POST /api/base/create` is actually `POST /api/bases`, and
`POST /api/base/remove` has no backend endpoint at all, ever). Use real
request/response shapes from `src/types/*.ts` (mirrored 1:1 from the Rust
handler types) rather than guessing field names.

---

## Environment variables

```
VITE_API_BASE_URL=   # .env.development: empty — requests go through the Vite dev
                     #   proxy (see vite.config.ts) to avoid CORS issues
                     # .env.production: placeholder `https://example.com`, pending
                     #   a real deployment URL
```

No credit-exchanger env var exists — the frontend never calls that service
directly (see "Open questions" and `API_INTEGRATION.md`).

---
## Building the Backend
cargo build 2>&1 | tail -60

## Open questions (resolve before implementing)

- [x] Exact field name for combat state on unit objects — **there is no such
      field.** `UnitResponse` carries nothing about combat; it's a separate
      resource at `GET /api/combats`, now polled via `useCombats()` and
      cross-referenced by unit ID (see "Combat visualisation" above). See
      "Domain-model corrections" in `API_INTEGRATION.md`.
- [x] What resource types exist? — `ResourceName` is a lowercased string
      newtype server-side (no enum), but the valid set is now discoverable via
      `GET /api/resources`; `PlacementMenu.tsx` uses it to populate a dropdown
      instead of free text. See `API_INTEGRATION.md`'s Resources section.
- [ ] Are Placements fixed per Zone, or can there be multiple per Zone? — not
      determinable from the API schema alone (nothing caps it); still open.
- [x] Does the frontend ever call the credit-exchanger directly, or only the
      main backend? — only the main backend; no credit-exchanger URL is
      configured or referenced anywhere in `src/`.
- [x] Authentication / session model — cookie session via actix-identity
      (`POST /api/login` sets it; every request sends `credentials: 'include'`,
      centralised in `src/api/client.ts`). There's no single "which Bloc am I"
      flag — access is granted per-bloc *and* per-zone independently, each
      `read`/`write`, exposed via `GET /api/me` (wired as `useCurrentUser()` —
      see `API_INTEGRATION.md`) and used to disable build/target UI the user
      can't perform, plus a "Bloc" HUD panel showing the user's own
      permissions and per-bloc info (`GET /api/blocs`).
