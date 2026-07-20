import { useQuery } from '@tanstack/react-query'
import { apiGet } from './client'
import { useAuthStore } from '../store'

// GET /api/resources — all configured resource names a Trust can be built to produce.
async function getResources(): Promise<string[]> {
  return apiGet<string[]>('/api/resources')
}

export function useResources() {
  const userId = useAuthStore((s) => s.userId)
  return useQuery({
    queryKey: ['resources'],
    queryFn: getResources,
    enabled: userId !== null,
  })
}
