import { getSupabaseAdmin } from '../database/supabaseAdmin.js'
import { computePaymentStatus } from '../../controllers/paymentsController.js'
import { calculateRenewalDelayDays } from '../../controllers/membershipsController.js'
import {
  countUniqueActiveMembers,
  getEffectiveMembershipStatus,
  isMembershipActive,
  isMembershipEligibleForPendingDues,
  isMembershipExpired,
  isMembershipExpiringSoon,
  isMembershipFuture,
} from '../../utils/membershipStatus.js'
import type {
  PaymentMethodBreakdown,
  PaymentPurposeBreakdown,
  PaymentReportData,
  PlanDistributionItem,
  RenewalDelayDistribution,
  RenewalEventItem,
  RenewalReportData,
  ReportFilterParams,
  ReportsOverviewData,
  RevenueReportData,
  RevenueTimeSeriesPoint,
  RevenueTransactionItem,
  MembershipPaymentItem,
  MembershipReportData,
  MembershipReportItem,
} from '../../types/reports.js'
import type { PaymentMethod, PaymentPurpose } from '../../types/payments.js'

function isoDate(offsetDays = 0): string {
  const d = new Date()
  if (offsetDays !== 0) d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

const ALL_METHODS: PaymentMethod[] = ['cash', 'upi', 'card', 'bank_transfer', 'other']
const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  other: 'Other',
}

const ALL_PURPOSES: PaymentPurpose[] = [
  'new_membership',
  'renewal',
  'partial_payment',
  'pending_fee',
  'other',
]
const PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  new_membership: 'New Membership',
  renewal: 'Renewal',
  partial_payment: 'Partial Payment',
  pending_fee: 'Pending Fee',
  other: 'Other',
}

interface RawMember {
  id: string
  member_code: string
  full_name: string
  status: string
}

interface RawPlan {
  id: string
  name: string
  duration_value: number
  duration_unit: string
  default_fee: number
  is_active: boolean
}

interface RawMembership {
  id: string
  member_id: string
  plan_id: string
  actual_fee: number
  start_date: string
  expiry_date: string
  payment_due_date: string | null
  status: string
  previous_membership_id: string | null
  created_at: string
}

interface RawPayment {
  id: string
  membership_id: string
  member_id: string
  amount: number
  payment_date: string
  payment_method: PaymentMethod
  purpose: PaymentPurpose
  notes: string | null
  created_at: string
}

/**
 * Loads and caches base reference tables for report calculations.
 */
async function loadReportContext() {
  const supabase = getSupabaseAdmin()
  const [membersRes, plansRes, membershipsRes, paymentsRes] = await Promise.all([
    supabase.from('members').select('id, member_code, full_name, status'),
    supabase.from('membership_plans').select('id, name, duration_value, duration_unit, default_fee, is_active'),
    supabase.from('memberships').select('id, member_id, plan_id, actual_fee, start_date, expiry_date, payment_due_date, status, previous_membership_id, created_at'),
    supabase.from('payments').select('id, membership_id, member_id, amount, payment_date, payment_method, purpose, notes, created_at'),
  ])

  if (membersRes.error) throw membersRes.error
  if (plansRes.error) throw plansRes.error
  if (membershipsRes.error) throw membershipsRes.error
  if (paymentsRes.error) throw paymentsRes.error

  const members = (membersRes.data ?? []) as RawMember[]
  const plans = (plansRes.data ?? []) as RawPlan[]
  const memberships = (membershipsRes.data ?? []) as RawMembership[]
  const payments = (paymentsRes.data ?? []) as RawPayment[]

  const memberMap = new Map<string, RawMember>()
  for (const m of members) memberMap.set(m.id, m)

  const planMap = new Map<string, RawPlan>()
  for (const p of plans) planMap.set(p.id, p)

  const membershipMap = new Map<string, RawMembership>()
  for (const ms of memberships) membershipMap.set(ms.id, ms)

  const paymentsByMembership = new Map<string, number>()
  for (const p of payments) {
    const prev = paymentsByMembership.get(p.membership_id) ?? 0
    paymentsByMembership.set(p.membership_id, prev + Number(p.amount))
  }

  return {
    members,
    plans,
    memberships,
    payments,
    memberMap,
    planMap,
    membershipMap,
    paymentsByMembership,
  }
}

