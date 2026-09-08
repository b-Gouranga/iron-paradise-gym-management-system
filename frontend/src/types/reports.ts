export type ReportTab = 'revenue' | 'payments' | 'memberships' | 'renewals'

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom'

export type DatePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_30_days'
  | 'this_year'
  | 'all_time'
  | 'custom'

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other'

export type PaymentPurpose =
  | 'new_membership'
  | 'renewal'
  | 'partial_payment'
  | 'pending_fee'
  | 'other'

export type PaymentStatus = 'Paid' | 'Partially Paid' | 'Unpaid' | 'Overdue'

export interface ReportFilters {
  preset: DatePreset
  date_from?: string
  date_to?: string
  period?: ReportPeriod
  plan_id?: string
  payment_method?: PaymentMethod | 'all'
  payment_status?: PaymentStatus | 'all'
}

export interface ReportsOverviewData {
  total_revenue: number
  total_transactions: number
  pending_dues: number
  active_members: number
  expired_members: number
  total_renewals: number
  date_from: string | null
  date_to: string | null
}

export interface PaymentMethodBreakdown {
  method: PaymentMethod
  label: string
  amount: number
  count: number
  percentage: number
}

export interface PaymentPurposeBreakdown {
  purpose: PaymentPurpose
  label: string
  amount: number
  count: number
  percentage: number
}

export interface RevenueTimeSeriesPoint {
  period: string
  label: string
  amount: number
  count: number
}

export interface RevenueTransactionItem {
  id: string
  amount: number
  payment_date: string
  payment_method: PaymentMethod
  purpose: PaymentPurpose
  notes: string | null
  member_id: string
  member_name: string
  member_code: string
  plan_name: string
}

export interface RevenueReportData {
  total_revenue: number
  transaction_count: number
  average_transaction_value: number
  by_method: PaymentMethodBreakdown[]
  by_purpose: PaymentPurposeBreakdown[]
  time_series: RevenueTimeSeriesPoint[]
  transactions: RevenueTransactionItem[]
}

export interface MembershipPaymentItem {
  id: string
  member_id: string
  member_name: string
  member_code: string
  plan_id: string
  plan_name: string
  actual_fee: number
  total_paid: number
  pending_balance: number
  payment_due_date: string | null
  start_date: string
  expiry_date: string
  payment_status: PaymentStatus
}

export interface PaymentReportData {
  total_contracted: number
  total_collected: number
  total_pending: number
  collection_rate: number
  status_counts: {
    paid: number
    partially_paid: number
    unpaid: number
    overdue: number
  }
  memberships: MembershipPaymentItem[]
}

export interface PlanDistributionItem {
  plan_id: string
  plan_name: string
  duration: string
  default_fee: number
  member_count: number
  total_contracted: number
  average_fee: number
  percentage: number
}

export interface MembershipReportItem {
  id: string
  member_id: string
  member_name: string
  member_code: string
  plan_name: string
  start_date: string
  expiry_date: string
  status: string
  is_renewal: boolean
}

export interface MembershipReportData {
  total_memberships: number
  active_count: number
  expiring_soon_count: number
  expired_count: number
  cancelled_count: number
  future_count?: number
  by_plan: PlanDistributionItem[]
  memberships: MembershipReportItem[]
}

export interface RenewalDelayDistribution {
  range: string
  count: number
  percentage: number
}

export interface RenewalEventItem {
  id: string
  member_id: string
  member_name: string
  member_code: string
  plan_name: string
  new_start_date: string
  previous_expiry_date: string
  renewal_delay_days: number
  is_late: boolean
  actual_fee: number
}

export interface RenewalReportData {
  total_renewals: number
  on_time_renewals: number
  late_renewals: number
  average_delay_days: number
  delay_distribution: RenewalDelayDistribution[]
  renewals: RenewalEventItem[]
}
