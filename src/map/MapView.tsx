import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'

interface Props {
  onMapReady?: (map: maplibregl.Map) => void
}

export default function MapView({ onMapReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      // Blank style — no external tile server needed
      style: {
        version: 8,
        sources: {},
        layers: [],
      },
      center: [0, 20],
      zoom: 2,
      minZoom: 1.5,
    })

    map.on('load', () => {
      // Add the world map jpg as a geographic image source
      map.addSource('world-map', {
        type: 'image',
        url: '/wordl-map-v1.jpg',
        // Corners: [lng, lat] — top-left, top-right, bottom-right, bottom-left
        coordinates: [
          [-180, 85],
          [180, 85],
          [180, -85],
          [-180, -85],
        ],
      })

      map.addLayer({
        id: 'world-map-layer',
        type: 'raster',
        source: 'world-map',
        paint: { 'raster-opacity': 1 },
      })

      onMapReady?.(map)
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [onMapReady])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
    />
  )
}
