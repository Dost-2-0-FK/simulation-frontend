// Zustand slices: zones, units, placements, resources

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as authApi from '../api/auth'

interface AuthState {
  userId: string | null
  /** Set when login or a later request was rejected, so the login screen can explain why it (re)appeared. */
  loginError: string | null
  login: (userId: string, password: string) => Promise<void>
  logout: (reason?: string) => void
}

// `userId` is persisted to localStorage purely so the HUD doesn't flash the
// login modal on refresh — the real session lives in the backend's cookie
// (actix-identity). If that cookie has expired, the next authenticated
// request 401s and the caller logs out again via `logout(reason)`.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      loginError: null,
      login: async (userId, password) => {
        const authenticatedUserId = await authApi.login(userId, password)
        set({ userId: authenticatedUserId, loginError: null })
      },
      logout: (reason) => {
        set({ userId: null, loginError: reason ?? null })
        // Best-effort — the local session is cleared either way, and a failed
        // request here shouldn't stop the user from seeing the login screen.
        void authApi.logout()
      },
    }),
    { name: 'auth', partialize: (state) => ({ userId: state.userId }) },
  ),
)

// Non-reactive accessor for use outside React components.
export function getUserId(): string | null {
  return useAuthStore.getState().userId
}
