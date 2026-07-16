import { useState } from 'react'
import { useAuthStore } from '../store'

// Shown centered over a blurred backdrop whenever nobody is logged in. Submits to
// POST /api/login; on success the backend sets a session cookie and we store the
// returned userId. If login fails (or a later request 401s), `loginError` explains why.
export default function LoginModal() {
  const login = useAuthStore((s) => s.login)
  const storeLoginError = useAuthStore((s) => s.loginError)
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loginError = submitError ?? storeLoginError

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedUserId = userId.trim()
    if (!trimmedUserId || !password) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      await login(trimmedUserId, password)
    } catch {
      setSubmitError('Invalid user ID or password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md">
      <form onSubmit={handleSubmit} className="w-72 rounded-lg border border-gray-300 bg-white p-4 shadow-lg">
        <div className="mb-3 text-sm font-semibold text-gray-800">Log in</div>
        <label htmlFor="user-id" className="mb-1 block text-xs font-medium text-gray-500">
          User ID
        </label>
        <input
          id="user-id"
          type="text"
          autoFocus
          autoComplete="username"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Enter your user ID"
          className="mb-2 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
        />
        <label htmlFor="password" className="mb-1 block text-xs font-medium text-gray-500">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          className="mb-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
        />
        {loginError && <div className="mb-2 text-xs text-red-600">{loginError}</div>}
        <button
          type="submit"
          disabled={!userId.trim() || !password || submitting}
          className={`w-full rounded bg-blue-600 px-2 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 ${loginError ? '' : 'mt-2'}`}
        >
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  )
}
