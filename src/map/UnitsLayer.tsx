import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import type { Unit } from '../types/unit'
import {
  HOVER_ICON_SIZE_EXPRESSION,
  ICON_PIXEL_RATIO,
  UNIT_ICON_SIZE_FACTOR,
  getIconSpec,
  loadIconImage,
  registerIconSpec,
  specForUnit,
} from './placementIcons'

interface Props {
  map: maplibregl.Map | null
  units: Unit[]
  combatUnitIds: Set<string>
  onUnitHover?: (unit: Unit | null) => void
}

const SOURCE_ID = 'units'
const LAYER_ID = 'units-icons'

function toGeoJSON(
  units: Unit[],
  combatUnitIds: Set<string>,
  hoveredId: string | null,
): FeatureCollection<Point, { id: string; icon: string; hover: boolean }> {
  return {
    type: 'FeatureCollection',
    features: units.map((u) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [u.lng, u.lat] },
      properties: {
        id: u.id,
        icon: registerIconSpec(specForUnit(u, combatUnitIds.has(u.id))),
        hover: u.id === hoveredId,
      },
    })),
  }
}

export default function UnitsLayer({ map, units, combatUnitIds, onUnitHover }: Props) {
  // Keep the hover handler's view of units current without re-registering
  // the listener on every render.
  const unitsRef = useRef(units)
  useEffect(() => {
    unitsRef.current = units
  }, [units])

  // Same pattern as unitsRef — ensureLayer (registered once per map instance) needs the
  // latest combat set without forcing that whole effect to re-run when it changes.
  const combatUnitIdsRef = useRef(combatUnitIds)
  useEffect(() => {
    combatUnitIdsRef.current = combatUnitIds
  }, [combatUnitIds])

  // Tracks which unit is currently hovered so mousemove only fires onUnitHover
  // (and pushes the source's 'hover' property, used by the icon-size expression
  // to enlarge the marker) when the hovered feature actually changes.
  const hoveredIdRef = useRef<string | null>(null)

  // Register map listeners once per map instance. The source + layer are
  // re-added on every 'styledata'/'idle' event so they survive MapLibre style
  // resets — see PlacementsLayer.tsx for why both events are needed.
  useEffect(() => {
    if (!map) return

    const handleStyleImageMissing = (e: { id: string }) => {
      const spec = getIconSpec(e.id)
      if (!spec) return
      loadIconImage(spec).then((img) => {
        if (!map.hasImage(e.id)) map.addImage(e.id, img, { pixelRatio: ICON_PIXEL_RATIO })
      })
    }

    const handleMouseMove = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id as string | undefined
      map.getCanvas().style.cursor = 'pointer'
      if (id === hoveredIdRef.current) return
      hoveredIdRef.current = id ?? null
      const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
      source?.setData(toGeoJSON(unitsRef.current, combatUnitIdsRef.current, hoveredIdRef.current))
      const unit = id ? unitsRef.current.find((u) => u.id === id) : undefined
      onUnitHover?.(unit ?? null)
    }

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = ''
      if (hoveredIdRef.current !== null) {
        hoveredIdRef.current = null
        const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
        source?.setData(toGeoJSON(unitsRef.current, combatUnitIdsRef.current, null))
      }
      onUnitHover?.(null)
    }

    const ensureLayer = () => {
      if (!map.isStyleLoaded()) return
      if (map.getSource(SOURCE_ID)) return

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: toGeoJSON(unitsRef.current, combatUnitIdsRef.current, hoveredIdRef.current),
      })

      map.addLayer({
        id: LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': HOVER_ICON_SIZE_EXPRESSION(UNIT_ICON_SIZE_FACTOR),
          'icon-allow-overlap': true,
        },
      })
    }

    map.on('styleimagemissing', handleStyleImageMissing)
    map.on('mousemove', LAYER_ID, handleMouseMove)
    map.on('mouseleave', LAYER_ID, handleMouseLeave)
    map.on('styledata', ensureLayer)
    map.on('idle', ensureLayer)
    ensureLayer()

    return () => {
      map.off('styleimagemissing', handleStyleImageMissing)
      map.off('mousemove', LAYER_ID, handleMouseMove)
      map.off('mouseleave', LAYER_ID, handleMouseLeave)
      map.off('styledata', ensureLayer)
      map.off('idle', ensureLayer)
      if (!map.getStyle()) return
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps

  // Push data updates into the existing source whenever units or combat state change.
  useEffect(() => {
    if (!map) return
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    source?.setData(toGeoJSON(units, combatUnitIds, hoveredIdRef.current))
  }, [map, units, combatUnitIds])

  return null
}
