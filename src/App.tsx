import { useState, useCallback, useMemo } from 'react'
import type maplibregl from 'maplibre-gl'
import MapView from './map/MapView'
import PlacementsLayer from './map/PlacementsLayer'
import UnitsLayer from './map/UnitsLayer'
import InhibitionRadiusLayer from './map/InhibitionRadiusLayer'
import PixiOverlay from './pixi/PixiOverlay'
import PlacementMenu from './ui/PlacementMenu'
import UnitMenu from './ui/UnitMenu'
import LoginModal from './ui/LoginModal'
import LogoutButton from './ui/LogoutButton'
import BlocPanel from './ui/BlocPanel'
import { MAP_WINDOW } from './config/mapLayout'
import { usePlacements } from './api/placements'
import { useUnits } from './api/units'
import { useCombats } from './api/combats'
import { useZones } from './api/zones'
import { useAuthStore } from './store'
import type { Placement } from './types/placement'
import type { Unit } from './types/unit'

export default function App() {
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const [selectedPlacement, setSelectedPlacement] = useState<Placement | null>(null)
  const [hoveredUnit, setHoveredUnit] = useState<Unit | null>(null)
  const [highlightedInhibitionPlacementId, setHighlightedInhibitionPlacementId] = useState<string | null>(null)
  const [highlightedTargetPlacementId, setHighlightedTargetPlacementId] = useState<string | null>(null)
  const { data: placements = [] } = usePlacements()
  const { data: units = [] } = useUnits()
  const { data: combats = [] } = useCombats()
  const { data: zones = [] } = useZones()
  const userId = useAuthStore((s) => s.userId)

  // Which trusts currently have an enemy unit inside their inhibition radius — drawn on the
  // map in a signal color regardless of whether their menu is open, per the "inhibition
  // radius" mechanic (nearby enemy units lower a trust's resource production).
  const threatenedPlacementIds = useMemo(() => {
    const ids = new Set<string>()
    for (const placement of placements) {
      if (placement.occupant?.type !== 'trust') continue
      const trustBloc = zones.find((z) => z.name === placement.zone)?.bloc
      if (!trustBloc) continue
      const inhibitionRadius = placement.occupant.inhibitionRadius
      const hasEnemyInside = units.some(
        (unit) =>
          unit.bloc !== null &&
          unit.bloc !== trustBloc &&
          Math.hypot(unit.lng - placement.lng, unit.lat - placement.lat) <= inhibitionRadius,
      )
      if (hasEnemyInside) ids.add(placement.id)
    }
    return ids
  }, [placements, units, zones])

  // Cross-reference ongoing combats' participant unit IDs against currently-rendered units,
  // per CLAUDE.md's "Combat visualisation" — combat state never arrives as a field on unit
  // objects, it's a separate resource that has to be joined against unit IDs client-side.
  const combatUnitIds = useMemo(() => {
    const ids = new Set<string>()
    for (const combat of combats) {
      if (combat.state !== 'ongoing') continue
      for (const group of combat.units) {
        for (const id of group.unitIds) ids.add(id)
      }
    }
    return ids
  }, [combats])

  const handleMapReady = useCallback((m: maplibregl.Map) => {
    setMap(m)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Decorative frame — sits on top; white center disappears via multiply blend */}
      <img
        src="/frame.png"
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          zIndex: 10,
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
        }}
      />
      {/* Map window — covers the frame's white center cutout */}
      <div
        style={{
          position: 'absolute',
          zIndex: 1,
          left: MAP_WINDOW.left,
          top: MAP_WINDOW.top,
          width: MAP_WINDOW.width,
          height: MAP_WINDOW.height,
        }}
      >
        <MapView onMapReady={handleMapReady} />
        <PlacementsLayer
          map={map}
          placements={placements}
          onPlacementClick={setSelectedPlacement}
          highlightedId={highlightedTargetPlacementId}
        />
        <UnitsLayer map={map} units={units} combatUnitIds={combatUnitIds} onUnitHover={setHoveredUnit} />
        <InhibitionRadiusLayer
          map={map}
          placements={placements}
          highlightedPlacementId={highlightedInhibitionPlacementId}
          threatenedPlacementIds={threatenedPlacementIds}
        />
        <PixiOverlay map={map} />
        {map && selectedPlacement && (
          <PlacementMenu
            key={selectedPlacement.id}
            map={map}
            placement={selectedPlacement}
            onClose={() => {
              setSelectedPlacement(null)
              setHighlightedInhibitionPlacementId(null)
              setHighlightedTargetPlacementId(null)
            }}
            onInhibitionRadiusVisibilityChange={setHighlightedInhibitionPlacementId}
            onTargetOptionHighlight={setHighlightedTargetPlacementId}
          />
        )}
        {map && hoveredUnit && <UnitMenu map={map} unit={hoveredUnit} inCombat={combatUnitIds.has(hoveredUnit.id)} />}
      </div>
      {userId ? (
        <>
          <BlocPanel />
          <LogoutButton />
        </>
      ) : (
        <LoginModal />
      )}
    </div>
  )
}
