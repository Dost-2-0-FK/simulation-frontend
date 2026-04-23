import { useState, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import MapView from './map/MapView'
import PixiOverlay from './pixi/PixiOverlay'

export default function App() {
  const [map, setMap] = useState<maplibregl.Map | null>(null)

  const handleMapReady = useCallback((m: maplibregl.Map) => {
    setMap(m)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <MapView onMapReady={handleMapReady} />
      <PixiOverlay map={map} />
    </div>
  )
}