/**
 * Formats duration into a readable string.
 */
function formatPlanDuration(value: number, unit: string): string {
  const singularUnit = unit.replace(/s$/, '')
  return `${value} ${value === 1 ? singularUnit : unit}`
}

/**
 * Formats a YYYY-MM-DD date to a human readable label.
 */
function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

/**
 * Generates an executive overview report with high-level KPI cards.
 */
export async function getReportsOverview(
  params: ReportFilterParams = {},
): Promise<ReportsOverviewData> {
  const ctx = await loadReportContext()
  const today = isoDate()

  // 1. Filter payments by date range & plan if specified
  const filteredPayments = ctx.payments.filter((p) => {
    if (params.date_from && p.payment_date < params.date_from) return false
    if (params.date_to && p.payment_date > params.date_to) return false
    if (params.plan_id && params.plan_id !== 'all') {
      const ms = ctx.membershipMap.get(p.membership_id)
      if (ms?.plan_id !== params.plan_id) return false
    }
    return true
  })

  const totalRevenue = filteredPayments.reduce((acc, p) => acc + Number(p.amount), 0)
  const totalTransactions = filteredPayments.length

  // 2. Pending dues across memberships (Active + Expired, excluding Cancelled and Future)
  let pendingDues = 0
  for (const ms of ctx.memberships) {
    if (params.plan_id && params.plan_id !== 'all' && ms.plan_id !== params.plan_id) {
      continue
    }
    if (!isMembershipEligibleForPendingDues(ms, today)) {
      continue
    }
    const paid = ctx.paymentsByMembership.get(ms.id) ?? 0
    const pending = Math.max(0, Number(ms.actual_fee) - paid)
    if (pending > 0.005) {
      pendingDues += pending
    }
  }

  // 3. Active members count: unique members with at least one valid active membership
  const activeMembers = countUniqueActiveMembers(ctx.memberships, today)

  // 4. Expired memberships count: memberships whose expiry date has passed and not cancelled
  const expiredMembers = ctx.memberships.filter((ms) => isMembershipExpired(ms, today)).length

  // 5. Total renewals (within date range if specified)
  const totalRenewals = ctx.memberships.filter((ms) => {
    if (!ms.previous_membership_id) return false
    if (params.date_from && ms.start_date < params.date_from) return false
    if (params.date_to && ms.start_date > params.date_to) return false
    if (params.plan_id && params.plan_id !== 'all' && ms.plan_id !== params.plan_id) return false
    return true
  }).length

  return {
    total_revenue: Math.round(totalRevenue * 100) / 100,
    total_transactions: totalTransactions,
    pending_dues: Math.round(pendingDues * 100) / 100,
    active_members: activeMembers,
    expired_members: expiredMembers,
    total_renewals: totalRenewals,
    date_from: params.date_from ?? null,
    date_to: params.date_to ?? null,
  }
}

/**
 * Generates the Revenue Report with breakdowns, time-series aggregation, and transaction logs.
 */
