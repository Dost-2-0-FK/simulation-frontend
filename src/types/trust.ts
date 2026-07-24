import type { Financing } from './financing'

// Mirrors TrustResponse in ../../../simulation/src/handlers/trusts.rs
export interface Trust {
  id: number
  placementId: string
  zone: string
  payment: Financing[]
  position: { x: number; y: number }
  resource: string
  // The radius (in the same flat world units as `position`) within which enemy units
  // lower this trust's resource production. Already capped server-side.
  inhibitionRadius: number
}
