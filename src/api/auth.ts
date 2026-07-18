import { useQuery } from '@tanstack/react-query'
import type { AccessLevel, CurrentUser } from '../types/auth'
import { apiGet, apiPost, apiPostJson } from './client'
import { useAuthStore } from '../store'

interface LoginResponse {
  userId: string
}

// POST /api/login sets a session cookie (via actix-identity) on success and
// returns the authenticated userId; see ../../simulation/src/handlers/auth.rs.
export async function login(userId: string, password: string): Promise<string> {
  const response = await apiPostJson<LoginResponse>('/api/login', { userId, password })
  return response.userId
}

// POST /api/logout clears the identity session cookie server-side.
export async function logout(): Promise<void> {
  await apiPost('/api/logout', {})
}

// GET /api/me returns the logged-in user's per-bloc and per-zone permissions, read from
// the session cookie — no params. See ../../simulation/src/handlers/auth.rs (get_current_user).
async function getCurrentUser(): Promise<CurrentUser> {
  return apiGet<CurrentUser>('/api/me')
}

// Only meaningful once logged in — disabled otherwise so we don't fire a guaranteed 401
// while the login modal is showing. Not polled: permissions only change on (re)login.
export function useCurrentUser() {
  const userId = useAuthStore((s) => s.userId)
  return useQuery({
    queryKey: ['me'],
    queryFn: getCurrentUser,
    enabled: userId !== null,
    retry: false,
    staleTime: Infinity,
  })
}

function accessLevel(permissions: Record<string, AccessLevel> | undefined, key: string): AccessLevel | null {
  return permissions?.[key] ?? null
}

export function canReadBloc(user: CurrentUser | undefined, bloc: string): boolean {
  return accessLevel(user?.blocPermissions, bloc) !== null
}

export function canWriteBloc(user: CurrentUser | undefined, bloc: string): boolean {
  return accessLevel(user?.blocPermissions, bloc) === 'write'
}

export function canReadZone(user: CurrentUser | undefined, zone: string): boolean {
  return accessLevel(user?.zonePermissions, zone) !== null
}

export function canWriteZone(user: CurrentUser | undefined, zone: string): boolean {
  return accessLevel(user?.zonePermissions, zone) === 'write'
}
