import { useEffect, useMemo, useState } from 'react'
import type maplibregl from 'maplibre-gl'
import type { Placement } from '../types/placement'
import type { BaseTarget } from '../types/base'
import type { Financing } from '../types/financing'
import { useBuildOnPlacement, usePlacements, usePatchBase, buildErrorMessage, patchErrorMessage } from '../api/placements'
import { useCurrentUser, canWriteBloc, canWriteZone } from '../api/auth'
import { useZones } from '../api/zones'
import { useResources } from '../api/resources'

interface Props {
  map: maplibregl.Map
  placement: Placement
  onClose: () => void
}

function targetLabel(target: BaseTarget): string {
  switch (target.type) {
    case 'none':
      return 'Nearest enemy unit'
    case 'base':
      return `Base #${target.id}`
    case 'trust':
      return `Trust #${target.id}`
  }
}

// Encodes a BaseTarget as a flat string for use as a <select> option value, since
// 'base'/'trust' targets need their id alongside the type to stay distinguishable.
function targetKey(target: BaseTarget): string {
  return target.type === 'none' ? 'none' : `${target.type}:${target.id}`
}

function parseTargetKey(key: string): BaseTarget {
  if (key === 'none') return { type: 'none' }
  const [type, idStr] = key.split(':')
  const id = Number(idStr)
  return type === 'base' ? { type: 'base', id } : { type: 'trust', id }
}

