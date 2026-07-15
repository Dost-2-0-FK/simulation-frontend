// Zustand slices: zones, units, placements, resources

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  userKey: string | null
  /** Set when a request rejected the stored key, so the login screen can explain why it reappeared. */
  loginError: string | null
  login: (key: string) => void
  logout: (reason?: string) => void
}

// Persisted to localStorage so a page refresh doesn't force a re-login.
// Login itself does not call the backend — the key is only ever validated
// by the backend when it's used to authorize a write (build a base/trust).
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userKey: null,
      loginError: null,
      login: (key) => set({ userKey: key, loginError: null }),
      logout: (reason) => set({ userKey: null, loginError: reason ?? null }),
    }),
    { name: 'auth', partialize: (state) => ({ userKey: state.userKey }) },
  ),
)

// Non-reactive accessor for use outside React components (e.g. the API client).
export function getUserKey(): string | null {
  return useAuthStore.getState().userKey
}
