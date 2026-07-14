import type { Base } from './base'
import type { Trust } from './trust'

export interface Placement {
  id: string
  zone: string
  lng: number
  lat: number
  occupant: null | ({ type: 'base' } & Base) | ({ type: 'trust' } & Trust)
}
