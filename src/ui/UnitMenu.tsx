import { useEffect, useState } from 'react'
import type maplibregl from 'maplibre-gl'
import type { Unit, UnitTarget } from '../types/unit'

interface Props {
  map: maplibregl.Map
  unit: Unit
}

function targetLabel(target: UnitTarget): string {
  switch (target.type) {
    case 'none':
      return 'None'
    case 'unit':
      return `Enemy unit #${target.id.slice(0, 8)}`
    case 'base':
      return `Base #${target.id}`
    case 'trust':
      return `Trust #${target.id}`
  }
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'blue' | 'gray' }) {
  const toneClasses = { blue: 'bg-blue-100 text-blue-700', gray: 'bg-gray-100 text-gray-500' }[tone]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses}`}>{children}</span>
}

// Read-only hover tooltip for a unit — unlike PlacementMenu it has no close button or
// actions (there's nothing to build/mutate on a unit) and no pointer events of its own,
// so hovering the tooltip itself never blocks the underlying map's mouseleave detection.
export default function UnitMenu({ map, unit }: Props) {
  const [pos, setPos] = useState(() => map.project([unit.lng, unit.lat]))

  // Keep the tooltip pinned to the unit marker as the map pans/zooms.
  useEffect(() => {
    const update = () => setPos(map.project([unit.lng, unit.lat]))
    update()
    map.on('move', update)
    return () => {
      map.off('move', update)
    }
  }, [map, unit.lng, unit.lat])

  return (
    <div
      className="pointer-events-none absolute z-30 w-56 -translate-x-1/2 -translate-y-full rounded-lg border border-t-4 border-t-gray-500 bg-white p-3 shadow-lg"
      style={{ left: pos.x, top: pos.y - 12 }}
    >
      <div className="mb-2">
        <div className="text-sm font-semibold">
          Unit <span className="font-normal text-gray-400">#{unit.id.slice(0, 8)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <Badge tone="blue">Bloc: {unit.bloc ?? 'None'}</Badge>
        <Badge tone="gray">{unit.base ? `Base #${unit.base.id}` : 'No base'}</Badge>
      </div>

      {unit.base && <div className="mt-2 text-xs text-gray-500">Zone: {unit.base.zone}</div>}

      <div className="mt-2 text-xs text-gray-500">
        Target: <span className="font-medium text-gray-700">{targetLabel(unit.target)}</span>
      </div>
    </div>
  )
}
