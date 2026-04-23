// Centralised polling intervals — adjust here without hunting through components.
// All values in milliseconds.

export const INTERVALS = {
  /** Unit positions + combat state. Units move every minute; 10s gives smooth visual updates. */
  units: 10_000,

  /** Placement / base / trust state. Changes on player action. */
  placements: 15_000,

  /** Zone resources / money. Updated hourly by the backend. */
  zoneResources: 30_000,
} as const
