import { apiPost, apiPostJson } from './client'

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
