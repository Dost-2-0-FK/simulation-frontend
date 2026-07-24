# API Integration — Frontend ↔ Backend

Source of truth for which backend endpoints the frontend actually calls, how,
and what's still missing. This supersedes the old placeholder endpoint list in
`CLAUDE.md` (several of those paths were wrong once checked against the real
API).

**Update this file in the same commit whenever `src/api/*.ts` changes** — a
new call is added, a call is removed, or a previously-missing endpoint gets
implemented. Stale status here is worse than no doc at all.

## How to re-verify this file

1. Run the backend (`cargo run` from `../simulation`).
2. Browse `http://127.0.0.1:8080/swagger-ui/`, or pull the raw spec:
   ```
   curl -s http://127.0.0.1:8080/api-docs/openapi.json | jq '.paths | keys'
   ```
3. Diff the path list against the tables below; update statuses/notes.
4. For any endpoint's exact request/response shape, either check
   `src/types/*.ts` (kept as 1:1 mirrors of the Rust response types) or read
   the handler directly in `../simulation/src/handlers/<tag>.rs`.

**Last verified:** 2026-07-18, against `simulation` crate `v0.2.2` (per
`info.version` in the OpenAPI spec). If the running backend reports a
different version, treat this file as potentially stale until re-checked.
This pass verified new wire shapes by reading the handler source directly
(`../simulation/src/handlers/{bases,blocs,combats}.rs`) rather than a live
`cargo run` + Swagger diff — the crate version is unchanged (`0.2.2`), so this
is equivalent per point 4 above, but re-run the live diff if that version ever
moves.

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Wired — frontend calls this today |
| ⚠️ | Partially wired — some fields/params of this endpoint are unused |
| ❌ | Not wired — a real gap; frontend has no code path to this endpoint |
| 🚫 | Not applicable — this endpoint is not meant to be called from the frontend at all |

For ❌ rows, "Params" states whether each value would be **user-supplied**
(typed/clicked during interaction) or **from a prior GET** (already sitting in
a cached response — e.g. an entity's `id` — and never something a user types).

---

## Auth (`../simulation/src/handlers/auth.rs`)

| Endpoint | Status | Notes |
|---|---|---|
| `POST /api/login` | ✅ | `src/api/auth.ts → login()`. Body `{userId, password}`, both user-supplied via `LoginModal.tsx`. Sets a session cookie (actix-identity); response body is just `{userId}`. |
| `POST /api/logout` | ✅ | `src/api/auth.ts → logout()`, called from `useAuthStore.logout()` in `src/store/index.ts`. No params. Clears the cookie server-side. |
| `GET /api/me` | ✅ | `src/api/auth.ts → useCurrentUser()`, mirrored by `CurrentUser` in `src/types/auth.ts`. Enabled only while logged in (`enabled: userId !== null`) so it doesn't fire a guaranteed 401 behind the login modal; not polled (`staleTime: Infinity`) since permissions only change on (re)login. `canWriteBloc()`/`canWriteZone()`/`canReadBloc()`/`canReadZone()` (same file) are the permission-check helpers consumed by `PlacementMenu.tsx` (disables "Build Base"/"Build Trust"/"Set target"/enable-disable/prioritise when the user lacks write access) and `BlocPanel.tsx` (the "Bloc" HUD button — shows the user's own bloc/zone permissions, per-bloc info for any bloc they can read, and an editable military-expense/combat-chance form in place of the read-only display for any bloc they can *write*). |

