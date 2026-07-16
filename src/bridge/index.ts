// Coordinate projection: lng/lat ↔ Pixi x/y

// The backend's `position: { x, y }` is not guaranteed to fall inside valid
// lng/lat ranges (x: -180..180, y: -90..90) — values can exceed the bound and
// wrap around, e.g. y: 307.36 means the same as y: -52.64. MapLibre throws on
// out-of-range latitudes, so every raw position coming from the API must be
// normalized through this before being used as [lng, lat].
export function normalizeLngLat(x: number, y: number): { lng: number; lat: number } {
  return { lng: wrapDegrees(x), lat: clampLat(wrapDegrees(y)) }
}

// Wraps a value into [-180, 180), treating 360 degrees as equivalent to 0.
function wrapDegrees(value: number): number {
  return (((value + 180) % 360) + 360) % 360 - 180
}

// Latitude has no further wraparound past the poles — after longitude-style
// wrapping brings it into [-180, 180), clamp the remainder into [-90, 90].
function clampLat(value: number): number {
  return Math.max(-90, Math.min(90, value))
}
