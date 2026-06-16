import { useQuery } from '@tanstack/react-query'
import type { Placement } from '../types/placement'
import { INTERVALS } from './intervals'

// Grid centers: lines fall every 10° starting at the poles/antimeridian,
// so cell centers are offset 5° from those lines.
const LAT_MIN = -75
const LAT_MAX = 75
const LNG_MIN = -175
const LNG_MAX = 175
const STEP = 10

function generateGridPlacements(): Placement[] {
  const placements: Placement[] = []
  for (let lat = LAT_MIN; lat <= LAT_MAX; lat += STEP) {
    for (let lng = LNG_MIN; lng <= LNG_MAX; lng += STEP) {
      placements.push({
        id: `${lat}_${lng}`,
        lat,
        lng,
        occupant: null,
      })
    }
  }
  return placements
}

// Dummy implementation — replace with a fetch() against the real backend
// (GET /api/placements) once the endpoint exists. Keep the signature stable
// so callers don't need to change.
export async function getPlacements(): Promise<Placement[]> {
  return generateGridPlacements()
}

export function usePlacements() {
  return useQuery({
    queryKey: ['placements'],
    queryFn: getPlacements,
    refetchInterval: INTERVALS.placements,
  })
}
