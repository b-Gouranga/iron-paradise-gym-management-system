/**
 * Server-side types for the Membership Plans module.
 * Mirrors the Part 2 membership_plans schema.
 */

export type DurationUnit = 'days' | 'months' | 'years'

export type MembershipPlanFilter = 'all' | 'active' | 'inactive'

export interface MembershipPlanRow {
  id: string
  name: string
  duration_value: number
  duration_unit: DurationUnit
  default_fee: number
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateMembershipPlanInput {
  name: string
  duration_value: number
  duration_unit: DurationUnit
  default_fee: number
  description?: string | null
}

export interface UpdateMembershipPlanInput {
  name?: string
  duration_value?: number
  duration_unit?: DurationUnit
  default_fee?: number
  description?: string | null
  is_active?: boolean
}
