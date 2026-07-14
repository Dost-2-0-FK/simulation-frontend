import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import type { Placement } from '../types/placement'
import { ICON_PIXEL_RATIO, ICON_SIZE_FACTOR, getIconSpec, loadIconImage, registerIconSpec, specForPlacement } from './placementIcons'

interface Props {
  map: maplibregl.Map | null
  placements: Placement[]
  onPlacementClick?: (placement: Placement) => void
}

const SOURCE_ID = 'placements'
const LAYER_ID = 'placements-icons'

function toGeoJSON(placements: Placement[]): FeatureCollection<Point, { id: string; icon: string }> {
  return {
    type: 'FeatureCollection',
    features: placements.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, icon: registerIconSpec(specForPlacement(p)) },
    })),
  }
}

export default function PlacementsLayer({ map, placements, onPlacementClick }: Props) {
  // Keep the click handler's view of placements current without re-registering
  // the listener on every render.
  const placementsRef = useRef(placements)
  useEffect(() => {
    placementsRef.current = placements
  }, [placements])

  // Register map listeners once per map instance. The source + layer are
  // re-added on every 'styledata' event so they survive MapLibre style resets
  // (e.g. the setProjection call in MapView triggers a re-evaluation).
  useEffect(() => {
    if (!map) return

    const handleStyleImageMissing = (e: { id: string }) => {
      const spec = getIconSpec(e.id)
      if (!spec) return
      loadIconImage(spec).then((img) => {
        if (!map.hasImage(e.id)) map.addImage(e.id, img, { pixelRatio: ICON_PIXEL_RATIO })
      })
    }

    const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id as string | undefined
      const placement = id ? placementsRef.current.find((p) => p.id === id) : undefined
      if (placement) onPlacementClick?.(placement)
    }

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = ''
    }

    // Called on every 'styledata' event (fired after any style update) and
    // once immediately. Returns early if the source already exists, so it is
    // safe to call repeatedly.
    const ensureLayer = () => {
      if (!map.isStyleLoaded()) return
      if (map.getSource(SOURCE_ID)) return

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: toGeoJSON(placementsRef.current),
      })

      map.addLayer({
        id: LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': ICON_SIZE_FACTOR,
          'icon-allow-overlap': true,
        },
      })
    }

    map.on('styleimagemissing', handleStyleImageMissing)
    map.on('click', LAYER_ID, handleClick)
    map.on('mouseenter', LAYER_ID, handleMouseEnter)
    map.on('mouseleave', LAYER_ID, handleMouseLeave)
    // 'styledata' can fire while sources added elsewhere (world-map image,
    // zone geojson) are still loading, so isStyleLoaded() is false on that
    // pass and never retried — MapLibre settles with an 'idle' event instead
    // of a further 'styledata', so listen for both.
    map.on('styledata', ensureLayer)
    map.on('idle', ensureLayer)
    ensureLayer()

    return () => {
      map.off('styleimagemissing', handleStyleImageMissing)
      map.off('click', LAYER_ID, handleClick)
      map.off('mouseenter', LAYER_ID, handleMouseEnter)
      map.off('mouseleave', LAYER_ID, handleMouseLeave)
      map.off('styledata', ensureLayer)
      map.off('idle', ensureLayer)
      if (!map.getStyle()) return
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps

  // Push data updates into the existing source whenever placements change.
  useEffect(() => {
    if (!map) return
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    source?.setData(toGeoJSON(placements))
  }, [map, placements])

  return null
}