**Session model:** cookie-based (actix-identity), not a bearer token. Every
request must send `credentials: 'include'` — already centralised in
`src/api/client.ts`, so any new API module should build on `apiGet`/`apiPost`/
`apiPatch` rather than calling `fetch` directly. `401` = not authenticated
(missing/expired cookie); `403` = authenticated but lacking write access to
*that specific* bloc/zone. Access is granted per-bloc **and** per-zone
independently (a user could have write access to one bloc's bases and one
zone's trusts, with no single "my bloc" concept).

---

## Placements (`../simulation/src/handlers/placements.rs`)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/placements` | ✅ | `src/api/placements.ts → getPlacements()` (private; exposed via `usePlacements()`). Response only has `{id, zone, position}` — **occupancy is not in this response**. The frontend derives it by also calling `GET /api/bases` + `GET /api/trusts` and joining client-side on `placementId` (see the `occupants` map in `getPlacements()`). `position: {x, y}` is run through `normalizeLngLat()` (`src/bridge/index.ts`) before use — raw backend coordinates can exceed ±180/±90 and wrap. |
| `GET /api/placements/{id}` | ❌ | `id` would be **from a prior GET** (`Placement.id`, e.g. the marker the user clicked) — never user-typed. Not currently needed: the list fetch + client-side lookup in `usePlacements()` already covers every placement the UI touches. Low priority unless a future feature needs a single placement without loading the whole list. |

---

## Bases (`../simulation/src/handlers/bases.rs`)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/bases` | ✅ | `src/api/bases.ts → getBases()`. Consumed both directly and inside `placements.ts` for occupancy joining. |
| `POST /api/bases` | ✅ | `src/api/bases.ts → createBase()`, invoked via `useBuildOnPlacement()` in `placements.ts`, triggered from `PlacementMenu.tsx`'s "Build Base" flow. Body: `placementId` (**from a prior GET** — the clicked `Placement.id`), `payment: Financing[]` (**user-supplied**, optional — financier rows in the build form; empty means the bloc covers 100%). |
| `PATCH /api/bases/{id}` | ✅ | `id` **from a prior GET** (`Base.id`). Body accepts `{enabled, prioritized, target}`, all nullable/optional. `src/api/bases.ts → patchBase()`, exposed via `usePatchBase()` in `src/api/placements.ts` (a single generic mutation hook — each call site in `PlacementMenu.tsx` gets its own instance so `isPending`/`isError` track the specific action, not all three at once). All three fields now have a UI trigger in `PlacementMenu.tsx`: the target `<select>` + "Set" button, and the "Enabled/Disabled" and "Prioritised/Not prioritised" toggle buttons next to it (all **user-supplied**, gated on `canWriteBloc()` for the base's bloc). Toggling `enabled`/`prioritized` also updates the base's map marker (`specForPlacement()` in `src/map/placementIcons.ts` now derives the `disabled`/`priority` icon states from these fields, instead of always rendering `normal`). |
| `POST /api/bases/publish-production` | 🚫 | No params. **Not meant to be called from the frontend.** It flushes a base's accumulated loot to the credit-exchanger via an internal command channel. The only caller is `simulation/scripts/run-production-cycle.sh`, an ops script meant to run on a timer (`while true; do …; sleep $interval; done`) against the backend directly. Do not wire this into any UI action. |
| `GET /api/bases/{id}` | ❌ | `id` **from a prior GET** (`Base.id`). Not currently needed — same reasoning as `GET /api/placements/{id}`; the list fetch already covers it. |

**Known backend gap vs. domain model:** `CLAUDE.md`'s domain model says bases
can be "removed" — there is **no removal/delete endpoint for bases at all** in
the current API (checked the full path list). "Disable" (`enabled: false` via
`PATCH`) is now wired end-to-end (see above); "remove" still doesn't exist on
either side.

---

## Trusts (`../simulation/src/handlers/trusts.rs`)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/trusts` | ✅ | `src/api/trusts.ts → getTrusts()`. Same dual use as `getBases()` (direct + placement-occupancy joining). `TrustResponse.resource` (the produced resource *type*, e.g. `"oil"`) is always present regardless of zone read access — only `.income` and `.producing` (the amounts) are redacted without it. Shown unconditionally as a badge in `PlacementMenu.tsx`'s trust panel. `TrustResponse.inhibitionRadius` (a plain `f64`, already capped server-side) is now also mirrored on `Trust` — shown as a read-only "Inhibition Radius" row in the trust panel; hovering/clicking it draws the actual radius around the trust's marker (`InhibitionRadiusLayer.tsx`), and any trust with an enemy unit currently inside its radius (computed client-side in `App.tsx` from `GET /api/units` + `GET /api/zones`, since combat/production-impact isn't itself a field on `TrustResponse`) draws it in a signal color unconditionally. `.income`/`.producing` remain unwired in the UI. |
| `POST /api/trusts` | ✅ | `createTrust()`, via `useBuildOnPlacement()` → `PlacementMenu.tsx`'s "Build Trust" flow. Body: `placementId` (**from a prior GET**), `resource` (**user-supplied**, free-text input — confirmed `ResourceName` is an unconstrained `string` server-side, not an enum, so there's no fixed resource list to validate against or offer as a picker), `payment: Financing[]` (**user-supplied**, optional, same shape/semantics as bases). |
| `POST /api/trusts/publish-production` | 🚫 | Same story as `bases/publish-production` — ops-only, driven by `run-production-cycle.sh`. Do not wire into the UI. |
| `GET /api/trusts/{id}` | ❌ | `id` **from a prior GET** (`Trust.id`). Not currently needed; covered by the list fetch. |

**Known backend gap vs. domain model:** unlike bases, there is **no `PATCH`
endpoint for trusts at all** — nothing to disable a trust from either side.
"Trusts can be disabled" (per `CLAUDE.md`'s domain model) has zero backend
support today.

---

## Units (`../simulation/src/handlers/units.rs`)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/units` | ✅ | `src/api/units.ts → getUnits()` / `useUnits()`. Response has `{id, position, base, bloc, target}` — **no combat field** (see "Domain-model corrections" below). `position` goes through `normalizeLngLat()` same as placements. |
| `POST /api/units/produce` | 🚫 | No params. Same ops-only pattern as the two `publish-production` endpoints — triggers military unit production via the internal command channel, driven externally by `run-production-cycle.sh`. Do not wire into the UI. |

---

## Blocs (`../simulation/src/handlers/blocs.rs`)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/blocs` | ✅ | `src/api/blocs.ts → useBlocs()`, mirrored by `Bloc` in `src/types/bloc.ts`. Returns every bloc unconditionally (no permission check on the backend) — consumed only by `BlocPanel.tsx`, which filters client-side to blocs the current user has any permission (`blocPermissions[name] !== undefined`) on before displaying `militaryExpense`/`chance`, since "which bloc info can I see" is a client concern, not a backend-enforced one for this endpoint. |
| `GET /api/blocs/{id}` | ❌ | `id` (a `BlocName`, i.e. plain string) would be **from a prior GET** — e.g. an already-fetched `Base.bloc` or `Unit.bloc` — never user-typed directly. Still not needed: the bloc settings form (below) edits in place against the already-fetched `useBlocs()` list rather than doing a redundant single-bloc lookup. |
| `PATCH /api/blocs/{id}` | ✅ | This is the real shape behind the old (now-removed) `CLAUDE.md` placeholder `POST /api/bloc/military_expense?id=&value=`. Body: `{chance, militaryExpense}`, both nullable. `src/api/blocs.ts → updateBloc()`, exposed via `useUpdateBloc()`. `id` **from a prior GET** (the already-fetched `Bloc.name`); `militaryExpense` (a 0–1 share, sent as a 0–100 percent in the UI) and `chance` (a non-negative integer — combat die odds, per-bloc) are **user-supplied** via the settings form in `BlocPanel.tsx` (`BlocSettingsForm`), shown per-bloc in place of the read-only display whenever `canWriteBloc()` is true for that bloc. Previously a real gap — the domain model's "budget = hourly_income × military_expense / 100" mechanic (`CLAUDE.md`) had no frontend surface to set that percentage; it does now. |

---

## Combats (`../simulation/src/handlers/combats.rs`)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/combats` | ⚠️ | No params, no auth/permission gating. `src/api/combats.ts → getCombats()` / `useCombats()`, polled at `INTERVALS.units` (combat state moves at the same cadence as units). Mirrored by `Combat` in `src/types/combat.ts`. **Only `state` and `units[].unitIds` are consumed** — `App.tsx` builds a `combatUnitIds: Set<string>` from every `ongoing` combat's participant IDs and threads it into `UnitsLayer` (renders a red ring on that unit's marker — see `specForUnit()` / `markerSvg()` in `src/map/placementIcons.ts`, new `'combat'` `IconState`) and into `UnitMenu` (shows a red "In combat" badge on hover). `structure`, `position`, and `events` are fetched but **unused** — no kill-feed or combat-location marker exists yet; a combat's `events` would need cross-referencing against the next `/api/units`/`/api/bases`/`/api/trusts` poll to confirm removals before acting on them (per `CLAUDE.md`'s "Combat visualisation" section), which isn't built. |

Shape (`src/types/combat.ts`):
```ts
{
  id: string             // uuid
  position: { x: number; y: number }
  units: { bloc: string; unitIds: string[] }[]   // participants, grouped by bloc
  structure:
    | { type: 'none' }
    | { type: 'trust'; id: number; destruction_threshold: number }
    | { type: 'base'; id: number; destruction_threshold: number }
  state: 'ongoing' | 'ended'
  events: (
    | { type: 'unitsKilled'; units: { killer: string; killed: string }[] }
    | { type: 'trustDestroyed'; id: number }
    | { type: 'baseDestroyed'; id: number }
  )[]
}
```
Note `destruction_threshold` stays snake_case on the wire — `CombatStructureResponse`'s
`#[serde(rename_all = "camelCase")]` is an enum-container attribute, which only renames the
variant tag (`"type"`), not fields nested inside a struct variant. Don't "fix" this to
camelCase; it'll silently stop deserializing that field.

`position` would need the same `normalizeLngLat()` treatment as placements/units
if ever rendered on the map — not needed for the unit-highlight use above, since that
cross-references by unit ID, not position.

---

## Zones (`../simulation/src/handlers/zones.rs`)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/zones` | ✅ | `src/api/zones.ts → useZones()`, mirrored by `Zone` in `src/types/zone.ts`. Only consumed by `PlacementMenu.tsx`, to resolve an *empty* placement's zone to its owning bloc — needed because "Build Base" is gated per-bloc (`require_bloc_write` on `POST /api/bases`, keyed off the placement's zone's bloc) while an unoccupied placement has no `occupant.bloc` field to read that off of directly. |

**Known backend gap:** `CLAUDE.md`'s "Resource / money display" HUD feature
(poll zone/bloc credit data, show money + resource levels) has **no backing
aggregate endpoint** — `ZoneResponse` carries no money or resource fields, and
there is no "zone wallet" endpoint anywhere in the API. The closest available
data is per-trust: `TrustResponse.income` (money) and `.producing` (resources),
each gated behind zone read access and only visible with permission. Building
that HUD feature today would mean summing `income`/`producing` across every
trust in a zone client-side — there is nothing server-side to sum it for you.
Worth flagging to backend if an aggregate is wanted instead.

---

## Resources (`../simulation/src/handlers/resources.rs`)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/resources` | ✅ | `src/api/resources.ts → useResources()`. Returns the server's configured list of resource names as a plain `string[]` (`ResourceName` is a newtype-wrapped, lowercased `String` that serializes transparently — no wrapper object). Consumed by `PlacementMenu.tsx` to populate the "Resource" `<select>` shown when building a Trust, replacing the old free-text input now that the valid set is known. |

---

## Domain-model corrections (confirmed against the live schema)

Things `CLAUDE.md`'s domain model assumed that turned out to be wrong once
checked against the real API — noted here so nobody re-guesses the same thing:

- **No `in_combat` field on units.** `UnitResponse` is `{id, position, base,
  bloc, target}` — nothing about combat. Combat is a separate resource,
  `GET /api/combats` (see above), now polled and cross-referenced by unit ID
  (not merged into `Unit`/`UnitResponse` itself).
- **`ResourceName` is a free-form string**, not an enum — there is no fixed
  list of resource types to fetch or validate against. `PlacementMenu.tsx`
  already treats it this way (plain text input).
- **No delete/remove endpoint for bases**, and **no `PATCH`/disable endpoint
  for trusts at all** — see the gaps noted in their sections above.
- **The credit-exchanger is never called directly by the frontend.** No
  `VITE_CREDIT_EXCHANGER_URL` (or equivalent) is referenced anywhere in `src/`;
  all credit-exchange happens server-side (`../simulation/src/services/credit_exchange_service/`).
- **Auth is cookie-based with per-bloc/per-zone permissions**, not a single
  "which bloc am I" flag — see the Auth section above. `GET /api/me` is now
  wired (`useCurrentUser()`) and used to disable build/target actions the
  user can't perform, and to back the "Bloc" HUD panel.

## Error-handling coverage (bases/trusts build & patch mutations)

`POST /api/bases`, `POST /api/trusts`, and `PATCH /api/bases/{id}` can return
`400` (credit exchange rejected), `401` (not authenticated), `402`
(insufficient credit), `403` (no write permission), `404` (placement/target
not found), `409` (placement already occupied), or `500`. Today,
`buildErrorMessage()` / `patchErrorMessage()` (`src/api/placements.ts`, the
latter covering the target picker and the enable/disable + prioritise
toggles) only special-case `401` and `403` — `400`, `402`, `404`, and `409`
all fall through to the same generic "Failed to build — try again." message.
Distinguishing these (e.g. "already built here" for `409` vs. "not enough
credit" for `402`) would need a small addition to those two functions, not
new API work.

`PATCH /api/blocs/{id}` can return `401`, `403`, `404` (bloc not found), or
`500` — no credit-exchange path, so no `400`/`402`/`409`. `blocPatchErrorMessage()`
(`src/api/blocs.ts`) special-cases `401`/`403` the same way; `404`/`500` fall
through to a generic message.

## Environment / base URL

- `VITE_API_BASE_URL` — empty in `.env.development` (requests go through the
  Vite dev proxy to avoid CORS; see `vite.config.ts`), a placeholder
  `https://example.com` in `.env.production` pending a real deployment URL.
- No credit-exchanger URL is configured or used on the frontend side (see
  "Domain-model corrections" above).
