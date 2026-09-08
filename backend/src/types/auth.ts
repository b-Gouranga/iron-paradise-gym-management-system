/**
 * Server-side domain types for Iron Paradise.
 * These mirror the Part 2 & Part 11 schema for use in middleware and controllers.
 */

export type ProfileRole = 'owner' | 'trainer'

export interface ProfileRow {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: ProfileRole
  is_active: boolean
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface TrainerDetail extends ProfileRow {
  last_sign_in_at?: string | null
}
