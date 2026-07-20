import { useState } from 'react'
import { useAuthStore } from '../store'
import QrScanner from './qr/QrScanner'

// Parses a scanned login QR's decoded content, expected to be JSON of the shape
// {"userId": "...", "password": "..."}. Returns null (with a caller-facing reason)
// for anything else, since the scanner itself has no opinion on payload shape.
function parseLoginQr(content: string): { userId: string; password: string } | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return { error: 'QR code did not contain valid login data.' }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { error: 'QR code did not contain valid login data.' }
  }
  const { userId, password } = parsed as Record<string, unknown>
  if (typeof userId !== 'string' || !userId.trim() || typeof password !== 'string' || !password) {
    return { error: 'QR code is missing a user ID or password.' }
  }
  return { userId: userId.trim(), password }
}

// Shown centered over a blurred backdrop whenever nobody is logged in. Submits to
// POST /api/login (manually typed, or decoded from a QR code); on success the backend
// sets a session cookie and we store the returned userId. If login fails (or a later
// request 401s), `loginError` explains why.
export default function LoginModal() {
  const login = useAuthStore((s) => s.login)
  const storeLoginError = useAuthStore((s) => s.loginError)
  const [mode, setMode] = useState<'manual' | 'scan'>('manual')
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loginError = submitError ?? storeLoginError

  const attemptLogin = async (id: string, pw: string) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await login(id, pw)
    } catch {
      setSubmitError('Invalid user ID or password.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedUserId = userId.trim()
    if (!trimmedUserId || !password) return
    await attemptLogin(trimmedUserId, password)
  }

  const handleQrScan = async (content: string) => {
    const result = parseLoginQr(content)
    if ('error' in result) {
      setSubmitError(result.error)
      return
    }
    await attemptLogin(result.userId, result.password)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md">
      <div className="w-72 rounded-lg border border-gray-300 bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800">Log in</span>
          <div className="flex rounded border border-gray-300 text-xs">
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`px-2 py-1 ${mode === 'manual' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
            >
              Enter details
            </button>
            <button
              type="button"
              onClick={() => setMode('scan')}
              className={`px-2 py-1 ${mode === 'scan' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
            >
              Scan QR
            </button>
          </div>
        </div>

        {mode === 'manual' ? (
          <form onSubmit={handleSubmit}>
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
        ) : (
          <div>
            <QrScanner onScan={handleQrScan} onError={setSubmitError} />
            {loginError && <div className="mt-2 text-xs text-red-600">{loginError}</div>}
            {submitting && <div className="mt-2 text-xs text-gray-500">Logging in…</div>}
          </div>
        )}
      </div>
    </div>
  )
}
