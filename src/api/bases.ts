import type { Base } from '../types/base'
import { apiGet, apiPost } from './client'

// Wire shape of GET /api/bases, confirmed against ../simulation/src/handlers/bases.rs (BaseResponse).
export async function getBases(): Promise<Base[]> {
  return apiGet<Base[]>('/api/bases')
}

// No financier — the zone/bloc covers the full cost.
export async function createBase(placementId: string): Promise<void> {
  return apiPost('/api/bases', { placementId, payment: [] })
}
