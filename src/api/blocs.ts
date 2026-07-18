import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Bloc } from '../types/bloc'
import { apiGet, apiPatch, ApiError } from './client'
import { useAuthStore } from '../store'

// GET /api/blocs returns every bloc unconditionally — no permission check on the backend.
// The "Bloc" panel filters this client-side to blocs the user actually has permission on.
async function getBlocs(): Promise<Bloc[]> {
  return apiGet<Bloc[]>('/api/blocs')
}

export function useBlocs() {
  const userId = useAuthStore((s) => s.userId)
  return useQuery({
    queryKey: ['blocs'],
    queryFn: getBlocs,
    enabled: userId !== null,
  })
}

// `chance` and `militaryExpense` are independently optional server-side (PatchBlocBody in
// ../simulation/src/handlers/blocs.rs) — send only what's changing.
export interface BlocPatch {
  chance?: number
  militaryExpense?: number
}

async function updateBloc(name: string, patch: BlocPatch): Promise<void> {
  return apiPatch(`/api/blocs/${name}`, patch)
}

// Backs the bloc settings form in BlocPanel.tsx (military expense / combat chance), shown
// only to users with write access to that bloc.
export function useUpdateBloc() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, patch }: { name: string; patch: BlocPatch }) => updateBloc(name, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocs'] })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        useAuthStore.getState().logout('Your session expired. Please log in again.')
      }
    },
  })
}

export function blocPatchErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'You are not logged in. Please log in again.'
    if (error.status === 403) return "You don't have write access to this bloc."
  }
  return 'Failed to update — try again.'
}
