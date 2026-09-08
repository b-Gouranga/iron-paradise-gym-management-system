/**
 * Server-side types for the Memberships & Renewals module.
 * Mirrors the Part 2 memberships table schema.
 */

import type { DurationUnit } from './membershipPlans.js'

export type MembershipStatus = 'active' | 'expired' | 'cancelled'

export interface MembershipRow {
  id: string
  member_id: string
  plan_id: string
  previous_membership_id: string | null
  start_date: string
  expiry_date: string
  actual_fee: number
  payment_due_date: string | null
  status: MembershipStatus
  created_at: string
  updated_at: string
}

export interface MembershipPlanSummary {
  id: string
  name: string
  duration_value: number
  duration_unit: DurationUnit
}

export interface MembershipWithDetails extends MembershipRow {
  plan_name: string
  duration_value: number
  duration_unit: DurationUnit
  renewal_delay_days: number | null
}

export interface CreateMembershipInput {
  plan_id: string
  start_date: string
  actual_fee: number
  payment_due_date?: string | null
}

export interface RenewMembershipInput {
  plan_id: string
  start_date: string
  actual_fee: number
  payment_due_date?: string | null
}

export interface UpdateMembershipInput {
  payment_due_date?: string | null
  status?: MembershipStatus
}
