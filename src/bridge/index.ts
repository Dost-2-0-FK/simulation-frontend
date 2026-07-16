// Coordinate projection: lng/lat ↔ Pixi x/y

// The backend's `position: { x, y }` is not guaranteed to fall inside valid
// lng/lat ranges (x: -180..180, y: -90..90) — values can exceed the bound and
// wrap around, e.g. y: 307.36 means the same as y: -52.64, and a value that
// crosses a pole (e.g. y: 100) folds back down the other side (100 -> 80).
// MapLibre throws on out-of-range latitudes, so every raw position coming
// from the API must be normalized through this before being used as [lng, lat].
export function normalizeLngLat(x: number, y: number): { lng: number; lat: number } {
  return { lng: wrapDegrees(x), lat: wrapLat(wrapDegrees(y)) }
}

// Wraps a value into [-180, 180), treating 360 degrees as equivalent to 0.
function wrapDegrees(value: number): number {
  return (((value + 180) % 360) + 360) % 360 - 180
}

// Latitude wraps around the poles rather than clamping: going past 90 folds
// back down the other side (e.g. 100 -> 80, 190 -> -10), matching how a
// value crossing the pole re-emerges on the globe. A single reflection can
// still land outside [-90, 90] for values far past the pole (e.g. 360 would
// reflect to -180), so recurse until the result settles inside bounds.
function wrapLat(value: number): number {
  if (value > 90) return wrapLat(180 - value)
  if (value < -90) return wrapLat(-180 - value)
  return value
}
