import { useQuery } from '@tanstack/react-query'
import type { Zone } from '../types/zone'
import { apiGet } from './client'
import { useAuthStore } from '../store'

// GET /api/zones — just the zone→bloc mapping. Needed to know which bloc an *empty*
// placement's zone belongs to, since PlacementMenu's "Build Base" gate is per-bloc, not
// per-zone, and an empty placement has no occupant to read a bloc off of directly.
async function getZones(): Promise<Zone[]> {
  return apiGet<Zone[]>('/api/zones')
}

export function useZones() {
  const userId = useAuthStore((s) => s.userId)
  return useQuery({
    queryKey: ['zones'],
    queryFn: getZones,
    enabled: userId !== null,
  })
}
