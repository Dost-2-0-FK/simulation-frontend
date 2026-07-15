import { useState, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import MapView from './map/MapView'
import PlacementsLayer from './map/PlacementsLayer'
import UnitsLayer from './map/UnitsLayer'
import PixiOverlay from './pixi/PixiOverlay'
import PlacementMenu from './ui/PlacementMenu'
import UnitMenu from './ui/UnitMenu'
import LoginModal from './ui/LoginModal'
import LogoutButton from './ui/LogoutButton'
import { MAP_WINDOW } from './config/mapLayout'
import { usePlacements } from './api/placements'
import { useUnits } from './api/units'
import { useAuthStore } from './store'
import type { Placement } from './types/placement'
import type { Unit } from './types/unit'

export default function App() {
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const [selectedPlacement, setSelectedPlacement] = useState<Placement | null>(null)
  const [hoveredUnit, setHoveredUnit] = useState<Unit | null>(null)
  const { data: placements = [] } = usePlacements()
  const { data: units = [] } = useUnits()
  const userKey = useAuthStore((s) => s.userKey)

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
        <PlacementsLayer map={map} placements={placements} onPlacementClick={setSelectedPlacement} />
        <UnitsLayer map={map} units={units} onUnitHover={setHoveredUnit} />
        <PixiOverlay map={map} />
        {map && selectedPlacement && (
          <PlacementMenu map={map} placement={selectedPlacement} onClose={() => setSelectedPlacement(null)} />
        )}
        {map && hoveredUnit && <UnitMenu map={map} unit={hoveredUnit} />}
      </div>
      {userKey ? <LogoutButton /> : <LoginModal />}
    </div>
  )
}
