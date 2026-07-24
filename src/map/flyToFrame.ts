import type maplibregl from 'maplibre-gl'

// Eases the camera to a view that frames every given [lng, lat] point at once, so e.g. a base
// and a candidate target that's currently off-screen (or too small to tell apart at the
// current zoom) both become visible together.
export function flyToFrame(
  map: maplibregl.Map,
  points: [number, number][],
  options?: { padding?: number; maxZoom?: number; duration?: number },
) {
  if (points.length === 0) return
  const { padding = 96, maxZoom = 6, duration = 700 } = options ?? {}
  const lngs = points.map((p) => p[0])
  const lats = points.map((p) => p[1])
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
  map.fitBounds(bounds, { padding, maxZoom, duration, essential: true })
}
