import type { Financing } from './financing'

// Mirrors TrustResponse in ../../../simulation/src/handlers/trusts.rs
export interface Trust {
  id: number
  placementId: string
  zone: string
  payment: Financing[]
  position: { x: number; y: number }
}
