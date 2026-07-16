import type { Base, BaseTarget } from '../types/base'
import type { Financing } from '../types/financing'
import { apiGet, apiPatch, apiPost } from './client'

// Wire shape of GET /api/bases, confirmed against ../simulation/src/handlers/bases.rs (BaseResponse).
export async function getBases(): Promise<Base[]> {
  return apiGet<Base[]>('/api/bases')
}

// `financing` is optional — when omitted (or empty), the bloc covers the full cost. When
// given, the financiers together cover the summed `share` (0-1) and the bloc covers the remainder.
export async function createBase(placementId: string, financing: Financing[] = []): Promise<void> {
  return apiPost('/api/bases', { placementId, payment: financing })
}

// `target` controls where this base's spawned units head once no enemy unit is closer —
// `{ type: 'none' }` clears it back to "chase nearest enemy unit only". Wire shape matches
// TargetBody in ../simulation/src/handlers/bases.rs exactly, so BaseTarget serializes as-is.
export async function setBaseTarget(id: number, target: BaseTarget): Promise<void> {
  return apiPatch(`/api/bases/${id}`, { target })
}