export async function getRevenueReport(
  params: ReportFilterParams = {},
): Promise<RevenueReportData> {
  const ctx = await loadReportContext()

  // Filter payments
  const filteredPayments = ctx.payments.filter((p) => {
    if (params.date_from && p.payment_date < params.date_from) return false
    if (params.date_to && p.payment_date > params.date_to) return false
    if (params.payment_method && params.payment_method !== 'all' && p.payment_method !== params.payment_method) {
      return false
    }
    if (params.plan_id && params.plan_id !== 'all') {
      const ms = ctx.membershipMap.get(p.membership_id)
      if (ms?.plan_id !== params.plan_id) return false
    }
    return true
  })

  const totalRevenue = filteredPayments.reduce((acc, p) => acc + Number(p.amount), 0)
  const transactionCount = filteredPayments.length
  const averageTransactionValue =
    transactionCount > 0 ? Math.round((totalRevenue / transactionCount) * 100) / 100 : 0

  // Payment Method Breakdown
  const methodMap = new Map<PaymentMethod, { amount: number; count: number }>()
  for (const m of ALL_METHODS) {
    methodMap.set(m, { amount: 0, count: 0 })
  }
  for (const p of filteredPayments) {
    const entry = methodMap.get(p.payment_method) ?? { amount: 0, count: 0 }
    entry.amount += Number(p.amount)
    entry.count += 1
    methodMap.set(p.payment_method, entry)
  }

  const byMethod: PaymentMethodBreakdown[] = ALL_METHODS.map((method) => {
    const item = methodMap.get(method) ?? { amount: 0, count: 0 }
    const percentage =
      totalRevenue > 0 ? Math.round((item.amount / totalRevenue) * 1000) / 10 : 0
    return {
      method,
      label: METHOD_LABELS[method] ?? method,
      amount: Math.round(item.amount * 100) / 100,
      count: item.count,
      percentage,
    }
  })

  // Payment Purpose Breakdown
  const purposeMap = new Map<PaymentPurpose, { amount: number; count: number }>()
  for (const pr of ALL_PURPOSES) {
    purposeMap.set(pr, { amount: 0, count: 0 })
  }
  for (const p of filteredPayments) {
    const entry = purposeMap.get(p.purpose) ?? { amount: 0, count: 0 }
    entry.amount += Number(p.amount)
    entry.count += 1
    purposeMap.set(p.purpose, entry)
  }

  const byPurpose: PaymentPurposeBreakdown[] = ALL_PURPOSES.map((purpose) => {
    const item = purposeMap.get(purpose) ?? { amount: 0, count: 0 }
    const percentage =
      totalRevenue > 0 ? Math.round((item.amount / totalRevenue) * 1000) / 10 : 0
    return {
      purpose,
      label: PURPOSE_LABELS[purpose] ?? purpose,
      amount: Math.round(item.amount * 100) / 100,
      count: item.count,
      percentage,
    }
  })

  // Time Series Aggregation
  // Grouping by daily, weekly, or monthly
  const grouping = params.period ?? 'daily'
  const timeSeriesMap = new Map<string, { label: string; amount: number; count: number }>()

  // Sort payments chronologically for time series
  const sortedChronological = [...filteredPayments].sort(
    (a, b) => a.payment_date.localeCompare(b.payment_date) || a.created_at.localeCompare(b.created_at),
  )

  for (const p of sortedChronological) {
    let key: string
    let label: string

    if (grouping === 'monthly') {
      key = p.payment_date.substring(0, 7) // YYYY-MM
      const [y, m] = key.split('-').map(Number)
      const dt = new Date(Date.UTC(y, m - 1, 1))
      label = dt.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    } else if (grouping === 'weekly') {
      // Find Monday of the week
      const [y, m, d] = p.payment_date.split('-').map(Number)
      const dt = new Date(Date.UTC(y, m - 1, d))
      const day = dt.getUTCDay()
      const diff = dt.getUTCDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
      const monday = new Date(Date.UTC(y, m - 1, diff))
      key = monday.toISOString().split('T')[0]
      label = `Wk ${formatDateLabel(key)}`
    } else {
      // Default: daily
      key = p.payment_date
      label = formatDateLabel(p.payment_date)
    }

    const current = timeSeriesMap.get(key) ?? { label, amount: 0, count: 0 }
    current.amount += Number(p.amount)
    current.count += 1
    timeSeriesMap.set(key, current)
  }

  const timeSeries: RevenueTimeSeriesPoint[] = Array.from(timeSeriesMap.entries())
    .map(([period, data]) => ({
      period,
      label: data.label,
      amount: Math.round(data.amount * 100) / 100,
      count: data.count,
    }))
    .sort((a, b) => a.period.localeCompare(b.period))

  // Transactions list (sorted newest first)
  const transactions: RevenueTransactionItem[] = [...filteredPayments]
    .sort(
      (a, b) =>
        b.payment_date.localeCompare(a.payment_date) || b.created_at.localeCompare(a.created_at),
    )
    .map((p) => {
      const member = ctx.memberMap.get(p.member_id)
      const ms = ctx.membershipMap.get(p.membership_id)
      const plan = ms ? ctx.planMap.get(ms.plan_id) : null

      return {
        id: p.id,
        amount: Number(p.amount),
        payment_date: p.payment_date,
        payment_method: p.payment_method,
        purpose: p.purpose,
        notes: p.notes,
        member_id: p.member_id,
        member_name: member?.full_name ?? 'Unknown Member',
        member_code: member?.member_code ?? '—',
        plan_name: plan?.name ?? 'Membership',
      }
    })

  return {
    total_revenue: Math.round(totalRevenue * 100) / 100,
    transaction_count: transactionCount,
    average_transaction_value: averageTransactionValue,
    by_method: byMethod,
    by_purpose: byPurpose,
    time_series: timeSeries,
    transactions,
  }
}

