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
