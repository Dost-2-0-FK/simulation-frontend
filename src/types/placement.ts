// Mirrors backend Placement model — confirm field names against ../game-backend/src/models
// before wiring up the real endpoint.
export interface Placement {
  id: string
  lng: number
  lat: number
  occupant: null | { type: 'base' | 'trust'; id: string }
}
