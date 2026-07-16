import { API_BASE_URL } from '../config/api'

// Thrown on any non-2xx response so callers can branch on status — e.g. 401
// (not authenticated) vs 403 (authenticated, but no write access here).
export class ApiError extends Error {
  status: number

  constructor(method: string, path: string, status: number) {
    super(`${method} ${path} failed: ${status}`)
    this.name = 'ApiError'
    this.status = status
  }
}

// `credentials: 'include'` on every request so the session cookie set by
// POST /api/login is sent back on subsequent requests (and cleared by /api/logout).
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include' })
  if (!res.ok) throw new ApiError('GET', path, res.status)
  return res.json()
}

export async function apiPost(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError('POST', path, res.status)
}

export async function apiPatch(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError('PATCH', path, res.status)
}

// Same as apiPost, but parses and returns the JSON response body (e.g. login,
// which responds with the authenticated userId).
export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError('POST', path, res.status)
  return res.json()
}
