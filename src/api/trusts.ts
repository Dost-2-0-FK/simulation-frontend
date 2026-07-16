import type { Trust } from '../types/trust'
import type { Financing } from '../types/financing'
import { apiGet, apiPost } from './client'

// Wire shape of GET /api/trusts, confirmed against ../simulation/src/handlers/trusts.rs (TrustResponse).
export async function getTrusts(): Promise<Trust[]> {
  return apiGet<Trust[]>('/api/trusts')
}

// `financing` is optional — when omitted, the zone covers the full cost. When given,
// the financier covers `financing.share` (0-1) and the zone covers the remainder.
export async function createTrust(placementId: string, resource: string, financing?: Financing): Promise<void> {
  return apiPost('/api/trusts', { placementId, resource, payment: financing ? [financing] : [] })
}
