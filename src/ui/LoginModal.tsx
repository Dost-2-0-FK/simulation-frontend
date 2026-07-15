import { useState } from 'react'
import { useAuthStore } from '../store'

// Shown centered over a blurred backdrop whenever nobody is logged in. Login is purely
// local — the key isn't checked against the backend here, only when it's later used to
// authorize building a base/trust. If the backend ever rejects it, the caller logs out
// and sets `loginError`, which reappears here explaining why.
export default function LoginModal() {
  const login = useAuthStore((s) => s.login)
  const loginError = useAuthStore((s) => s.loginError)
  const [key, setKey] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = key.trim()
    if (!trimmed) return
    login(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md">
      <form onSubmit={handleSubmit} className="w-72 rounded-lg border border-gray-300 bg-white p-4 shadow-lg">
        <div className="mb-3 text-sm font-semibold text-gray-800">Log in</div>
        <label htmlFor="user-key" className="mb-1 block text-xs font-medium text-gray-500">
          User key
        </label>
        <input
          id="user-key"
          type="password"
          autoFocus
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Enter your user key"
          className="mb-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
        />
        {loginError && <div className="mb-2 text-xs text-red-600">{loginError}</div>}
        <button
          type="submit"
          disabled={!key.trim()}
          className={`w-full rounded bg-blue-600 px-2 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 ${loginError ? '' : 'mt-2'}`}
        >
          Log in
        </button>
      </form>
    </div>
  )
}
