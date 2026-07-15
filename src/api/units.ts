import { useQuery } from '@tanstack/react-query'
import type { Unit, UnitTarget } from '../types/unit'
import type { Base } from '../types/base'
import { apiGet } from './client'
import { INTERVALS } from './intervals'

// Wire shape of GET /api/units, confirmed against ../simulation/src/handlers/units.rs (UnitResponse).
interface UnitResponse {
  id: string
  position: { x: number; y: number }
  base: Base | null
  bloc: string | null
  target: UnitTarget
}

export async function getUnits(): Promise<Unit[]> {
  const units = await apiGet<UnitResponse[]>('/api/units')
  return units.map((u) => ({
    id: u.id,
    lng: u.position.x,
    lat: u.position.y,
    base: u.base,
    bloc: u.bloc,
    target: u.target,
  }))
}

export function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn: getUnits,
    refetchInterval: INTERVALS.units,
  })
}
