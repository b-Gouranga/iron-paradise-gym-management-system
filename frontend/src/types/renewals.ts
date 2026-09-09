import type { Membership } from './memberships'
import type { RenewalReportData } from './reports'

export interface UpcomingRenewalItem {
  id: string
  member_id: string
  member_name: string
  member_code: string
  member_phone: string
  plan_id: string
  plan_name: string
  duration_value: number
  duration_unit: string
  start_date: string
  expiry_date: string
  actual_fee: number
  days_left: number
  status: 'active' | 'expiring_soon'
  already_renewed: boolean
  membership: Membership
}

export interface ExpiredRenewalItem {
  id: string
  member_id: string
  member_name: string
  member_code: string
  member_phone: string
  plan_id: string
  plan_name: string
  duration_value: number
  duration_unit: string
  start_date: string
  expiry_date: string
  actual_fee: number
  days_expired: number
  membership: Membership
}

export interface RenewalsSummary {
  expiring_7_days: number
  expiring_14_days: number
  expiring_30_days: number
  total_active: number
}

export interface UpcomingRenewalsResponse {
  upcoming: UpcomingRenewalItem[]
  total: number
  summary: RenewalsSummary
}

export interface ExpiredRenewalsResponse {
  expired: ExpiredRenewalItem[]
  total: number
}

export type RenewalHistoryResponse = RenewalReportData
