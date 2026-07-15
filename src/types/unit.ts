import type { Base } from './base'

// Mirrors UnitTargetResponse in ../../../simulation/src/handlers/units.rs
export type UnitTarget =
  | { type: 'none' }
  | { type: 'unit'; id: string; position: { x: number; y: number } }
  | { type: 'base'; id: number; position: { x: number; y: number } }
  | { type: 'trust'; id: number; position: { x: number; y: number } }

// Mirrors UnitResponse in ../../../simulation/src/handlers/units.rs, with position
// split into lng/lat (mirroring Placement) since that's what the map layer/menu need.
export interface Unit {
  id: string
  lng: number
  lat: number
  base: Base | null
  bloc: string | null
  target: UnitTarget
}
