/**
 * Types for the dashboard data returned by GET /api/dashboard/summary.
 *
 * These mirror the server-side response shape exactly. All financial
 * calculations live on the backend; only computed totals and display-ready
 * rows are included here.
 */

export interface DashboardStats {
  /** Total count of all members (all statuses). */
  totalMembers: number
  /** Count of members whose status = 'active'. */
  activeMembers: number
  /** Count of active memberships expiring within 7 days. */
  expiringSoon: number
  /** Count of memberships whose status = 'expired'. */
  expired: number
  /**
   * Total outstanding balance across all memberships.
   * Computed as SUM(actual_fee − paid_so_far) for memberships where paid < fee.
   */
  pendingPaymentsAmount: number
  /** Count of memberships contributing to pendingPaymentsAmount. */
  pendingPaymentsCount: number
  /** Sum of all payment amounts in the current calendar month. */
  revenueThisMonth: number
}

export interface DashboardRenewal {
  membershipId: string
  memberName: string
  planName: string
  /** ISO date string YYYY-MM-DD */
  expiryDate: string
  /** Negative = already expired */
  daysLeft: number
  actualFee: number
}

export interface DashboardPendingPayment {
  membershipId: string
  memberName: string
  planName: string
  actualFee: number
  paidAmount: number
  pendingAmount: number
  /** ISO date string, or null if no due date is set */
  paymentDueDate: string | null
  paymentStatus: 'unpaid' | 'partially_paid' | 'overdue'
}

export interface DashboardRecentPayment {
  paymentId: string
  memberName: string
  amount: number
  /** ISO date string YYYY-MM-DD */
  paymentDate: string
  paymentMethod: string
  purpose: string
}

export interface DashboardData {
  stats: DashboardStats
  /** Active memberships expiring within 14 days (or up to 7 days ago if un-renewed). */
  renewals: DashboardRenewal[]
  /** Up to 10 memberships with an outstanding balance, most-urgent first. */
  pendingPayments: DashboardPendingPayment[]
  /** 10 most recently recorded payments. */
  recentPayments: DashboardRecentPayment[]
}
