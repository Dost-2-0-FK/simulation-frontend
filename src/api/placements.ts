import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Placement } from '../types/placement'
import { apiGet, ApiError } from './client'
import { getBases, createBase } from './bases'
import { getTrusts, createTrust } from './trusts'
import { INTERVALS } from './intervals'
import { useAuthStore } from '../store'

// Wire shape of GET /api/placements, confirmed against the running backend.
interface PlacementResponse {
  id: string
  zone: string
  position: { x: number; y: number }
}

// GET /api/placements doesn't carry occupancy itself — it's derived by joining
// against /api/bases and /api/trusts by placementId.
async function getPlacements(): Promise<Placement[]> {
  const [placements, bases, trusts] = await Promise.all([
    apiGet<PlacementResponse[]>('/api/placements'),
    getBases(),
    getTrusts(),
  ])

  const occupants = new Map<string, Placement['occupant']>()
  for (const base of bases) occupants.set(base.placementId, { type: 'base', ...base })
  for (const trust of trusts) occupants.set(trust.placementId, { type: 'trust', ...trust })

  return placements.map((p) => ({
    id: p.id,
    zone: p.zone,
    lng: p.position.x,
    lat: p.position.y,
    occupant: occupants.get(p.id) ?? null,
  }))
}

export function usePlacements() {
  return useQuery({
    queryKey: ['placements'],
    queryFn: getPlacements,
    refetchInterval: INTERVALS.placements,
  })
}

export function useBuildOnPlacement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ placementId, type }: { placementId: string; type: 'base' | 'trust' }) =>
      type === 'base' ? createBase(placementId) : createTrust(placementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['placements'] })
    },
    onError: (error) => {
      // A missing/invalid key means the backend never recognized it — clear it so the
      // login screen reappears rather than letting the user keep hitting the same wall.
      if (error instanceof ApiError && error.status === 401) {
        useAuthStore.getState().logout('Your key was rejected. Please log in again.')
      }
    },
  })
}

// Human-readable explanation for a failed build, distinguishing "you're not logged
// in (or your key is invalid)" from "your key doesn't grant access to this bloc/zone".
export function buildErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your key is missing or invalid. Please log in again.'
    if (error.status === 403) return "Your key doesn't have write access here."
  }
  return 'Failed to build — try again.'
}
