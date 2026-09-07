/**
 * Server-side domain types for Iron Paradise.
 * These mirror the Part 2 schema for use in middleware and controllers.
 */

export type ProfileRole = 'owner' | 'trainer'

export interface ProfileRow {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: ProfileRole
  is_active: boolean
  created_at: string
  updated_at: string
}
