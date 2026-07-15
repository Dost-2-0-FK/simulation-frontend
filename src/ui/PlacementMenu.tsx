import { useEffect, useState } from 'react'
import type maplibregl from 'maplibre-gl'
import type { Placement } from '../types/placement'
import type { BaseTarget } from '../types/base'
import type { Financing } from '../types/financing'
import { useBuildOnPlacement, buildErrorMessage } from '../api/placements'

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

  // Keep the menu pinned to the placement marker as the map pans/zooms.
  useEffect(() => {
    const update = () => setPos(map.project([placement.lng, placement.lat]))
    update()
    map.on('move', update)
    return () => {
      map.off('move', update)
    }
  }, [map, placement.lng, placement.lat])

  const handleBuild = (type: 'base' | 'trust') => {
    buildOnPlacement.mutate({ placementId: placement.id, type }, { onSuccess: onClose })
  }

  const { occupant } = placement
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

      {!occupant && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={buildOnPlacement.isPending}
            onClick={() => handleBuild('base')}
            className="flex-1 rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Build Base
          </button>
          <button
            type="button"
            disabled={buildOnPlacement.isPending}
            onClick={() => handleBuild('trust')}
            className="flex-1 rounded bg-green-600 px-2 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            Build Trust
          </button>
        </div>
      )}

      {occupant?.type === 'base' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            <Badge tone="gray">Bloc: {occupant.bloc}</Badge>
            <Badge tone={occupant.enabled ? 'green' : 'gray'}>{occupant.enabled ? 'Enabled' : 'Disabled'}</Badge>
            {occupant.prioritized && <Badge tone="amber">Prioritised</Badge>}
          </div>
          <div className="text-xs text-gray-500">
            Target: <span className="font-medium text-gray-700">{targetLabel(occupant.target)}</span>
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
