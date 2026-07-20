import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Placement } from '../types/placement'
import type { Financing } from '../types/financing'
import { apiGet, ApiError } from './client'
import { getBases, createBase, patchBase } from './bases'
import type { BasePatch } from './bases'
import { getTrusts, createTrust } from './trusts'
import { INTERVALS } from './intervals'
import { useAuthStore } from '../store'
import { normalizeLngLat } from '../bridge'

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

  return placements.map((p) => {
    const { lng, lat } = normalizeLngLat(p.position.x, p.position.y)
    return {
      id: p.id,
      zone: p.zone,
      lng,
      lat,
      occupant: occupants.get(p.id) ?? null,
    }
  })
}

export function usePlacements() {
  return useQuery({
    queryKey: ['placements'],
    queryFn: getPlacements,
    refetchInterval: INTERVALS.placements,
  })
}

type BuildInput =
  | { placementId: string; type: 'base'; financing: Financing[] }
  | { placementId: string; type: 'trust'; resource: string; financing: Financing[] }

export function useBuildOnPlacement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BuildInput) =>
      input.type === 'base'
        ? createBase(input.placementId, input.financing)
        : createTrust(input.placementId, input.resource, input.financing),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['placements'] })
    },
    onError: (error) => {
      // A 401 means the session cookie is missing or expired — clear local auth state so
      // the login screen reappears rather than letting the user keep hitting the same wall.
      if (error instanceof ApiError && error.status === 401) {
        useAuthStore.getState().logout('Your session expired. Please log in again.')
      }
    },
  })
}

// Human-readable explanation for a failed build, distinguishing "you're not logged
// in" from "you don't have write access to this bloc/zone".
export function buildErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'You are not logged in. Please log in again.'
    if (error.status === 403) return "You don't have write access here."
    if (error.status === 402) return 'Insufficient funds to build this.'
  }
  return 'Failed to build — try again.'
}

// Backs the target picker, and the enable/disable + prioritise toggles — each call site gets
// its own mutation instance (like PlacementMenu.tsx does) so isPending/isError track the
// specific action the user triggered rather than being shared across all three.
export function usePatchBase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ baseId, patch }: { baseId: number; patch: BasePatch }) => patchBase(baseId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['placements'] })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        useAuthStore.getState().logout('Your session expired. Please log in again.')
      }
    },
  })
}

// Human-readable explanation for a failed base patch (target/enabled/prioritized) — same
// failure modes as build.
export function patchErrorMessage(error: unknown): string {
  return buildErrorMessage(error)
}
