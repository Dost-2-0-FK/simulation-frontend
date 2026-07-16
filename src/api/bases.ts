import type { Base, BaseTarget } from '../types/base'
import { apiGet, apiPatch, apiPost } from './client'

// Wire shape of GET /api/bases, confirmed against ../simulation/src/handlers/bases.rs (BaseResponse).
export async function getBases(): Promise<Base[]> {
  return apiGet<Base[]>('/api/bases')
}

// No financier — the zone/bloc covers the full cost.
export async function createBase(placementId: string): Promise<void> {
  return apiPost('/api/bases', { placementId, payment: [] })
}

// `target` controls where this base's spawned units head once no enemy unit is closer —
// `{ type: 'none' }` clears it back to "chase nearest enemy unit only". Wire shape matches
// TargetBody in ../simulation/src/handlers/bases.rs exactly, so BaseTarget serializes as-is.
export async function setBaseTarget(id: number, target: BaseTarget): Promise<void> {
  return apiPatch(`/api/bases/${id}`, { target })
}
