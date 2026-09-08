/**
 * Server-side types for the Payments module.
 * Mirrors the Part 2 payments table schema.
 */

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other'

export type PaymentPurpose =
  | 'new_membership'
  | 'renewal'
  | 'partial_payment'
  | 'pending_fee'
  | 'other'

export type PaymentStatus = 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue'

export interface PaymentRow {
  id: string
  member_id: string
  membership_id: string
  amount: number
  payment_date: string
  payment_method: PaymentMethod
  purpose: PaymentPurpose
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface PaymentWithDetails extends PaymentRow {
  member_name: string
  member_code: string
  plan_name: string
}

export interface RecordPaymentInput {
  membership_id?: string
  amount: number
  payment_date: string
  payment_method: PaymentMethod
  purpose: PaymentPurpose
  notes?: string | null
}

export interface MembershipPaymentSummary {
  membership_id: string
  plan_name: string
  actual_fee: number
  total_paid: number
  pending_amount: number
  payment_status: PaymentStatus
  payment_due_date: string | null
}

export interface MemberPaymentSummary {
  member_id: string
  total_contracted_fee: number
  total_paid: number
  total_pending: number
  current_membership_status: PaymentStatus | null
  memberships_summary: MembershipPaymentSummary[]
  payments: PaymentWithDetails[]
}

export interface PaymentSummaryStats {
  totalRevenue: number
  totalRecordedCount: number
  totalPendingEstimate: number
}

export interface PaymentListResult {
  payments: PaymentWithDetails[]
  total: number
  page: number
  limit: number
  totalPages: number
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: PaymentSummaryStats
}