/**
 * Generates the Payment & Dues Report.
 */
export async function getPaymentReport(
  params: ReportFilterParams = {},
): Promise<PaymentReportData> {
  const ctx = await loadReportContext()
  const today = isoDate()

  let memberships = ctx.memberships.filter((m) => {
    if (!isMembershipEligibleForPendingDues(m, today)) return false
    if (params.date_from && m.start_date < params.date_from) return false
    if (params.date_to && m.start_date > params.date_to) return false
    if (params.plan_id && params.plan_id !== 'all' && m.plan_id !== params.plan_id) return false
    return true
  })

  const computedItems: MembershipPaymentItem[] = memberships.map((m) => {
    const member = ctx.memberMap.get(m.member_id)
    const plan = ctx.planMap.get(m.plan_id)
    const actualFee = Number(m.actual_fee)
    const totalPaid = ctx.paymentsByMembership.get(m.id) ?? 0
    const pendingBalance = Math.max(0, actualFee - totalPaid)
    const paymentStatus = computePaymentStatus(actualFee, totalPaid, m.payment_due_date)

    return {
      id: m.id,
      member_id: m.member_id,
      member_name: member?.full_name ?? 'Unknown Member',
      member_code: member?.member_code ?? '—',
      plan_id: m.plan_id,
      plan_name: plan?.name ?? 'Unknown Plan',
      actual_fee: actualFee,
      total_paid: Math.round(totalPaid * 100) / 100,
      pending_balance: Math.round(pendingBalance * 100) / 100,
      payment_due_date: m.payment_due_date,
      start_date: m.start_date,
      expiry_date: m.expiry_date,
      payment_status: paymentStatus,
    }
  })

  // Status counts before filtering by payment_status to preserve full summary
  const statusCounts = {
    paid: computedItems.filter((i) => i.payment_status === 'Paid').length,
    partially_paid: computedItems.filter((i) => i.payment_status === 'Partially Paid').length,
    unpaid: computedItems.filter((i) => i.payment_status === 'Unpaid').length,
    overdue: computedItems.filter((i) => i.payment_status === 'Overdue').length,
  }

  const totalContracted = computedItems.reduce((acc, i) => acc + i.actual_fee, 0)
  const totalCollected = computedItems.reduce((acc, i) => acc + i.total_paid, 0)
  const totalPending = computedItems.reduce((acc, i) => acc + i.pending_balance, 0)
  const collectionRate =
    totalContracted > 0 ? Math.round((totalCollected / totalContracted) * 1000) / 10 : 0

  // Apply optional payment_status filter for table rows
  let filteredRows = computedItems
  if (params.payment_status && params.payment_status !== 'all') {
    filteredRows = computedItems.filter((i) => i.payment_status === params.payment_status)
  }

  // Sort: highest pending balance first, then closest due date
  filteredRows.sort((a, b) => {
    if (b.pending_balance !== a.pending_balance) {
      return b.pending_balance - a.pending_balance
    }
    if (a.payment_due_date && b.payment_due_date) {
      return a.payment_due_date.localeCompare(b.payment_due_date)
    }
    return 0
  })

  return {
    total_contracted: Math.round(totalContracted * 100) / 100,
    total_collected: Math.round(totalCollected * 100) / 100,
    total_pending: Math.round(totalPending * 100) / 100,
    collection_rate: collectionRate,
    status_counts: statusCounts,
    memberships: filteredRows,
  }
}

