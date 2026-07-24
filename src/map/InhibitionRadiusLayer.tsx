import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection, Polygon } from 'geojson'
import type { Placement } from '../types/placement'
import { normalizeLngLat } from '../bridge'

interface Props {
  map: maplibregl.Map | null
  placements: Placement[]
  // Placement id of the trust whose "Inhibition Radius" menu item is currently
  // hovered/pinned open — drawn in a neutral accent color.
  highlightedPlacementId: string | null
  // Placement ids of trusts that currently have an enemy unit inside their
  // inhibition radius — drawn in a signal/danger color, regardless of hover state.
  threatenedPlacementIds: Set<string>
}

const SOURCE_ID = 'inhibition-radius'
const FILL_LAYER_ID = 'inhibition-radius-fill'
const LINE_LAYER_ID = 'inhibition-radius-line'

const HIGHLIGHT_COLOR = '#16A34A' // green-600, matches the trust marker/build-trust accent
const THREAT_COLOR = '#DC2626' // red-600, matches the combat-ring signal color in placementIcons.ts

const CIRCLE_STEPS = 64

type Variant = 'highlight' | 'threat'

// Builds a circle polygon in the same flat lng/lat-as-Cartesian space the backend uses for its
// own Distance calculation (../simulation/src/geometry.rs — Distance::from_components is a plain
// Euclidean sqrt(dx^2+dy^2), not a spherical/haversine distance), so a simple trig offset matches
// the radius the backend actually enforces.
function circleRing(lng: number, lat: number, radius: number): [number, number][] {
  const ring: [number, number][] = []
  for (let i = 0; i <= CIRCLE_STEPS; i++) {
    const angle = (i / CIRCLE_STEPS) * 2 * Math.PI
    const point = normalizeLngLat(lng + radius * Math.cos(angle), lat + radius * Math.sin(angle))
    ring.push([point.lng, point.lat])
  }
  return ring
}

function toGeoJSON(
  placements: Placement[],
  highlightedPlacementId: string | null,
  threatenedPlacementIds: Set<string>,
): FeatureCollection<Polygon, { variant: Variant }> {
  const features: FeatureCollection<Polygon, { variant: Variant }>['features'] = []
  for (const p of placements) {
    if (p.occupant?.type !== 'trust') continue
    const variant: Variant | null = threatenedPlacementIds.has(p.id)
      ? 'threat'
      : p.id === highlightedPlacementId
        ? 'highlight'
        : null
    if (!variant) continue
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [circleRing(p.lng, p.lat, p.occupant.inhibitionRadius)] },
      properties: { variant },
    })
  }
  return { type: 'FeatureCollection', features }
}

export default function InhibitionRadiusLayer({ map, placements, highlightedPlacementId, threatenedPlacementIds }: Props) {
  // Same ref-mirroring pattern as PlacementsLayer/UnitsLayer — ensureLayer (registered once
  // per map instance) needs the latest values without forcing that whole effect to re-run.
  const placementsRef = useRef(placements)
  useEffect(() => {
    placementsRef.current = placements
  }, [placements])
  const highlightedRef = useRef(highlightedPlacementId)
  useEffect(() => {
    highlightedRef.current = highlightedPlacementId
  }, [highlightedPlacementId])
  const threatenedRef = useRef(threatenedPlacementIds)
  useEffect(() => {
    threatenedRef.current = threatenedPlacementIds
  }, [threatenedPlacementIds])

  // Register the source/layers once per map instance. Re-added on both 'styledata' and
  // 'idle' so they survive MapLibre style resets — see PlacementsLayer.tsx's comment on
  // why 'styledata' alone isn't reliably fired again.
  useEffect(() => {
    if (!map) return

    const ensureLayer = () => {
      if (!map.isStyleLoaded()) return
      if (map.getSource(SOURCE_ID)) return

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: toGeoJSON(placementsRef.current, highlightedRef.current, threatenedRef.current),
      })
      map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': ['match', ['get', 'variant'], 'threat', THREAT_COLOR, HIGHLIGHT_COLOR],
          'fill-opacity': 0.12,
        },
      })
      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': ['match', ['get', 'variant'], 'threat', THREAT_COLOR, HIGHLIGHT_COLOR],
          'line-width': 2,
        },
      })
    }

    map.on('styledata', ensureLayer)
    map.on('idle', ensureLayer)
    ensureLayer()

    return () => {
      map.off('styledata', ensureLayer)
      map.off('idle', ensureLayer)
      if (!map.getStyle()) return
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID)
      if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])

  // Push data updates into the existing source whenever the inputs change.
  useEffect(() => {
    if (!map) return
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    source?.setData(toGeoJSON(placements, highlightedPlacementId, threatenedPlacementIds))
  }, [map, placements, highlightedPlacementId, threatenedPlacementIds])

  return null
}