function FinancingList({ payment, fallbackLabel }: { payment: Financing[]; fallbackLabel: string }) {
  if (payment.length === 0) {
    return <div className="text-xs italic text-gray-400">{fallbackLabel}</div>
  }
  return (
    <ul className="space-y-1">
      {payment.map((f) => (
        <li key={f.financierId} className="flex items-center justify-between text-xs text-gray-600">
          <span className="truncate pr-2">{f.financierId}</span>
          <span className="font-medium text-gray-800">{Math.round(f.share * 100)}%</span>
        </li>
      ))}
    </ul>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'green' | 'gray' | 'amber' }) {
  const toneClasses = {
    green: 'bg-green-100 text-green-700',
    gray: 'bg-gray-100 text-gray-500',
    amber: 'bg-amber-100 text-amber-700',
  }[tone]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses}`}>{children}</span>
}

export default function PlacementMenu({ map, placement, onClose }: Props) {
  const [pos, setPos] = useState(() => map.project([placement.lng, placement.lat]))
  const buildOnPlacement = useBuildOnPlacement()
  // Separate mutation instances per action (target/enabled/prioritized) so each button's
  // isPending/isError reflects only the action it triggered, not the other two.
  const setBaseTarget = usePatchBase()
  const toggleBaseEnabled = usePatchBase()
  const toggleBasePrioritized = usePatchBase()
  const [buildMode, setBuildMode] = useState<'base' | 'trust' | null>(null)
  const [resource, setResource] = useState('')
  const [financierRows, setFinancierRows] = useState<{ financierId: string; sharePercent: string }[]>([])

  // Shares the ['placements'] query cache already populated by App.tsx — no extra fetch.
  const { data: allPlacements = [] } = usePlacements()
  const { occupant } = placement

  // Gate build/patch actions on permissions from GET /api/me so the UI can disable what the
  // user can't do, rather than letting them submit and only find out from a 403 afterwards.
  const { data: currentUser } = useCurrentUser()
  const { data: zones = [] } = useZones()
  const { data: resources = [] } = useResources()
  const placementBloc = zones.find((z) => z.name === placement.zone)?.bloc ?? null
  const canBuildBase = placementBloc !== null && canWriteBloc(currentUser, placementBloc)
  const canBuildTrust = canWriteZone(currentUser, placement.zone)
  const canManageBase = occupant?.type === 'base' && canWriteBloc(currentUser, occupant.bloc)
  const targetOptions = useMemo(() => {
    if (occupant?.type !== 'base') return []
    return allPlacements
      .map((p) => p.occupant)
      .filter((o): o is NonNullable<Placement['occupant']> => o !== null && !(o.type === 'base' && o.id === occupant.id))
      .map((o) => ({ key: `${o.type}:${o.id}`, label: o.type === 'base' ? `Base #${o.id} (${o.bloc})` : `Trust #${o.id} (${o.zone})` }))
  }, [allPlacements, occupant])

  // Reset the picker to the base's current target whenever that target changes underneath us
  // (e.g. after our own mutation succeeds, or another player's edit is picked up by polling).
  // Adjusted during render rather than in an effect, per https://react.dev/learn/you-might-not-need-an-effect.
  const currentTargetKey = occupant?.type === 'base' ? targetKey(occupant.target) : 'none'
  const [selectedTargetKey, setSelectedTargetKey] = useState(currentTargetKey)
  const [syncedTargetKey, setSyncedTargetKey] = useState(currentTargetKey)
  if (currentTargetKey !== syncedTargetKey) {
    setSyncedTargetKey(currentTargetKey)
    setSelectedTargetKey(currentTargetKey)
  }

  const handleSetTarget = () => {
    if (occupant?.type !== 'base') return
    setBaseTarget.mutate({ baseId: occupant.id, patch: { target: parseTargetKey(selectedTargetKey) } })
  }

  const handleToggleEnabled = () => {
    if (occupant?.type !== 'base') return
    toggleBaseEnabled.mutate({ baseId: occupant.id, patch: { enabled: !occupant.enabled } })
  }

  const handleTogglePrioritized = () => {
    if (occupant?.type !== 'base') return
    toggleBasePrioritized.mutate({ baseId: occupant.id, patch: { prioritized: !occupant.prioritized } })
  }

  // Keep the menu pinned to the placement marker as the map pans/zooms.
  useEffect(() => {
    const update = () => setPos(map.project([placement.lng, placement.lat]))
    update()
    map.on('move', update)
    return () => {
      map.off('move', update)
    }
  }, [map, placement.lng, placement.lat])

  // Each row parses independently: blank rows are dropped, fully-filled rows become a Financing,
  // and a row with only one of the two fields filled makes the whole form invalid.
  const parsedFinancierRows = financierRows.map((row) => {
    const trimmedFinancierId = row.financierId.trim()
    const parsedShare = row.sharePercent.trim() === '' ? null : Number(row.sharePercent) / 100
    const shareValid = parsedShare === null || (Number.isFinite(parsedShare) && parsedShare > 0 && parsedShare <= 1)
    const rowValid = (trimmedFinancierId === '') === (parsedShare === null) && shareValid
    return { trimmedFinancierId, parsedShare, shareValid, rowValid }
  })
  const financierRowsValid = parsedFinancierRows.every((row) => row.rowValid)
  const financing: Financing[] = parsedFinancierRows
    .filter((row) => row.trimmedFinancierId !== '' && row.parsedShare !== null)
    .map((row) => ({ financierId: row.trimmedFinancierId, share: row.parsedShare as number }))
  const canSubmitBuild = financierRowsValid && (buildMode !== 'trust' || resource.trim() !== '')

  const addFinancierRow = () => setFinancierRows((rows) => [...rows, { financierId: '', sharePercent: '' }])
  const removeFinancierRow = (index: number) => setFinancierRows((rows) => rows.filter((_, i) => i !== index))
  const updateFinancierRow = (index: number, patch: Partial<{ financierId: string; sharePercent: string }>) =>
    setFinancierRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const handleConfirmBuild = () => {
    if (!canSubmitBuild || buildMode === null) return
    const input =
      buildMode === 'base'
        ? ({ placementId: placement.id, type: 'base' as const, financing })
        : ({ placementId: placement.id, type: 'trust' as const, resource: resource.trim(), financing })
    buildOnPlacement.mutate(input, { onSuccess: onClose })
  }

  const accentClass = occupant?.type === 'base' ? 'border-t-blue-600' : occupant?.type === 'trust' ? 'border-t-green-600' : 'border-t-gray-300'

  return (
    <div
      className={`absolute z-30 w-64 -translate-x-1/2 -translate-y-full rounded-lg border border-t-4 border-gray-300 bg-white p-3 shadow-lg ${accentClass}`}
      style={{ left: pos.x, top: pos.y - 12 }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-2 top-2 leading-none text-gray-400 hover:text-gray-700"
      >
        ×
      </button>

      <div className="mb-2 pr-4">
        <div className="text-sm font-semibold">
          {occupant?.type === 'base' ? 'Base' : occupant?.type === 'trust' ? 'Trust' : 'Empty Placement'}{' '}
          <span className="font-normal text-gray-400">#{placement.id}</span>
        </div>
        <div className="text-xs text-gray-500">Zone: {placement.zone}</div>
      </div>

      {!occupant && buildMode === null && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canBuildBase}
            title={canBuildBase ? undefined : "You don't have write access to this bloc."}
            onClick={() => setBuildMode('base')}
            className="flex-1 rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Build Base
          </button>
          <button
            type="button"
            disabled={!canBuildTrust}
            title={canBuildTrust ? undefined : "You don't have write access to this zone."}
            onClick={() => setBuildMode('trust')}
            className="flex-1 rounded bg-green-600 px-2 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            Build Trust
          </button>
        </div>
      )}

      {!occupant && buildMode !== null && (
        <div className="space-y-2">
          {buildMode === 'trust' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Resource</label>
              <select
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="" disabled>
                  Select a resource…
                </option>
                {resources.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="text-xs font-medium text-gray-500">Financiers (optional)</div>
          {financierRows.map((row, index) => {
            const rowState = parsedFinancierRows[index]
            return (
              <div key={index} className="relative rounded-md border border-gray-200 bg-gray-50 p-2 pr-7 shadow-sm">
                <button
                  type="button"
                  onClick={() => removeFinancierRow(index)}
                  aria-label="Remove financier"
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-red-600"
                >
                  ×
                </button>
                <div className="space-y-1.5">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      User ID
                    </label>
                    <input
                      type="text"
                      value={row.financierId}
                      onChange={(e) => updateFinancierRow(index, { financierId: e.target.value })}
                      placeholder="e.g. player-42"
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      Share
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={row.sharePercent}
                        onChange={(e) => updateFinancierRow(index, { sharePercent: e.target.value })}
                        placeholder="0"
                        className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      <span className="text-xs text-gray-400">%</span>
                    </div>
                  </div>
                </div>
                {!rowState.rowValid && (
                  <div className="mt-1.5 text-xs text-red-600">
                    {rowState.shareValid
                      ? 'Provide both a financier user ID and a share, or leave both empty.'
                      : 'Share must be between 0% and 100%.'}
                  </div>
                )}
              </div>
            )
          })}
          <button
            type="button"
            onClick={addFinancierRow}
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            + add financier
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setBuildMode(null)
                setResource('')
                setFinancierRows([])
              }}
              className="flex-1 rounded bg-gray-200 px-2 py-1 text-sm text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={buildOnPlacement.isPending || !canSubmitBuild}
              onClick={handleConfirmBuild}
              className={`flex-1 rounded px-2 py-1 text-sm text-white disabled:opacity-50 ${buildMode === 'base' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {occupant?.type === 'base' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            <Badge tone="gray">Bloc: {occupant.bloc}</Badge>
            <button
              type="button"
              disabled={!canManageBase || toggleBaseEnabled.isPending}
              title={canManageBase ? undefined : "You don't have write access to this bloc."}
              onClick={handleToggleEnabled}
              className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${occupant.enabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              {occupant.enabled ? 'Enabled' : 'Disabled'}
            </button>
            <button
              type="button"
              disabled={!canManageBase || toggleBasePrioritized.isPending}
              title={canManageBase ? undefined : "You don't have write access to this bloc."}
              onClick={handleTogglePrioritized}
              className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${occupant.prioritized ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              {occupant.prioritized ? 'Prioritised' : 'Not prioritised'}
            </button>
          </div>
          {toggleBaseEnabled.isError && (
            <div className="text-xs text-red-600">{patchErrorMessage(toggleBaseEnabled.error)}</div>
          )}
          {toggleBasePrioritized.isError && (
            <div className="text-xs text-red-600">{patchErrorMessage(toggleBasePrioritized.error)}</div>
          )}
          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">
              Target <span className="font-normal text-gray-400">— current: {targetLabel(occupant.target)}</span>
            </div>
            <div className="flex gap-2">
              <select
                value={selectedTargetKey}
                onChange={(e) => setSelectedTargetKey(e.target.value)}
                disabled={!canManageBase}
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
              >
                <option value="none">Nearest enemy unit</option>
                {targetOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!canManageBase || setBaseTarget.isPending || selectedTargetKey === targetKey(occupant.target)}
                title={canManageBase ? undefined : "You don't have write access to this bloc."}
                onClick={handleSetTarget}
                className="rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Set
              </button>
            </div>
            {setBaseTarget.isError && (
              <div className="mt-1 text-xs text-red-600">{patchErrorMessage(setBaseTarget.error)}</div>
            )}
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">Financing</div>
            <FinancingList payment={occupant.payment} fallbackLabel="Fully funded by bloc" />
          </div>
        </div>
      )}

      {occupant?.type === 'trust' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            <Badge tone="green">Produces: {occupant.resource}</Badge>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">Financing</div>
            <FinancingList payment={occupant.payment} fallbackLabel="Fully funded by zone" />
          </div>
        </div>
      )}

      {buildOnPlacement.isError && (
        <div className="mt-2 text-xs text-red-600">{buildErrorMessage(buildOnPlacement.error)}</div>
      )}
    </div>
  )
}
