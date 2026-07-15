import { useAuthStore } from '../store'

export default function LogoutButton() {
  const logout = useAuthStore((s) => s.logout)

  return (
    <button
      type="button"
      onClick={() => logout()}
      aria-label="Log out"
      title="Log out"
      className="absolute right-4 top-4 z-20 rounded-full border border-gray-300 bg-white/90 p-2 text-gray-600 shadow-lg hover:bg-white hover:text-gray-900"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 17l5-5-5-5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12H9" />
      </svg>
    </button>
  )
}