/**
 * Generates the Membership Report with active/expiring/expired status and plan distribution.
 */
export async function getMembershipReport(
  params: ReportFilterParams = {},
): Promise<MembershipReportData> {
  const ctx = await loadReportContext()
  const today = isoDate()
  const next7Days = isoDate(7)

  let memberships = ctx.memberships.filter((m) => {
    if (params.date_from && m.start_date < params.date_from) return false
    if (params.date_to && m.start_date > params.date_to) return false
    if (params.plan_id && params.plan_id !== 'all' && m.plan_id !== params.plan_id) return false
    return true
  })

  const totalMemberships = memberships.length

  let activeCount = 0
  let expiringSoonCount = 0
  let expiredCount = 0
  let cancelledCount = 0
  let futureCount = 0

  for (const m of memberships) {
    if (m.status === 'cancelled') {
      cancelledCount++
    } else if (isMembershipFuture(m, today)) {
      futureCount++
    } else if (isMembershipExpired(m, today)) {
      expiredCount++
    } else if (isMembershipActive(m, today)) {
      activeCount++
      if (isMembershipExpiringSoon(m, today, 7)) {
        expiringSoonCount++
      }
    }
  }

  // Plan distribution
  const planDistributionMap = new Map<
    string,
    { memberCount: number; totalContracted: number }
  >()

  for (const m of memberships) {
    const entry = planDistributionMap.get(m.plan_id) ?? { memberCount: 0, totalContracted: 0 }
    entry.memberCount += 1
    entry.totalContracted += Number(m.actual_fee)
    planDistributionMap.set(m.plan_id, entry)
  }

  const byPlan: PlanDistributionItem[] = ctx.plans.map((p) => {
    const stat = planDistributionMap.get(p.id) ?? { memberCount: 0, totalContracted: 0 }
    const averageFee =
      stat.memberCount > 0 ? Math.round((stat.totalContracted / stat.memberCount) * 100) / 100 : 0
    const percentage =
      totalMemberships > 0 ? Math.round((stat.memberCount / totalMemberships) * 1000) / 10 : 0

    return {
      plan_id: p.id,
      plan_name: p.name,
      duration: formatPlanDuration(p.duration_value, p.duration_unit),
      default_fee: Number(p.default_fee),
      member_count: stat.memberCount,
      total_contracted: Math.round(stat.totalContracted * 100) / 100,
      average_fee: averageFee,
      percentage,
    }
  })

  // List of membership items
  const membershipItems: MembershipReportItem[] = [...memberships]
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .map((m) => {
      const member = ctx.memberMap.get(m.member_id)
      const plan = ctx.planMap.get(m.plan_id)

      let effectiveStatus = getEffectiveMembershipStatus(m, today)
      if (effectiveStatus === 'active' && isMembershipExpiringSoon(m, today, 7)) {
        effectiveStatus = 'expiring_soon' as any
      }

      return {
        id: m.id,
        member_id: m.member_id,
        member_name: member?.full_name ?? 'Unknown Member',
        member_code: member?.member_code ?? '—',
        plan_name: plan?.name ?? 'Unknown Plan',
        start_date: m.start_date,
        expiry_date: m.expiry_date,
        status: effectiveStatus,
        is_renewal: Boolean(m.previous_membership_id),
      }
    })

  return {
    total_memberships: totalMemberships,
    active_count: activeCount,
    expiring_soon_count: expiringSoonCount,
    expired_count: expiredCount,
    cancelled_count: cancelledCount,
    future_count: futureCount,
    by_plan: byPlan,
    memberships: membershipItems,
  }
}

