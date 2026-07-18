// Mirrors CombatResponse in ../../../simulation/src/handlers/combats.rs

// `destructionThreshold` stays snake_case (`destruction_threshold`) on the wire even though
// everything else here is camelCase: the `#[serde(rename_all = "camelCase")]` on
// CombatStructureResponse is an *enum* container attribute, which only renames the variant
// tag ("type"), not the fields nested inside each variant. Don't "fix" this to camelCase.
export type CombatStructure =
  | { type: 'none' }
  | { type: 'trust'; id: number; destruction_threshold: number }
  | { type: 'base'; id: number; destruction_threshold: number }

export type CombatEvent =
  | { type: 'unitsKilled'; units: { killer: string; killed: string }[] }
  | { type: 'trustDestroyed'; id: number }
  | { type: 'baseDestroyed'; id: number }

export interface Combat {
  id: string
  position: { x: number; y: number }
  units: { bloc: string; unitIds: string[] }[]
  structure: CombatStructure
  state: 'ongoing' | 'ended'
  events: CombatEvent[]
}
