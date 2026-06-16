import { useState, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import MapView from './map/MapView'
import PixiOverlay from './pixi/PixiOverlay'
import { MAP_WINDOW } from './config/mapLayout'

export default function App() {
  const [map, setMap] = useState<maplibregl.Map | null>(null)

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
        <PixiOverlay map={map} />
      </div>
    </div>
  )
}
