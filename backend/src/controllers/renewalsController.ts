import type { Request, Response } from 'express'
import { getSupabaseAdmin } from '../services/database/supabaseAdmin.js'
import {
  isoDate,
  isMembershipActive,
  isMembershipExpired,
  isMembershipFuture,
} from '../utils/membershipStatus.js'
import { getRenewalReport } from '../services/reports/reportsService.js'

interface RawMembershipWithJoins {
  id: string
  member_id: string
  plan_id: string
  previous_membership_id: string | null
  start_date: string
  expiry_date: string
  actual_fee: number
  payment_due_date: string | null
  status: string
  created_at: string
  updated_at: string
}

interface RawMember {
  id: string
  member_code: string
  full_name: string
  phone: string | null
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

/**
 * GET /api/renewals/upcoming
 *
 * Lists active memberships approaching expiry.
 * Query params:
 *   - days: number of days ahead to look (default 30, 'all' for all active)
 *   - q: search filter (name, member_code, phone, plan)
 *
 * Requirements enforced:
 *   - Cancelled memberships excluded
 *   - Future memberships (start_date > today) strictly excluded
 *   - Expired memberships (expiry_date < today) strictly excluded
 *   - Identifies if member already holds a future/renewal membership
 */
export async function getUpcomingRenewals(req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseAdmin()
  const today = isoDate()

  const daysParam = String(req.query.days || '30').trim()
  const q = String(req.query.q || '').trim().toLowerCase()
  const windowDays = daysParam === 'all' ? 3650 : Math.max(1, parseInt(daysParam, 10) || 30)
  const maxDate = isoDate(windowDays, today)

  try {
    // 1. Fetch memberships, members, and plans in parallel
    const [membershipsRes, membersRes, plansRes] = await Promise.all([
      supabase
        .from('memberships')
        .select('*')
        .neq('status', 'cancelled')
        .order('expiry_date', { ascending: true }),
      supabase.from('members').select('id, member_code, full_name, phone, status'),
      supabase.from('membership_plans').select('id, name, duration_value, duration_unit, default_fee, is_active'),
    ])

    if (membershipsRes.error) throw membershipsRes.error
    if (membersRes.error) throw membersRes.error
    if (plansRes.error) throw plansRes.error

    const allMemberships = (membershipsRes.data || []) as RawMembershipWithJoins[]
    const memberMap = new Map<string, RawMember>()
    for (const m of (membersRes.data || []) as RawMember[]) {
      memberMap.set(m.id, m)
    }

    const planMap = new Map<string, RawPlan>()
    for (const p of (plansRes.data || []) as RawPlan[]) {
      planMap.set(p.id, p)
    }

    // 2. Identify members with scheduled future or renewal memberships
    const renewedPrevIds = new Set<string>()
    const memberLatestExpiry = new Map<string, string>()

    for (const m of allMemberships) {
      if (m.previous_membership_id) {
        renewedPrevIds.add(m.previous_membership_id)
      }
      const existingLatest = memberLatestExpiry.get(m.member_id)
      if (!existingLatest || m.expiry_date > existingLatest) {
        memberLatestExpiry.set(m.member_id, m.expiry_date)
      }
    }

    // 3. Filter for actively running memberships approaching expiry
    const todayMs = new Date(today + 'T00:00:00Z').getTime()

    let expiring7Count = 0
    let expiring14Count = 0
    let expiring30Count = 0
    let totalActiveCount = 0

    const items = []

    for (const m of allMemberships) {
      // Must be effectively active today
      if (!isMembershipActive(m, today)) {
        continue
      }

      totalActiveCount++

      const expiryMs = new Date(m.expiry_date + 'T00:00:00Z').getTime()
      const daysLeft = Math.round((expiryMs - todayMs) / 86_400_000)

      if (daysLeft <= 7) expiring7Count++
      if (daysLeft <= 14) expiring14Count++
      if (daysLeft <= 30) expiring30Count++

      // Filter by window (unless 'all')
      if (m.expiry_date > maxDate) {
        continue
      }

      const member = memberMap.get(m.member_id)
      const plan = planMap.get(m.plan_id)

      // Search filter
      if (q) {
        const cleanDigits = q.replace(/\D/g, '')
        const nationalDigits = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : ''
        const matchName = (member?.full_name || '').toLowerCase().includes(q)
        const matchCode = (member?.member_code || '').toLowerCase().includes(q)
        const matchPhone =
          (member?.phone || '').toLowerCase().includes(q) ||
          (nationalDigits ? (member?.phone || '').includes(nationalDigits) : false)
        const matchPlan = (plan?.name || '').toLowerCase().includes(q)
        if (!matchName && !matchCode && !matchPhone && !matchPlan) {
          continue
        }
      }

      // Check if already renewed
      const isExplicitlyRenewed = renewedPrevIds.has(m.id)
      const latestExp = memberLatestExpiry.get(m.member_id)
      const hasSubsequentMembership = latestExp ? latestExp > m.expiry_date : false
      const alreadyRenewed = isExplicitlyRenewed || hasSubsequentMembership

      const status = daysLeft <= 7 ? 'expiring_soon' : 'active'

      items.push({
        id: m.id,
        member_id: m.member_id,
        member_name: member?.full_name ?? 'Unknown Member',
        member_code: member?.member_code ?? '—',
        member_phone: member?.phone ?? '—',
        plan_id: m.plan_id,
        plan_name: plan?.name ?? 'Standard Plan',
        duration_value: plan?.duration_value ?? 1,
        duration_unit: plan?.duration_unit ?? 'months',
        start_date: m.start_date,
        expiry_date: m.expiry_date,
        actual_fee: Number(m.actual_fee),
        days_left: daysLeft,
        status,
        already_renewed: alreadyRenewed,
        membership: {
          id: m.id,
          member_id: m.member_id,
          plan_id: m.plan_id,
          previous_membership_id: m.previous_membership_id,
          start_date: m.start_date,
          expiry_date: m.expiry_date,
          actual_fee: Number(m.actual_fee),
          payment_due_date: m.payment_due_date,
          status: 'active',
          created_at: m.created_at,
          updated_at: m.updated_at,
          plan_name: plan?.name ?? 'Standard Plan',
          duration_value: plan?.duration_value ?? 1,
          duration_unit: (plan?.duration_unit ?? 'months') as any,
          renewal_delay_days: null,
        },
      })
    }

    res.json({
      success: true,
      data: {
        upcoming: items,
        total: items.length,
        summary: {
          expiring_7_days: expiring7Count,
          expiring_14_days: expiring14Count,
          expiring_30_days: expiring30Count,
          total_active: totalActiveCount,
        },
      },
    })
  } catch (err: any) {
    console.error('[renewalsController] getUpcomingRenewals error:', err)
    res.status(500).json({ success: false, error: err.message || 'Internal server error' })
  }
}

/**
 * GET /api/renewals/expired
 *
 * Lists expired memberships for members who do NOT currently have an active or future membership.
 */
export async function getExpiredRenewals(req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseAdmin()
  const today = isoDate()

  const daysParam = String(req.query.days || '60').trim()
  const q = String(req.query.q || '').trim().toLowerCase()
  const windowDays = Math.max(1, parseInt(daysParam, 10) || 60)
  const minDate = isoDate(-windowDays, today)

  try {
    const [membershipsRes, membersRes, plansRes] = await Promise.all([
      supabase
        .from('memberships')
        .select('*')
        .neq('status', 'cancelled')
        .order('expiry_date', { ascending: false }),
      supabase.from('members').select('id, member_code, full_name, phone, status'),
      supabase.from('membership_plans').select('id, name, duration_value, duration_unit, default_fee, is_active'),
    ])

    if (membershipsRes.error) throw membershipsRes.error
    if (membersRes.error) throw membersRes.error
    if (plansRes.error) throw plansRes.error

    const allMemberships = (membershipsRes.data || []) as RawMembershipWithJoins[]
    const memberMap = new Map<string, RawMember>()
    for (const m of (membersRes.data || []) as RawMember[]) {
      memberMap.set(m.id, m)
    }

    const planMap = new Map<string, RawPlan>()
    for (const p of (plansRes.data || []) as RawPlan[]) {
      planMap.set(p.id, p)
    }

    // Identify members who have an active or future membership
    const currentlyActiveOrFutureMembers = new Set<string>()
    for (const m of allMemberships) {
      if (isMembershipActive(m, today) || isMembershipFuture(m, today)) {
        currentlyActiveOrFutureMembers.add(m.member_id)
      }
    }

    const todayMs = new Date(today + 'T00:00:00Z').getTime()
    const seenMembers = new Set<string>()
    const items = []

    for (const m of allMemberships) {
      // Must be expired
      if (!isMembershipExpired(m, today)) {
        continue
      }
      // Must not already have an active/future membership
      if (currentlyActiveOrFutureMembers.has(m.member_id)) {
        continue
      }
      // Must fall within window
      if (m.expiry_date < minDate) {
        continue
      }
      // Keep only most recent expired membership per member
      if (seenMembers.has(m.member_id)) {
        continue
      }
      seenMembers.add(m.member_id)

      const member = memberMap.get(m.member_id)
      const plan = planMap.get(m.plan_id)

      if (q) {
        const cleanDigits = q.replace(/\D/g, '')
        const nationalDigits = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : ''
        const matchName = (member?.full_name || '').toLowerCase().includes(q)
        const matchCode = (member?.member_code || '').toLowerCase().includes(q)
        const matchPhone =
          (member?.phone || '').toLowerCase().includes(q) ||
          (nationalDigits ? (member?.phone || '').includes(nationalDigits) : false)
        const matchPlan = (plan?.name || '').toLowerCase().includes(q)
        if (!matchName && !matchCode && !matchPhone && !matchPlan) {
          continue
        }
      }

      const expiryMs = new Date(m.expiry_date + 'T00:00:00Z').getTime()
      const daysExpired = Math.round((todayMs - expiryMs) / 86_400_000)

      items.push({
        id: m.id,
        member_id: m.member_id,
        member_name: member?.full_name ?? 'Unknown Member',
        member_code: member?.member_code ?? '—',
        member_phone: member?.phone ?? '—',
        plan_id: m.plan_id,
        plan_name: plan?.name ?? 'Standard Plan',
        duration_value: plan?.duration_value ?? 1,
        duration_unit: plan?.duration_unit ?? 'months',
        start_date: m.start_date,
        expiry_date: m.expiry_date,
        actual_fee: Number(m.actual_fee),
        days_expired: daysExpired,
        membership: {
          id: m.id,
          member_id: m.member_id,
          plan_id: m.plan_id,
          previous_membership_id: m.previous_membership_id,
          start_date: m.start_date,
          expiry_date: m.expiry_date,
          actual_fee: Number(m.actual_fee),
          payment_due_date: m.payment_due_date,
          status: 'expired',
          created_at: m.created_at,
          updated_at: m.updated_at,
          plan_name: plan?.name ?? 'Standard Plan',
          duration_value: plan?.duration_value ?? 1,
          duration_unit: (plan?.duration_unit ?? 'months') as any,
          renewal_delay_days: null,
        },
      })
    }

    res.json({
      success: true,
      data: {
        expired: items,
        total: items.length,
      },
    })
  } catch (err: any) {
    console.error('[renewalsController] getExpiredRenewals error:', err)
    res.status(500).json({ success: false, error: err.message || 'Internal server error' })
  }
}

/**
 * GET /api/renewals/history
 *
 * Reuses the existing renewal report service to provide completed renewal events and statistics.
 */
export async function getRenewalHistory(req: Request, res: Response): Promise<void> {
  try {
    const data = await getRenewalReport(req.query as any)
    res.json({ success: true, data })
  } catch (err: any) {
    console.error('[renewalsController] getRenewalHistory error:', err)
    res.status(500).json({ success: false, error: err.message || 'Internal server error' })
  }
}
