import type { Financing } from './financing'

// Mirrors BaseTargetResponse in ../../../simulation/src/handlers/bases.rs
export type BaseTarget = { type: 'none' } | { type: 'base'; id: number } | { type: 'trust'; id: number }

// Mirrors BaseResponse in ../../../simulation/src/handlers/bases.rs
export interface Base {
  id: number
  placementId: string
  zone: string
  bloc: string
  payment: Financing[]
  enabled: boolean
  prioritized: boolean
  target: BaseTarget
  position: { x: number; y: number }
}
