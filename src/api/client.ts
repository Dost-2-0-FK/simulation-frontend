import { API_BASE_URL } from '../config/api'
import { getUserKey } from '../store'

const USER_KEY_HEADER = 'X-User-Key'

// Thrown on any non-2xx response so callers can branch on status — e.g. 401
// (missing/invalid user key) vs 403 (valid key, but no write access here).
export class ApiError extends Error {
  status: number

  constructor(method: string, path: string, status: number) {
    super(`${method} ${path} failed: ${status}`)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`)
  if (!res.ok) throw new ApiError('GET', path, res.status)
  return res.json()
}

export async function apiPost(path: string, body: unknown): Promise<void> {
  const userKey = getUserKey()
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(userKey ? { [USER_KEY_HEADER]: userKey } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError('POST', path, res.status)
}
