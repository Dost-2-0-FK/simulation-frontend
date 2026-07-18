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

// All three fields are independently optional server-side (PatchBaseBody in
// ../simulation/src/handlers/bases.rs) — send only what's changing.
export interface BasePatch {
  enabled?: boolean
  prioritized?: boolean
  target?: BaseTarget
}

export async function patchBase(id: number, patch: BasePatch): Promise<void> {
  return apiPatch(`/api/bases/${id}`, patch)
}