/**
 * Generates the Renewal Report with delay calculations, on-time vs late metrics, and event history.
 */
export async function getRenewalReport(
  params: ReportFilterParams = {},
): Promise<RenewalReportData> {
  const ctx = await loadReportContext()

  // Renewals have previous_membership_id != null
  const renewalMemberships = ctx.memberships.filter((m) => {
    if (!m.previous_membership_id) return false
    if (params.date_from && m.start_date < params.date_from) return false
    if (params.date_to && m.start_date > params.date_to) return false
    if (params.plan_id && params.plan_id !== 'all' && m.plan_id !== params.plan_id) return false
    return true
  })

  const renewalEvents: RenewalEventItem[] = []
  let totalDelayDays = 0

  const buckets = {
    seamless: 0, // <= 1 day
    shortDelay: 0, // 2 - 7 days
    mediumDelay: 0, // 8 - 14 days
    longDelay: 0, // 15 - 30 days
    veryLongDelay: 0, // > 30 days
  }

  for (const m of renewalMemberships) {
    const prev = m.previous_membership_id
      ? ctx.membershipMap.get(m.previous_membership_id)
      : null
    const prevExpiry = prev?.expiry_date ?? m.start_date
    const delay = calculateRenewalDelayDays(prevExpiry, m.start_date)
    const isLate = delay > 1

    totalDelayDays += delay

    if (delay <= 1) buckets.seamless++
    else if (delay <= 7) buckets.shortDelay++
    else if (delay <= 14) buckets.mediumDelay++
    else if (delay <= 30) buckets.longDelay++
    else buckets.veryLongDelay++

    const member = ctx.memberMap.get(m.member_id)
    const plan = ctx.planMap.get(m.plan_id)

    renewalEvents.push({
      id: m.id,
      member_id: m.member_id,
      member_name: member?.full_name ?? 'Unknown Member',
      member_code: member?.member_code ?? '—',
      plan_name: plan?.name ?? 'Unknown Plan',
      new_start_date: m.start_date,
      previous_expiry_date: prevExpiry,
      renewal_delay_days: delay,
      is_late: isLate,
      actual_fee: Number(m.actual_fee),
    })
  }

  // Sort renewals newest first
  renewalEvents.sort((a, b) => b.new_start_date.localeCompare(a.new_start_date))

  const totalRenewals = renewalEvents.length
  const onTimeRenewals = renewalEvents.filter((r) => !r.is_late).length
  const lateRenewals = renewalEvents.filter((r) => r.is_late).length
  const averageDelayDays =
    totalRenewals > 0 ? Math.round((totalDelayDays / totalRenewals) * 10) / 10 : 0

  const delayDistribution: RenewalDelayDistribution[] = [
    {
      range: 'Seamless (≤ 1 day)',
      count: buckets.seamless,
      percentage: totalRenewals > 0 ? Math.round((buckets.seamless / totalRenewals) * 1000) / 10 : 0,
    },
    {
      range: '2–7 days delay',
      count: buckets.shortDelay,
      percentage: totalRenewals > 0 ? Math.round((buckets.shortDelay / totalRenewals) * 1000) / 10 : 0,
    },
    {
      range: '8–14 days delay',
      count: buckets.mediumDelay,
      percentage: totalRenewals > 0 ? Math.round((buckets.mediumDelay / totalRenewals) * 1000) / 10 : 0,
    },
    {
      range: '15–30 days delay',
      count: buckets.longDelay,
      percentage: totalRenewals > 0 ? Math.round((buckets.longDelay / totalRenewals) * 1000) / 10 : 0,
    },
    {
      range: '30+ days delay',
      count: buckets.veryLongDelay,
      percentage: totalRenewals > 0 ? Math.round((buckets.veryLongDelay / totalRenewals) * 1000) / 10 : 0,
    },
  ]

  return {
    total_renewals: totalRenewals,
    on_time_renewals: onTimeRenewals,
    late_renewals: lateRenewals,
    average_delay_days: averageDelayDays,
    delay_distribution: delayDistribution,
    renewals: renewalEvents,
  }
}
