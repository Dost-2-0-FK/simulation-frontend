import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'

interface Props {
  onMapReady?: (map: maplibregl.Map) => void
}

export default function MapView({ onMapReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null)
  const MAP_TOP_LAT = 83.42
  const MAP_BOTTOM_LAT = -85.05

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

    map.on('style.load', () => 
    {
      console.log("Before: ", map.getProjection());

      map.setProjection({
          type: 'mercator'
      });

      console.log("After: ", map.getProjection());
    });

    map.on('load', () => {
      // Add the world map jpg as a geographic image source
      map.addSource('world-map', {
        type: 'image',
        url: '/MapClean_cropped.png',
        // Corners: [lng, lat] — top-left, top-right, bottom-right, bottom-left
        // Bounds calibrated from readout measurements (83.7 / -84.8 minimises residuals)
        coordinates: [
          [-180, MAP_TOP_LAT],
          [180,  MAP_TOP_LAT],
          [180,  MAP_BOTTOM_LAT],
          [-180, MAP_BOTTOM_LAT],
        ],
      })

      map.addLayer({
        id: 'world-map-layer',
        type: 'raster',
        source: 'world-map',
        paint: { 'raster-opacity': 1 },
      })
      
      const geojsonUrl = new URL('../assets/geozones/germanyaustria.geo.json', import.meta.url).href
      
      map.addSource('germany-austria', {
        type: 'geojson',
        data: geojsonUrl,
      })
      map.addLayer({
        id: 'germany-austria-fill',
        type: 'fill',
        source: 'germany-austria',
        paint: {
          'fill-color': '#22c55e',
          'fill-opacity': 0.22,
        }
      })

      map.addLayer({
        id: 'germany-austria-outline',
        type: 'line',
        source: 'germany-austria',
        paint: {
          'line-color': '#16a34a',
          'line-width': 2,
        }
      })


      // Fit the full world map image bounds to the container with no padding
      map.fitBounds([[-180, MAP_BOTTOM_LAT], [180, MAP_TOP_LAT]], { padding: 0, animate: false })
      map.setMaxBounds([[-179.9999, MAP_BOTTOM_LAT], [179.9999, MAP_TOP_LAT]]) // stops cursor/pan from ever leaving the image

      onMapReady?.(map)
    })

    map.on('mousemove', (e) => {
      setCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat })
    })
    map.on('mouseleave', () => setCoords(null))

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
    >
      {coords && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          zIndex: 20,
          background: 'rgba(0,0,0,0.65)',
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: 12,
          padding: '4px 8px',
          borderRadius: 4,
          pointerEvents: 'none',
        }}>
          {coords.lng.toFixed(4)}°, {coords.lat.toFixed(4)}°
        </div>
      )}
    </div>
  )
}
