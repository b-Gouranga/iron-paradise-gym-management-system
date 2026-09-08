export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other'

export type PaymentPurpose = 'new_membership' | 'renewal' | 'partial_payment' | 'pending_fee' | 'other'

export type PaymentStatus = 'Paid' | 'Partially Paid' | 'Unpaid' | 'Overdue'

export interface PaymentTransaction {
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
  member_name?: string
  member_code?: string
  plan_name?: string
}

export interface RecordPaymentPayload {
  membership_id: string
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
  payments: PaymentTransaction[]
}

export interface PaymentListFilters {
  page?: number
  limit?: number
  search?: string
  payment_method?: string
  purpose?: string
  date_from?: string
  date_to?: string
}

export interface PaymentSummaryStats {
  totalRevenue: number
  totalRecordedCount: number
  totalPendingEstimate: number
}

export interface PaymentListResponse {
  payments: PaymentTransaction[]
  total?: number
  page?: number
  limit?: number
  totalPages?: number
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: PaymentSummaryStats
}
