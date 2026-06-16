import { useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import type { Placement } from '../types/placement'

interface Props {
  map: maplibregl.Map | null
  placements: Placement[]
}

const SOURCE_ID = 'placements'
const LAYER_ID = 'placements-circle'

function toGeoJSON(placements: Placement[]): FeatureCollection<Point, { id: string; occupied: boolean }> {
  return {
    type: 'FeatureCollection',
    features: placements.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, occupied: p.occupant !== null },
    })),
  }
}

export default function PlacementsLayer({ map, placements }: Props) {
  // Create the source/layer once, tied to the map's lifecycle.
  useEffect(() => {
    if (!map) return

    const setup = () => {
      if (map.getSource(SOURCE_ID)) return

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: toGeoJSON(placements),
      })

      map.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 5,
          'circle-color': ['case', ['get', 'occupied'], '#ef4444', '#3b82f6'],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      })
    }

    if (map.isStyleLoaded()) {
      setup()
    } else {
      map.once('load', setup)
    }

    return () => {
      if (!map.getStyle()) return
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
    // Source/layer setup only needs to (re)run when the map instance changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // Push data updates into the existing source as placements change.
  useEffect(() => {
    if (!map) return
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    source?.setData(toGeoJSON(placements))
  }, [map, placements])

  return null
}
