import type { Request, Response } from 'express'
import { getSupabaseAdmin } from '../services/database/supabaseAdmin.js'

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Returns an ISO date string (YYYY-MM-DD) offset by `days` from today. */
function isoDate(offsetDays = 0): string {
  const d = new Date()
  if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

/** Returns the ISO date string for the first day of the current calendar month. */
function firstOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

// ── Raw row shapes returned by Supabase (admin client is untyped) ─────────────

interface ActiveMembershipRow {
  member_id: string
}

interface PendingMembershipRow {
  id: string
  actual_fee: number
  payment_due_date: string | null
  member_id: string
  plan_id: string
  payments: Array<{ amount: number }> | null
}

interface RenewalMembershipRow {
  id: string
  member_id: string
  plan_id: string
  expiry_date: string
  actual_fee: number
}

interface MemberLookupRow {
  id: string
  full_name: string
}

interface PlanLookupRow {
  id: string
  name: string
}

interface RecentPaymentRow {
  id: string
  amount: number
  payment_date: string
  payment_method: string
  purpose: string
  member_id: string
}

interface MonthRevenueRow {
  amount: number
}

interface RecentReminderRow {
  id: string
  reminder_stage: string
  channel: string
  status: string
  scheduled_at: string
  member_id: string
}

// ── Controller ────────────────────────────────────────────────────────────────

/**
 * GET /api/dashboard/summary
 *
 * Returns aggregated dashboard metrics and bounded list data.
 * Protected by requireAuth — the user's JWT is verified before this runs.
 *
 * All calculations are performed server-side using the service-role client.
 * Only computed results are returned to the browser; no raw financial rows are
 * sent to the frontend.
 *
 * Architecture & Performance:
 * 1. Phase 1 executes 14 parallel queries via Promise.all:
 *    - 7 HEAD queries returning counts with 0 rows transferred (total members,
 *      expiring soon, expired, scheduled reminders, sent/delivered reminders,
 *      failed reminders, total reminders).
 *    - 3 bounded queries limited server-side (top 10 renewals, top 10 recent
 *      payments, top 5 recent reminders).
 *    - 1 narrow lookup for active membership member_ids (to compute unique active count).
 *    - 1 nested relational lookup for eligible memberships (id, fee, due date, member_id,
 *      plan_id) and their associated payment amounts via `payments!payments_member_membership_match(amount)`.
 *      Pre-sorted by payment_due_date ASC NULLS LAST in PostgreSQL.
 *      This completely eliminates the secondary sequential payment waterfall.
 *    - 1 small plan reference table lookup (~5-10 rows).
 *    - 1 current-month payment revenue query (filtered by payment_date >= monthStart).
 * 2. Phase 2 executes a targeted member lookup scoped strictly to the unique member IDs
 *    actually displayed on the dashboard (max 35 members).
 *
 * Database Limitations & Trade-offs:
 * - Pending Payments: Computed using the verified foreign key relationship
 *   `payments!payments_member_membership_match` in a single query.
 *   Pending dues = actual_fee - sum(payments.amount). Evaluates active and expired
 *   memberships with start_date <= today and actual_fee > 0.
 * - Monthly Revenue: PostgREST does not provide native column SUM() over HTTP REST.
 *   Without an RPC or database view, summing payment.amount where payment_date >= monthStart
 *   in Node.js preserves the exact revenue calculation without introducing approximations.
 */
export async function getSummary(_req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseAdmin()

  const today = isoDate(0)
  const sevenDaysAgo = isoDate(-7)
  const sevenDaysOut = isoDate(7)
  const fourteenDaysOut = isoDate(14)
  const monthStart = firstOfMonth()

  try {
    // ── Phase 1: Parallel server-side filtered & aggregate queries (14 queries) ──
    const [
      totalMembersRes,
      activeMembershipsRes,
      expiringSoonRes,
      expiredRes,
      upcomingRenewalsRes,
      eligibleMembershipsRes,
      plansRes,
      recentPaymentsRes,
      monthRevenueRes,
      recentRemindersRes,
      scheduledRemindersRes,
      sentAndDeliveredRemindersRes,
      failedRemindersRes,
      totalRemindersRes,
    ] = await Promise.all([
      // 1. COUNT of all members (HEAD query - 0 rows transferred)
      supabase.from('members').select('*', { count: 'exact', head: true }),

      // 2. Active memberships (only member_id of valid active memberships)
      supabase
        .from('memberships')
        .select('member_id')
        .neq('status', 'cancelled')
        .lte('start_date', today)
        .gte('expiry_date', today),

      // 3. COUNT of active memberships expiring within 7 days (HEAD query - 0 rows transferred)
      supabase
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'cancelled')
        .lte('start_date', today)
        .gte('expiry_date', today)
        .lte('expiry_date', sevenDaysOut),

      // 4. COUNT of expired memberships (HEAD query - 0 rows transferred)
      supabase
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'cancelled')
        .lt('expiry_date', today),

      // 5. 10 upcoming renewals in [sevenDaysAgo, fourteenDaysOut] (bounded server-side: max 10 rows)
      supabase
        .from('memberships')
        .select('id, member_id, plan_id, expiry_date, actual_fee')
        .neq('status', 'cancelled')
        .lte('start_date', today)
        .gte('expiry_date', sevenDaysAgo)
        .lte('expiry_date', fourteenDaysOut)
        .order('expiry_date', { ascending: true })
        .limit(10),

      // 6. Eligible memberships for pending dues with nested payment amounts
      // Uses the verified FK constraint `payments_member_membership_match`.
      // Eliminates the sequential payment waterfall.
      supabase
        .from('memberships')
        .select(`
          id,
          actual_fee,
          payment_due_date,
          member_id,
          plan_id,
          payments!payments_member_membership_match (
            amount
          )
        `)
        .neq('status', 'cancelled')
        .lte('start_date', today)
        .gt('actual_fee', 0)
        .order('payment_due_date', { ascending: true, nullsFirst: false }),

      // 7. Plan id → name lookup (bounded small reference table: ~5-10 rows)
      supabase.from('membership_plans').select('id, name'),

      // 8. 10 most recent payment records (bounded server-side: max 10 rows)
      supabase
        .from('payments')
        .select('id, amount, payment_date, payment_method, purpose, member_id')
        .order('created_at', { ascending: false })
        .limit(10),

      // 9. Payments in the current calendar month for revenue calc (payment_date >= monthStart)
      supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', monthStart),

      // 10. 5 most recent reminders (bounded server-side: max 5 rows)
      supabase
        .from('reminders')
        .select('id, reminder_stage, channel, status, scheduled_at, member_id')
        .order('scheduled_at', { ascending: false })
        .limit(5),

      // 11-14. Server-side reminder counts (HEAD queries - 0 rows transferred)
      supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'scheduled'),
      supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['sent', 'delivered']),
      supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed'),
      supabase.from('reminders').select('*', { count: 'exact', head: true }),
    ])

    // Fail fast if any Phase 1 query errored
    const results = [
      totalMembersRes,
      activeMembershipsRes,
      expiringSoonRes,
      expiredRes,
      upcomingRenewalsRes,
      eligibleMembershipsRes,
      plansRes,
      recentPaymentsRes,
      monthRevenueRes,
      recentRemindersRes,
      scheduledRemindersRes,
      sentAndDeliveredRemindersRes,
      failedRemindersRes,
      totalRemindersRes,
    ] as const
    for (const r of results) {
      if (r.error) throw r.error
    }

    // ── Build plan map ────────────────────────────────────────────────────────
    const planMap = new Map<string, string>(
      ((plansRes.data ?? []) as unknown as PlanLookupRow[]).map(p => [p.id, p.name]),
    )

    // ── Stats ────────────────────────────────────────────────────────────────
    const totalMembers = totalMembersRes.count ?? 0

    // Unique active members
    const activeMemberIds = new Set(
      ((activeMembershipsRes.data ?? []) as unknown as ActiveMembershipRow[]).map(
        m => m.member_id,
      ),
    )
    const activeMembers = activeMemberIds.size

    const expiringSoon = expiringSoonRes.count ?? 0
    const expired = expiredRes.count ?? 0

    const revenueThisMonth = (
      (monthRevenueRes.data ?? []) as unknown as MonthRevenueRow[]
    ).reduce((sum, p) => sum + Number(p.amount), 0)

    // ── Pending payments: stat totals + bounded list ──────────────────────────
    //
    // pending = actual_fee − sum(payments for this membership)
    // Payments are nested directly in each eligible membership, completely eliminating
    // the previous sequential Phase 2 query.
    // Database query already sorted by payment_due_date ASC NULLS LAST; no in-memory
    // sort is necessary.
    const eligibleMemberships = (
      eligibleMembershipsRes.data ?? []
    ) as unknown as PendingMembershipRow[]

    let pendingPaymentsAmount = 0
    let pendingPaymentsCount = 0
    const pendingItems: Array<{
      membershipId: string
      memberId: string
      planId: string
      actualFee: number
      paidAmount: number
      pendingAmount: number
      paymentDueDate: string | null
      paymentStatus: 'unpaid' | 'partially_paid' | 'overdue'
    }> = []

    for (const m of eligibleMemberships) {
      const paid = (m.payments ?? []).reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      )
      const pending = Number(m.actual_fee) - paid
      if (pending > 0.005) {
        pendingPaymentsAmount += pending
        pendingPaymentsCount++
        if (pendingItems.length < 10) {
          const isOverdue =
            m.payment_due_date != null && m.payment_due_date < today
          pendingItems.push({
            membershipId: m.id,
            memberId: m.member_id,
            planId: m.plan_id,
            actualFee: Number(m.actual_fee),
            paidAmount: Math.round(paid * 100) / 100,
            pendingAmount: Math.round(pending * 100) / 100,
            paymentDueDate: m.payment_due_date,
            paymentStatus:
              paid <= 0.005 ? 'unpaid' : isOverdue ? 'overdue' : 'partially_paid',
          })
        }
      }
    }
    pendingPaymentsAmount = Math.round(pendingPaymentsAmount * 100) / 100

    // ── Phase 2: Targeted member lookup for bounded lists ────────────────────
    const renewalsRaw = (
      upcomingRenewalsRes.data ?? []
    ) as unknown as RenewalMembershipRow[]
    const recentPaymentsRaw = (
      recentPaymentsRes.data ?? []
    ) as unknown as RecentPaymentRow[]
    const recentRemindersRaw = (
      recentRemindersRes.data ?? []
    ) as unknown as RecentReminderRow[]

    const neededMemberIds = Array.from(
      new Set([
        ...renewalsRaw.map(r => r.member_id),
        ...pendingItems.map(p => p.memberId),
        ...recentPaymentsRaw.map(p => p.member_id),
        ...recentRemindersRaw.map(r => r.member_id),
      ]),
    ).filter(Boolean)

    const memberMap = new Map<string, string>()
    if (neededMemberIds.length > 0) {
      const membersRes = await supabase
        .from('members')
        .select('id, full_name')
        .in('id', neededMemberIds)

      if (membersRes.error) throw membersRes.error

      for (const m of (membersRes.data ?? []) as unknown as MemberLookupRow[]) {
        memberMap.set(m.id, m.full_name)
      }
    }

    // ── Build pending payments list with member and plan names ───────────────
    const pendingList = pendingItems.map(p => ({
      membershipId: p.membershipId,
      memberId: p.memberId,
      memberName: memberMap.get(p.memberId) ?? 'Unknown',
      planName: planMap.get(p.planId) ?? 'Unknown Plan',
      actualFee: p.actualFee,
      paidAmount: p.paidAmount,
      pendingAmount: p.pendingAmount,
      paymentDueDate: p.paymentDueDate,
      paymentStatus: p.paymentStatus,
    }))

    // ── Build upcoming renewals list ─────────────────────────────────────────
    const nowMs = new Date(today + 'T00:00:00').getTime()
    const renewalsList = renewalsRaw.map(m => {
      const expiryMs = new Date(m.expiry_date + 'T00:00:00').getTime()
      const daysLeft = Math.round((expiryMs - nowMs) / 86_400_000)
      return {
        membershipId: m.id,
        memberId: m.member_id,
        memberName: memberMap.get(m.member_id) ?? 'Unknown',
        planName: planMap.get(m.plan_id) ?? 'Unknown Plan',
        expiryDate: m.expiry_date,
        daysLeft,
        actualFee: Number(m.actual_fee),
      }
    })

    // ── Build recent payments list ───────────────────────────────────────────
    const recentPaymentsList = recentPaymentsRaw.map(p => ({
      paymentId: p.id,
      memberId: p.member_id,
      memberName: memberMap.get(p.member_id) ?? 'Unknown',
      amount: Number(p.amount),
      paymentDate: p.payment_date,
      paymentMethod: p.payment_method,
      purpose: p.purpose,
    }))

    // ── Build reminders summary ──────────────────────────────────────────────
    const scheduledRemindersCount = scheduledRemindersRes.count ?? 0
    const sentRemindersCount = sentAndDeliveredRemindersRes.count ?? 0
    const failedRemindersCount = failedRemindersRes.count ?? 0
    const totalRemindersCount = totalRemindersRes.count ?? 0

    const recentRemindersList = recentRemindersRaw.map(r => ({
      id: r.id,
      memberName: memberMap.get(r.member_id) ?? 'Unknown Member',
      reminderStage: r.reminder_stage,
      channel: r.channel,
      status: r.status,
      scheduledAt: r.scheduled_at,
    }))

    // ── Response ─────────────────────────────────────────────────────────────
    res.json({
      success: true,
      data: {
        stats: {
          totalMembers,
          activeMembers,
          expiringSoon,
          expired,
          pendingPaymentsAmount: Math.round(pendingPaymentsAmount * 100) / 100,
          pendingPaymentsCount,
          revenueThisMonth: Math.round(revenueThisMonth * 100) / 100,
        },
        renewals: renewalsList,
        pendingPayments: pendingList,
        recentPayments: recentPaymentsList,
        remindersSummary: {
          scheduledCount: scheduledRemindersCount,
          sentCount: sentRemindersCount,
          failedCount: failedRemindersCount,
          totalCount: totalRemindersCount,
          recentReminders: recentRemindersList,
        },
      },
    })
  } catch (err) {
    console.error('[dashboardController] getSummary error', err)
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard data. Please try again.',
    })
  }
}
