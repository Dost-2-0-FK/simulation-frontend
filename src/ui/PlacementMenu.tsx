import { useEffect, useMemo, useState } from 'react'
import type maplibregl from 'maplibre-gl'
import type { Placement } from '../types/placement'
import type { BaseTarget } from '../types/base'
import type { Financing } from '../types/financing'
import { useBuildOnPlacement, usePlacements, useSetBaseTarget, buildErrorMessage, targetErrorMessage } from '../api/placements'

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
  const setBaseTarget = useSetBaseTarget()
  const [buildMode, setBuildMode] = useState<'base' | 'trust' | null>(null)
  const [resource, setResource] = useState('')
  const [financierId, setFinancierId] = useState('')
  const [sharePercent, setSharePercent] = useState('')

  // Shares the ['placements'] query cache already populated by App.tsx — no extra fetch.
  const { data: allPlacements = [] } = usePlacements()
  const { occupant } = placement
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
    setBaseTarget.mutate({ baseId: occupant.id, target: parseTargetKey(selectedTargetKey) })
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

  const trimmedFinancierId = financierId.trim()
  const parsedShare = sharePercent.trim() === '' ? null : Number(sharePercent) / 100
  const shareValid = parsedShare === null || (Number.isFinite(parsedShare) && parsedShare > 0 && parsedShare <= 1)
  // Financier and share must be supplied together, or not at all.
  const financierValid = (trimmedFinancierId === '') === (parsedShare === null)
  const canSubmitBuild = financierValid && shareValid && (buildMode !== 'trust' || resource.trim() !== '')

  const handleConfirmBuild = () => {
    if (!canSubmitBuild || buildMode === null) return
    const financing = trimmedFinancierId && parsedShare !== null ? { financierId: trimmedFinancierId, share: parsedShare } : undefined
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
            onClick={() => setBuildMode('base')}
            className="flex-1 rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Build Base
          </button>
          <button
            type="button"
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
              <input
                type="text"
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                placeholder="e.g. oil"
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
          )}
          <div className="text-xs font-medium text-gray-500">Financier (optional)</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={financierId}
              onChange={(e) => setFinancierId(e.target.value)}
              placeholder="User ID"
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={sharePercent}
              onChange={(e) => setSharePercent(e.target.value)}
              placeholder="Share %"
              className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          {!financierValid && (
            <div className="text-xs text-red-600">Provide both a financier user ID and a share, or leave both empty.</div>
          )}
          {financierValid && !shareValid && <div className="text-xs text-red-600">Share must be between 0% and 100%.</div>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setBuildMode(null)
                setResource('')
                setFinancierId('')
                setSharePercent('')
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
            <Badge tone={occupant.enabled ? 'green' : 'gray'}>{occupant.enabled ? 'Enabled' : 'Disabled'}</Badge>
            {occupant.prioritized && <Badge tone="amber">Prioritised</Badge>}
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">
              Target <span className="font-normal text-gray-400">— current: {targetLabel(occupant.target)}</span>
            </div>
            <div className="flex gap-2">
              <select
                value={selectedTargetKey}
                onChange={(e) => setSelectedTargetKey(e.target.value)}
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
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
                disabled={setBaseTarget.isPending || selectedTargetKey === targetKey(occupant.target)}
                onClick={handleSetTarget}
                className="rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Set
              </button>
            </div>
            {setBaseTarget.isError && (
              <div className="mt-1 text-xs text-red-600">{targetErrorMessage(setBaseTarget.error)}</div>
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
