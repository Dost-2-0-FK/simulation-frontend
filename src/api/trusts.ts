import type { Trust } from '../types/trust'
import { apiGet, apiPost } from './client'

// Wire shape of GET /api/trusts, confirmed against ../simulation/src/handlers/trusts.rs (TrustResponse).
export async function getTrusts(): Promise<Trust[]> {
  return apiGet<Trust[]>('/api/trusts')
}

// No financier — the zone covers the full cost.
export async function createTrust(placementId: string): Promise<void> {
  return apiPost('/api/trusts', { placementId, payment: [] })
}
