import { useState } from 'react'
import { useCurrentUser, canWriteBloc } from '../api/auth'
import { useBlocs, useUpdateBloc, blocPatchErrorMessage } from '../api/blocs'
import type { AccessLevel } from '../types/auth'
import type { Bloc } from '../types/bloc'
import type { BlocPatch } from '../api/blocs'

function AccessBadge({ level }: { level: AccessLevel }) {
  const toneClasses = level === 'write' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses}`}>{level}</span>
}

// Military expense form, shown only to users with write access to this bloc (gated by the
// caller). Backs PATCH /api/blocs/{id}. Combat chance is intentionally not settable here —
// it's shown read-only alongside the input.
function BlocSettingsForm({ bloc }: { bloc: Bloc }) {
  const updateBloc = useUpdateBloc()
  const savedExpensePercent = String(Math.round(bloc.militaryExpense * 100))

  const [expensePercent, setExpensePercent] = useState(savedExpensePercent)

  // Reset the field whenever the underlying bloc data changes (e.g. after our own mutation
  // succeeds, or another player's edit is picked up by the next poll). Adjusted during render
  // rather than in an effect, per https://react.dev/learn/you-might-not-need-an-effect — same
  // pattern as the target picker in PlacementMenu.tsx.
  const [syncedExpensePercent, setSyncedExpensePercent] = useState(savedExpensePercent)
  if (savedExpensePercent !== syncedExpensePercent) {
    setSyncedExpensePercent(savedExpensePercent)
    setExpensePercent(savedExpensePercent)
  }

  const parsedExpense = expensePercent.trim() === '' ? null : Number(expensePercent) / 100
  const expenseValid = parsedExpense === null || (Number.isFinite(parsedExpense) && parsedExpense >= 0 && parsedExpense <= 1)

  const expenseDirty = expensePercent !== savedExpensePercent
  const canSave = expenseValid && expenseDirty

  const handleSave = () => {
    if (!canSave || parsedExpense === null) return
    const patch: BlocPatch = { militaryExpense: parsedExpense }
    updateBloc.mutate({ name: bloc.name, patch })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-gray-600">Military expense</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={100}
            value={expensePercent}
            onChange={(e) => setExpensePercent(e.target.value)}
            className="w-16 rounded border border-gray-300 px-2 py-0.5 text-right text-xs"
          />
          <span className="text-xs text-gray-400">%</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-600">Combat chance</span>
        <span className="text-xs font-medium text-gray-800">{bloc.chance}</span>
      </div>
      {!expenseValid && <div className="text-xs text-red-600">Military expense must be between 0% and 100%.</div>}
      <button
        type="button"
        disabled={!canSave || updateBloc.isPending}
        onClick={handleSave}
        className="w-full rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Save
      </button>
      {updateBloc.isError && <div className="text-xs text-red-600">{blocPatchErrorMessage(updateBloc.error)}</div>}
    </div>
  )
}

function PermissionList({ permissions, emptyLabel }: { permissions: Record<string, AccessLevel>; emptyLabel: string }) {
  const entries = Object.entries(permissions)
  if (entries.length === 0) {
    return <div className="text-xs italic text-gray-400">{emptyLabel}</div>
  }
  return (
    <ul className="space-y-1">
      {entries.map(([name, level]) => (
        <li key={name} className="flex items-center justify-between text-xs text-gray-700">
          <span className="truncate pr-2">{name}</span>
          <AccessBadge level={level} />
        </li>
      ))}
    </ul>
  )
}

// Centered, backdrop-blurred window matching LoginModal's positioning idiom (fixed inset-0,
// flex-centered), but dismissable and capped to the viewport height with a scrolling body so
// long content (many blocs, many permissions) never overflows off-screen.
function CenteredWindow({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-80 flex-col rounded-lg border border-gray-300 bg-white shadow-lg"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="text-sm font-semibold text-gray-800">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="leading-none text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

// Floating button + panel showing only the logged-in user's bloc allegiance (read-only), plus
// two entry points into centered windows: one to configure a bloc (military expense, combat
// chance — for blocs the user has write access to, via GET /api/blocs / PATCH /api/blocs/{id}),
// and one to view full permissions (GET /api/me's blocPermissions/zonePermissions).
export default function BlocPanel() {
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<'configure' | 'permissions' | null>(null)
  const { data: currentUser, isLoading, isError } = useCurrentUser()
  const { data: blocs = [] } = useBlocs()

  const visibleBlocs = blocs.filter((bloc) => currentUser?.blocPermissions[bloc.name] !== undefined)
  const allegianceBlocs = Object.keys(currentUser?.blocPermissions ?? {})

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Bloc"
        title="Bloc"
        className="absolute right-16 top-4 z-20 rounded-full border border-gray-300 bg-white/90 px-3 py-2 text-sm font-medium text-gray-600 shadow-lg hover:bg-white hover:text-gray-900"
      >
        Bloc
      </button>

      {open && (
        <div className="absolute right-4 top-16 z-30 w-64 rounded-lg border border-gray-300 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">Bloc</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="leading-none text-gray-400 hover:text-gray-700"
            >
              ×
            </button>
          </div>

          {isLoading && <div className="text-xs text-gray-400">Loading…</div>}
          {isError && <div className="text-xs text-red-600">Failed to load your permissions.</div>}

          {currentUser && (
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-medium text-gray-500">Allegiance</div>
                {allegianceBlocs.length === 0 ? (
                  <div className="text-xs italic text-gray-400">No bloc allegiance.</div>
                ) : (
                  <ul className="space-y-0.5">
                    {allegianceBlocs.map((name) => (
                      <li key={name} className="text-xs text-gray-700">
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModal('configure')}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Configure bloc
                </button>
                <button
                  type="button"
                  onClick={() => setModal('permissions')}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Permissions
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {modal === 'configure' && currentUser && (
        <CenteredWindow title="Configure bloc" onClose={() => setModal(null)}>
          {visibleBlocs.length === 0 ? (
            <div className="text-xs italic text-gray-400">No bloc info visible to you.</div>
          ) : (
            <ul className="space-y-2">
              {visibleBlocs.map((bloc) => (
                <li key={bloc.name} className="rounded-md border border-gray-200 bg-gray-50 p-2">
                  <div className="mb-1 text-xs font-semibold text-gray-800">{bloc.name}</div>
                  {canWriteBloc(currentUser, bloc.name) ? (
                    <BlocSettingsForm bloc={bloc} />
                  ) : (
                    <>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Military expense</span>
                        <span className="font-medium text-gray-800">{Math.round(bloc.militaryExpense * 100)}%</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Combat chance</span>
                        <span className="font-medium text-gray-800">{bloc.chance}</span>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CenteredWindow>
      )}

      {modal === 'permissions' && currentUser && (
        <CenteredWindow title="Your permissions" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-medium text-gray-500">Blocs</div>
              <PermissionList permissions={currentUser.blocPermissions} emptyLabel="No bloc access." />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-gray-500">Zones</div>
              <PermissionList permissions={currentUser.zonePermissions} emptyLabel="No zone access." />
            </div>
          </div>
        </CenteredWindow>
      )}
    </>
  )
}
