import type { DurationUnit } from './membershipPlans'

export type MembershipStatus = 'active' | 'expired' | 'cancelled' | 'future'

export interface Membership {
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
  plan_name: string
  duration_value: number
  duration_unit: DurationUnit
  renewal_delay_days: number | null
}

export interface CreateMembershipPayload {
  plan_id: string
  start_date: string
  actual_fee: number
  payment_due_date?: string | null
}

export interface RenewMembershipPayload {
  plan_id: string
  start_date: string
  actual_fee: number
  payment_due_date?: string | null
}

export interface UpdateMembershipPayload {
  payment_due_date?: string | null
  status?: MembershipStatus
}
