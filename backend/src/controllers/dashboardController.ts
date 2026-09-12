import type { Request, Response } from 'express'
import { getSupabaseAdmin } from '../services/database/supabaseAdmin.js'
import {
  countUniqueActiveMembers,
  isMembershipActive,
  isMembershipEligibleForPendingDues,
  isMembershipExpired,
  isMembershipExpiringSoon,
} from '../utils/membershipStatus.js'

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

interface MembershipRow {
  id: string
  actual_fee: number
  payment_due_date: string | null
  start_date: string
  expiry_date: string
  status: string
  member_id: string
  plan_id: string
}

interface PaymentSumRow {
  membership_id: string
  amount: number
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
 * Performance: all independent queries run in parallel via Promise.all.
 * Node.js in-process joins replace complex SQL joins to avoid requiring a DB
 * migration. For a gym-sized dataset (hundreds–low thousands of records) this
 * is fast and acceptable. A dedicated DB view or RPC can be added in a future
 * optimisation pass without changing the API contract.
 */
export async function getSummary(_req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseAdmin()

  const today = isoDate(0)
  const sevenDaysAgo = isoDate(-7)
  const sevenDaysOut = isoDate(7)
  const fourteenDaysOut = isoDate(14)
  const monthStart = firstOfMonth()

  try {
    // ── All queries run in parallel ───────────────────────────────────────────
    const [
      totalMembersRes,
      activeMembersRes,
      expiringSoonRes,
      expiredRes,
      membershipsRes,
      paymentSumsRes,
      membersRes,
      plansRes,
      recentPaymentsRes,
      monthRevenueRes,
      recentRemindersRes,
      allRemindersRes,
    ] = await Promise.all([
      // 1. COUNT of all members
      supabase.from('members').select('*', { count: 'exact', head: true }),
      // 2. COUNT of active members
      supabase.from('members').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      // 3. COUNT of active memberships expiring within 7 days
      supabase.from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('expiry_date', today)
        .lte('expiry_date', sevenDaysOut),
      // 4. COUNT of expired memberships
      supabase.from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'expired'),
      // 5. All memberships (for pending calc + renewal + pending list)
      supabase.from('memberships')
        .select('id, actual_fee, payment_due_date, start_date, expiry_date, status, member_id, plan_id'),
      // 6. All payment amounts grouped by membership (for pending calc)
      supabase.from('payments').select('membership_id, amount'),
      // 7. Member id → name lookup
      supabase.from('members').select('id, full_name'),
      // 8. Plan id → name lookup
      supabase.from('membership_plans').select('id, name'),
      // 9. 10 most recent payment records (for Recent Payments list)
      supabase.from('payments')
        .select('id, amount, payment_date, payment_method, purpose, member_id')
        .order('created_at', { ascending: false })
        .limit(10),
      // 10. Payments in the current calendar month (for revenue calc)
      supabase.from('payments')
        .select('amount')
        .gte('payment_date', monthStart),
      // 11. 5 most recent reminders
      supabase.from('reminders')
        .select('id, reminder_stage, channel, status, scheduled_at, member_id')
        .order('scheduled_at', { ascending: false })
        .limit(5),
      // 12. All reminder statuses (for counts)
      supabase.from('reminders').select('status'),
    ])

    // Fail fast if any query errored
    const results = [
      totalMembersRes, activeMembersRes, expiringSoonRes, expiredRes,
      membershipsRes, paymentSumsRes, membersRes, plansRes,
      recentPaymentsRes, monthRevenueRes,
      recentRemindersRes, allRemindersRes,
    ] as const
    for (const r of results) {
      if (r.error) throw r.error
    }

    // ── Build lookup maps (O(n) construction, O(1) lookup) ────────────────────

    const memberMap = new Map<string, string>(
      ((membersRes.data ?? []) as unknown as MemberLookupRow[])
        .map(m => [m.id, m.full_name]),
    )
    const planMap = new Map<string, string>(
      ((plansRes.data ?? []) as unknown as PlanLookupRow[])
        .map(p => [p.id, p.name]),
    )
    // Sum all payment amounts per membership_id
    const paidByMembership = new Map<string, number>()
    for (const p of (paymentSumsRes.data ?? []) as unknown as PaymentSumRow[]) {
      paidByMembership.set(
        p.membership_id,
        (paidByMembership.get(p.membership_id) ?? 0) + Number(p.amount),
      )
    }

    // ── Stats ────────────────────────────────────────────────────────────────

    const memberships = (membershipsRes.data ?? []) as unknown as MembershipRow[]

    const totalMembers = totalMembersRes.count ?? 0
    const activeMembers = countUniqueActiveMembers(memberships, today)
    const expiringSoon = memberships.filter(m => isMembershipExpiringSoon(m, today, 7)).length
    const expired = memberships.filter(m => isMembershipExpired(m, today)).length

    const revenueThisMonth = ((monthRevenueRes.data ?? []) as unknown as MonthRevenueRow[])
      .reduce((sum, p) => sum + Number(p.amount), 0)

    // ── Pending payments: stat totals + bounded list ──────────────────────────
    //
    // pending = actual_fee − sum(payments for this membership)
    // This is calculated from historical data; actual_fee is immutable per
    // REQUIREMENTS.md. Financial calculations run server-side only.

    // Sort by payment_due_date ASC (nulls last) so the list shows most-urgent first
    const sortedMemberships = [...memberships].sort((a, b) => {
      if (!a.payment_due_date && !b.payment_due_date) return 0
      if (!a.payment_due_date) return 1
      if (!b.payment_due_date) return -1
      return a.payment_due_date.localeCompare(b.payment_due_date)
    })

    let pendingPaymentsAmount = 0
    let pendingPaymentsCount = 0
    const pendingList: Array<{
      membershipId: string
      memberId: string
      memberName: string
      planName: string
      actualFee: number
      paidAmount: number
      pendingAmount: number
      paymentDueDate: string | null
      paymentStatus: 'unpaid' | 'partially_paid' | 'overdue'
    }> = []

    for (const m of sortedMemberships) {
      if (!isMembershipEligibleForPendingDues(m, today)) continue

      const paid = paidByMembership.get(m.id) ?? 0
      const pending = Number(m.actual_fee) - paid
      if (pending > 0.005) {  // tolerance for floating-point noise
        pendingPaymentsAmount += pending
        pendingPaymentsCount++
        if (pendingList.length < 10) {
          const isOverdue =
            m.payment_due_date != null && m.payment_due_date < today
          pendingList.push({
            membershipId: m.id,
            memberId: m.member_id,
            memberName: memberMap.get(m.member_id) ?? 'Unknown',
            planName: planMap.get(m.plan_id) ?? 'Unknown Plan',
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

    // ── Upcoming renewals list ────────────────────────────────────────────────
    //
    // Show active memberships expiring between 7 days ago and 14 days from now.
    // This catches memberships that are about to expire AND ones that expired
    // very recently but haven't been renewed yet (status still 'active' since
    // the status field is application-managed, not auto-updated by a trigger).

    const nowMs = new Date(today + 'T00:00:00').getTime()

    const renewalsList = memberships
      .filter(
        m =>
          m.status !== 'cancelled' &&
          m.start_date <= today &&
          m.expiry_date >= sevenDaysAgo &&
          m.expiry_date <= fourteenDaysOut,
      )
      .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
      .slice(0, 10)
      .map(m => {
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

    // ── Recent payments list ──────────────────────────────────────────────────

    const recentPaymentsList = (
      (recentPaymentsRes.data ?? []) as unknown as RecentPaymentRow[]
    ).map(p => ({
      paymentId: p.id,
      memberId: p.member_id,
      memberName: memberMap.get(p.member_id) ?? 'Unknown',
      amount: Number(p.amount),
      paymentDate: p.payment_date,
      paymentMethod: p.payment_method,
      purpose: p.purpose,
    }))

    // ── Reminders summary ───────────────────────────────────────────────────

    let scheduledRemindersCount = 0
    let sentRemindersCount = 0
    let failedRemindersCount = 0
    for (const r of (allRemindersRes.data ?? []) as Array<{ status: string }>) {
      if (r.status === 'scheduled') scheduledRemindersCount++
      else if (r.status === 'sent' || r.status === 'delivered') sentRemindersCount++
      else if (r.status === 'failed') failedRemindersCount++
    }

    const recentRemindersList = (
      (recentRemindersRes.data ?? []) as Array<{
        id: string
        reminder_stage: string
        channel: string
        status: string
        scheduled_at: string
        member_id: string
      }>
    ).map(r => ({
      id: r.id,
      memberName: memberMap.get(r.member_id) ?? 'Unknown Member',
      reminderStage: r.reminder_stage,
      channel: r.channel,
      status: r.status,
      scheduledAt: r.scheduled_at,
    }))

    // ── Response ──────────────────────────────────────────────────────────────

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
          totalCount: (allRemindersRes.data ?? []).length,
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
