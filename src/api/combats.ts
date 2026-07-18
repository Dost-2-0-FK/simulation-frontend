import { useQuery } from '@tanstack/react-query'
import type { Combat } from '../types/combat'
import { apiGet } from './client'
import { INTERVALS } from './intervals'

// Wire shape of GET /api/combats, confirmed against ../simulation/src/handlers/combats.rs
// (CombatResponse). No auth/permission gating on the backend — safe to poll unconditionally,
// same as placements/units.
export async function getCombats(): Promise<Combat[]> {
  return apiGet<Combat[]>('/api/combats')
}

// Combat state is tied to unit positions/movement, so it's polled at the same cadence
// (see INTERVALS.units).
export function useCombats() {
  return useQuery({
    queryKey: ['combats'],
    queryFn: getCombats,
    refetchInterval: INTERVALS.units,
  })
}
