export type AccessLevel = 'read' | 'write'

// Mirrors AuthenticatedUser in ../../../simulation/src/services/auth_service.rs.
// Permissions are per-bloc and per-zone independently — there is no single "my bloc" flag.
export interface CurrentUser {
  userId: string
  blocPermissions: Record<string, AccessLevel>
  zonePermissions: Record<string, AccessLevel>
}
