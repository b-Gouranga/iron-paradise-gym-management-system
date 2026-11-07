import type { Request, Response } from 'express'
import { getSupabaseAdmin } from '../services/database/supabaseAdmin.js'
import { logAuditEvent } from '../services/audit/auditService.js'
import type { DurationUnit } from '../types/membershipPlans.js'
import type {
  MembershipPlanSummary,
  MembershipRow,
  MembershipWithDetails,
} from '../types/memberships.js'
import {
  countUniqueActiveMembers,
  getEffectiveMembershipStatus,
  isMembershipActive,
  isMembershipExpired,
  isMembershipExpiringSoon,
  isMembershipFuture,
  selectCurrentMembership,
} from '../utils/membershipStatus.js'

export {
  countUniqueActiveMembers,
  getEffectiveMembershipStatus,
  isMembershipActive,
  isMembershipExpired,
  isMembershipExpiringSoon,
  isMembershipFuture,
  selectCurrentMembership,
}

// ── Date calculation helpers ──────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function validateDateString(d: unknown): d is string {
  if (typeof d !== 'string' || !DATE_RE.test(d)) return false
  const [y, m, day] = d.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, day))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === day
  )
}

/**
 * Calculates the inclusive expiry date:
 * expiry_date = start_date + duration - 1 day
 *
 * Uses pure UTC calendar arithmetic to prevent any timezone shifts or leaks.
 *
 * Examples:
 * - Start: 2026-09-01 + 1 month  -> 2026-09-30
 * - Start: 2026-09-01 + 3 months -> 2026-11-30
 * - Start: 2026-09-01 + 1 year   -> 2027-08-31
 * - Start: 2026-10-05 + 1 month  -> 2026-11-04
 */
export function calculateInclusiveExpiry(
  startDateStr: string,
  durationValue: number,
  durationUnit: DurationUnit,
): string {
  const [year, month, day] = startDateStr.split('-').map(Number)

  if (durationUnit === 'days') {
    const d = new Date(Date.UTC(year, month - 1, day))
    d.setUTCDate(d.getUTCDate() + durationValue - 1)
    return d.toISOString().split('T')[0]
  }

  if (durationUnit === 'months') {
    let targetMonth = month - 1 + durationValue
    const targetYear = year + Math.floor(targetMonth / 12)
    targetMonth = targetMonth % 12

    // Clamp day to maximum days in target month
    const maxDaysInTargetMonth = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0),
    ).getUTCDate()
    const targetDay = Math.min(day, maxDaysInTargetMonth)

    const d = new Date(Date.UTC(targetYear, targetMonth, targetDay))
    d.setUTCDate(d.getUTCDate() - 1)
    return d.toISOString().split('T')[0]
  }

  if (durationUnit === 'years') {
    const targetYear = year + durationValue
    const targetMonth = month - 1
    const maxDays = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0),
    ).getUTCDate()
    const targetDay = Math.min(day, maxDays)

    const d = new Date(Date.UTC(targetYear, targetMonth, targetDay))
    d.setUTCDate(d.getUTCDate() - 1)
    return d.toISOString().split('T')[0]
  }

  throw new Error(`Unsupported duration unit: ${durationUnit}`)
}

/**
 * Calculates renewal delay in days:
 * renewal delay = new_start_date - previous_expiry_date
 *
 * Example:
 * previous_expiry: 2026-09-30
 * new_start: 2026-10-05
 * delay: 5 days
 */
export function calculateRenewalDelayDays(
  previousExpiryDateStr: string,
  newStartDateStr: string,
): number {
  const [pY, pM, pD] = previousExpiryDateStr.split('-').map(Number)
  const [nY, nM, nD] = newStartDateStr.split('-').map(Number)
  const prevExpiryUtc = Date.UTC(pY, pM - 1, pD)
  const newStartUtc = Date.UTC(nY, nM - 1, nD)
  return Math.round((newStartUtc - prevExpiryUtc) / 86_400_000)
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/members/:memberId/memberships
 *
 * Returns complete chronological membership history for a member.
 * Newest records first.
 * Includes joined plan details and computed renewal delays.
 */
export async function listMemberMemberships(req: Request, res: Response): Promise<void> {
  const { memberId } = req.params
  const supabase = getSupabaseAdmin()

  try {
    // Verify member exists
    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select('id')
      .eq('id', memberId)
      .single()

    if (memberErr?.code === 'PGRST116' || !member) {
      res.status(404).json({ success: false, message: 'Member not found.' })
      return
    }
    if (memberErr) throw memberErr

    // Fetch all memberships for this member
    const { data: rows, error } = await supabase
      .from('memberships')
      .select('*, membership_plans(id, name, duration_value, duration_unit)')
      .eq('member_id', memberId)
      .order('start_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    // Build map to lookup previous membership expiry dates for renewal delay
    const membershipMap = new Map<string, MembershipRow>()
    for (const r of (rows ?? []) as unknown as MembershipRow[]) {
      membershipMap.set(r.id, r)
    }

    const enriched: MembershipWithDetails[] = (rows ?? []).map(r => {
      const raw = r as unknown as MembershipRow & {
        membership_plans: MembershipPlanSummary | MembershipPlanSummary[] | null
      }

      const planObj = Array.isArray(raw.membership_plans)
        ? raw.membership_plans[0]
        : raw.membership_plans

      let renewalDelayDays: number | null = null
      if (raw.previous_membership_id) {
        const prev = membershipMap.get(raw.previous_membership_id)
        if (prev?.expiry_date) {
          renewalDelayDays = calculateRenewalDelayDays(prev.expiry_date, raw.start_date)
        }
      }

      return {
        id: raw.id,
        member_id: raw.member_id,
        plan_id: raw.plan_id,
        previous_membership_id: raw.previous_membership_id,
        start_date: raw.start_date,
        expiry_date: raw.expiry_date,
        actual_fee: Number(raw.actual_fee),
        payment_due_date: raw.payment_due_date,
        status: getEffectiveMembershipStatus(raw),
        created_at: raw.created_at,
        updated_at: raw.updated_at,
        plan_name: planObj?.name ?? 'Unknown Plan',
        duration_value: planObj?.duration_value ?? 1,
        duration_unit: planObj?.duration_unit ?? 'months',
        renewal_delay_days: renewalDelayDays,
      }
    })

    res.json({ success: true, data: enriched })
  } catch (err) {
    console.error('[membershipsController] listMemberMemberships error', err)
    res.status(500).json({ success: false, message: 'Failed to load member memberships.' })
  }
}

/**
 * GET /api/memberships/:id
 *
 * Returns a single membership with plan information.
 */
export async function getMembership(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const supabase = getSupabaseAdmin()

  try {
    const { data: row, error } = await supabase
      .from('memberships')
      .select('*, membership_plans(id, name, duration_value, duration_unit)')
      .eq('id', id)
      .single()

    if (error?.code === 'PGRST116' || !row) {
      res.status(404).json({ success: false, message: 'Membership not found.' })
      return
    }
    if (error) throw error

    const raw = row as unknown as MembershipRow & {
      membership_plans: MembershipPlanSummary | MembershipPlanSummary[] | null
    }
    const planObj = Array.isArray(raw.membership_plans)
      ? raw.membership_plans[0]
      : raw.membership_plans

    let renewalDelayDays: number | null = null
    if (raw.previous_membership_id) {
      const { data: prev } = await supabase
        .from('memberships')
        .select('expiry_date')
        .eq('id', raw.previous_membership_id)
        .single()
      if (prev?.expiry_date) {
        renewalDelayDays = calculateRenewalDelayDays(prev.expiry_date, raw.start_date)
      }
    }

    const result: MembershipWithDetails = {
      id: raw.id,
      member_id: raw.member_id,
      plan_id: raw.plan_id,
      previous_membership_id: raw.previous_membership_id,
      start_date: raw.start_date,
      expiry_date: raw.expiry_date,
      actual_fee: Number(raw.actual_fee),
      payment_due_date: raw.payment_due_date,
      status: getEffectiveMembershipStatus(raw),
      created_at: raw.created_at,
      updated_at: raw.updated_at,
      plan_name: planObj?.name ?? 'Unknown Plan',
      duration_value: planObj?.duration_value ?? 1,
      duration_unit: planObj?.duration_unit ?? 'months',
      renewal_delay_days: renewalDelayDays,
    }

    res.json({ success: true, data: result })
  } catch (err) {
    console.error('[membershipsController] getMembership error', err)
    res.status(500).json({ success: false, message: 'Failed to load membership.' })
  }
}

/**
 * POST /api/members/:memberId/memberships
 *
 * Creates an initial or new membership for an existing member.
 *
 * Requirements enforced:
 * - member must exist
 * - plan must exist and is_active must be true
 * - start_date must be valid YYYY-MM-DD
 * - actual_fee must be valid non-negative number
 * - expiry_date is calculated server-side
 * - checks for overlapping active memberships for the member
 * - status set to 'active'
 * - NO payment record is created (payment belongs to Part 8)
 */
export async function createMembership(req: Request, res: Response): Promise<void> {
  const { memberId } = req.params
  const supabase = getSupabaseAdmin()
  const body = req.body as Record<string, unknown>

  const planId = String(body.plan_id ?? '').trim()
  const startDate = String(body.start_date ?? '').trim()
  const actualFeeNum = Number(body.actual_fee)
  const paymentDueDate = body.payment_due_date
    ? String(body.payment_due_date).trim()
    : null

  const errors: string[] = []

  if (!planId) errors.push('Membership plan is required.')
  if (!validateDateString(startDate)) {
    errors.push('Start date must be a valid date in YYYY-MM-DD format.')
  }
  if (isNaN(actualFeeNum) || !isFinite(actualFeeNum) || actualFeeNum < 0) {
    errors.push('Actual fee must be a valid non-negative number.')
  }
  if (paymentDueDate && !validateDateString(paymentDueDate)) {
    errors.push('Payment due date must be a valid date in YYYY-MM-DD format.')
  }

  if (errors.length > 0) {
    res.status(400).json({ success: false, message: errors.join(' ') })
    return
  }

  try {
    // 1. Verify member exists
    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select('id, status')
      .eq('id', memberId)
      .single()

    if (memberErr?.code === 'PGRST116' || !member) {
      res.status(404).json({ success: false, message: 'Member not found.' })
      return
    }
    if (memberErr) throw memberErr

    // 2. Verify plan exists and is active
    const { data: plan, error: planErr } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('id', planId)
      .single()

    if (planErr?.code === 'PGRST116' || !plan) {
      res.status(404).json({ success: false, message: 'Membership plan not found.' })
      return
    }
    if (planErr) throw planErr

    if (!plan.is_active) {
      res.status(400).json({
        success: false,
        message: 'Cannot create a membership with an inactive plan.',
      })
      return
    }

    // 3. Calculate expiry date server-side
    const expiryDate = calculateInclusiveExpiry(
      startDate,
      plan.duration_value,
      plan.duration_unit,
    )

    // 4. Overlap protection: check for existing non-cancelled memberships for this member
    const { data: nonCancelledExisting, error: overlapErr } = await supabase
      .from('memberships')
      .select('id, start_date, expiry_date, status')
      .eq('member_id', memberId)
      .neq('status', 'cancelled')

    if (overlapErr) throw overlapErr

    const overlap = (nonCancelledExisting ?? []).find(
      m => m.start_date <= expiryDate && m.expiry_date >= startDate,
    )

    if (overlap) {
      res.status(409).json({
        success: false,
        message: `Member already has an active membership valid from ${overlap.start_date} to ${overlap.expiry_date}. Cannot create overlapping active memberships.`,
      })
      return
    }

    // 5. Insert new membership record
    const { data: newMembership, error: insertErr } = await supabase
      .from('memberships')
      .insert({
        member_id: memberId,
        plan_id: planId,
        start_date: startDate,
        expiry_date: expiryDate,
        actual_fee: Math.round(actualFeeNum * 100) / 100,
        payment_due_date: paymentDueDate || null,
        status: 'active',
      })
      .select('*, membership_plans(id, name, duration_value, duration_unit)')
      .single()

    if (insertErr) throw insertErr

    await logAuditEvent({
      actorId: req.authUser?.id,
      entityType: 'membership',
      entityId: newMembership.id,
      action: 'membership_created',
      newData: {
        member_id: newMembership.member_id,
        plan_id: newMembership.plan_id,
        start_date: newMembership.start_date,
        expiry_date: newMembership.expiry_date,
        actual_fee: newMembership.actual_fee,
      },
    })

    res.status(201).json({ success: true, data: newMembership })
  } catch (err) {
    console.error('[membershipsController] createMembership error', err)
    res.status(500).json({ success: false, message: 'Failed to create membership.' })
  }
}

/**
 * POST /api/memberships/:id/renew
 *
 * Renews an existing membership.
 *
 * Requirements enforced:
 * - previous membership must exist
 * - plan must exist and is_active must be true
 * - start_date must be valid YYYY-MM-DD
 * - actual_fee must be valid non-negative number
 * - expiry_date is calculated server-side
 * - new start_date must not overlap with previous membership or other active memberships
 * - previous membership remains completely unaltered
 * - new membership record created with previous_membership_id = previous.id
 * - NO payment record is created
 */
export async function renewMembership(req: Request, res: Response): Promise<void> {
  const { id: previousId } = req.params
  const supabase = getSupabaseAdmin()
  const body = req.body as Record<string, unknown>

  const planId = String(body.plan_id ?? '').trim()
  const startDate = String(body.start_date ?? '').trim()
  const actualFeeNum = Number(body.actual_fee)
  const paymentDueDate = body.payment_due_date
    ? String(body.payment_due_date).trim()
    : null

  const errors: string[] = []

  if (!planId) errors.push('Membership plan is required.')
  if (!validateDateString(startDate)) {
    errors.push('Start date must be a valid date in YYYY-MM-DD format.')
  }
  if (isNaN(actualFeeNum) || !isFinite(actualFeeNum) || actualFeeNum < 0) {
    errors.push('Actual fee must be a valid non-negative number.')
  }
  if (paymentDueDate && !validateDateString(paymentDueDate)) {
    errors.push('Payment due date must be a valid date in YYYY-MM-DD format.')
  }

  if (errors.length > 0) {
    res.status(400).json({ success: false, message: errors.join(' ') })
    return
  }

  try {
    // 1. Fetch previous membership
    const { data: previous, error: prevErr } = await supabase
      .from('memberships')
      .select('*')
      .eq('id', previousId)
      .single<MembershipRow>()

    if (prevErr?.code === 'PGRST116' || !previous) {
      res.status(404).json({ success: false, message: 'Previous membership not found.' })
      return
    }
    if (prevErr) throw prevErr

    // 2. Fetch new plan
    const { data: plan, error: planErr } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('id', planId)
      .single()

    if (planErr?.code === 'PGRST116' || !plan) {
      res.status(404).json({ success: false, message: 'Membership plan not found.' })
      return
    }
    if (planErr) throw planErr

    if (!plan.is_active) {
      res.status(400).json({
        success: false,
        message: 'Cannot renew using an inactive plan.',
      })
      return
    }

    // 3. Calculate new expiry date server-side
    const expiryDate = calculateInclusiveExpiry(
      startDate,
      plan.duration_value,
      plan.duration_unit,
    )

    // 4. Overlap check with previous membership
    if (startDate <= previous.expiry_date) {
      res.status(409).json({
        success: false,
        message: `Renewal start date (${startDate}) cannot overlap with the previous membership's active period (expires ${previous.expiry_date}).`,
      })
      return
    }

    // 5. Check for overlap with any other non-cancelled membership for this member
    const { data: nonCancelledOther, error: otherErr } = await supabase
      .from('memberships')
      .select('id, start_date, expiry_date, status')
      .eq('member_id', previous.member_id)
      .neq('status', 'cancelled')

    if (otherErr) throw otherErr

    const otherOverlap = (nonCancelledOther ?? []).find(
      m => m.id !== previous.id && m.start_date <= expiryDate && m.expiry_date >= startDate,
    )

    if (otherOverlap) {
      res.status(409).json({
        success: false,
        message: `Member already has an active membership from ${otherOverlap.start_date} to ${otherOverlap.expiry_date}. Cannot create overlapping active memberships.`,
      })
      return
    }

    // 6. Insert brand NEW membership row linking previous_membership_id
    // Note: The previous membership record remains completely untouched!
    const { data: renewedMembership, error: insertErr } = await supabase
      .from('memberships')
      .insert({
        member_id: previous.member_id,
        plan_id: planId,
        previous_membership_id: previous.id,
        start_date: startDate,
        expiry_date: expiryDate,
        actual_fee: Math.round(actualFeeNum * 100) / 100,
        payment_due_date: paymentDueDate || null,
        status: 'active',
      })
      .select('*, membership_plans(id, name, duration_value, duration_unit)')
      .single()

    if (insertErr) throw insertErr

    await logAuditEvent({
      actorId: req.authUser?.id,
      entityType: 'membership',
      entityId: renewedMembership.id,
      action: 'membership_renewed',
      newData: {
        member_id: renewedMembership.member_id,
        previous_membership_id: previous.id,
        start_date: renewedMembership.start_date,
        expiry_date: renewedMembership.expiry_date,
        actual_fee: renewedMembership.actual_fee,
      },
    })

    res.status(201).json({ success: true, data: renewedMembership })
  } catch (err) {
    console.error('[membershipsController] renewMembership error', err)
    res.status(500).json({ success: false, message: 'Failed to renew membership.' })
  }
}

/**
 * PATCH /api/memberships/:id
/**
 * PATCH /api/memberships/:id
 *
 * Updates an existing membership record.
 *
 * Requirements enforced:
 * - Membership must exist (HTTP 404)
 * - Cannot edit a cancelled membership (HTTP 400)
 * - Direct status changes other than cancellation (owner-only) are not permitted (HTTP 400/403)
 * - Validates submitted fields (plan_id, start_date, actual_fee, payment_due_date)
 * - Dates must be valid calendar dates (YYYY-MM-DD)
 * - Recalculates inclusive expiry date server-side if plan_id or start_date changes
 * - Overlap protection: prevents overlapping active memberships for the member (HTTP 409)
 * - Payment integrity: actual_fee cannot be less than total already paid (HTTP 400)
 * - Preserves existing payment records and transaction dates completely unaltered
 * - Reminder safety: marks obsolete pending scheduled reminders as 'cancelled'
 * - In-flight processing reminders are safely preserved and not corrupted
 * - Audit logging: records 'membership_updated' with previousData and newData
 */
export async function updateMembership(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const supabase = getSupabaseAdmin()
  const body = req.body as Record<string, unknown>

  try {
    // 1. Verify membership exists
    const { data: existing, error: findErr } = await supabase
      .from('memberships')
      .select('*, membership_plans(id, name, duration_value, duration_unit, is_active)')
      .eq('id', id)
      .single()

    if (findErr?.code === 'PGRST116' || !existing) {
      res.status(404).json({ success: false, message: 'Membership not found.' })
      return
    }
    if (findErr) throw findErr

    // 2. Reject editing if membership is already cancelled
    if (existing.status === 'cancelled') {
      res.status(400).json({
        success: false,
        message: 'Cannot edit a cancelled membership.',
      })
      return
    }

    // 3. Status checks: do not allow general status edits
    let isCancelling = false
    if ('status' in body) {
      if (body.status === 'cancelled') {
        if (req.authProfile?.role !== 'owner') {
          res.status(403).json({
            success: false,
            message: 'Only the gym owner can cancel a membership.',
          })
          return
        }
        isCancelling = true
      } else {
        res.status(400).json({
          success: false,
          message: 'Direct status changes other than cancellation are not permitted.',
        })
        return
      }
    }

    // 4. Validate permitted fields
    const hasPermittedField =
      'plan_id' in body ||
      'start_date' in body ||
      'actual_fee' in body ||
      'payment_due_date' in body ||
      isCancelling

    if (!hasPermittedField) {
      res.status(400).json({
        success: false,
        message: 'No permitted fields provided for update.',
      })
      return
    }

    const errors: string[] = []
    let targetPlan = (
      Array.isArray(existing.membership_plans)
        ? existing.membership_plans[0]
        : existing.membership_plans
    ) as {
      id: string
      name: string
      duration_value: number
      duration_unit: DurationUnit
      is_active: boolean
    } | null

    let effectivePlanId = existing.plan_id
    if ('plan_id' in body) {
      const pId = String(body.plan_id ?? '').trim()
      if (!pId) {
        errors.push('Membership plan is required.')
      } else {
        const { data: planData, error: planErr } = await supabase
          .from('membership_plans')
          .select('id, name, duration_value, duration_unit, is_active')
          .eq('id', pId)
          .single()

        if (planErr?.code === 'PGRST116' || !planData) {
          res.status(404).json({ success: false, message: 'Membership plan not found.' })
          return
        }
        if (planErr) throw planErr

        if (pId !== existing.plan_id && !planData.is_active) {
          errors.push('Cannot assign an inactive membership plan.')
        }
        targetPlan = planData as any
        effectivePlanId = pId
      }
    }

    let effectiveStartDate = existing.start_date
    if ('start_date' in body) {
      const sd = body.start_date
      if (!validateDateString(sd)) {
        errors.push('Start date must be a valid calendar date in YYYY-MM-DD format.')
      } else {
        effectiveStartDate = sd
      }
    }

    let effectiveActualFee = Number(existing.actual_fee)
    if ('actual_fee' in body) {
      const feeNum = Number(body.actual_fee)
      if (isNaN(feeNum) || !isFinite(feeNum) || feeNum < 0) {
        errors.push('Actual fee must be a valid non-negative number.')
      } else {
        effectiveActualFee = Math.round(feeNum * 100) / 100
      }
    }

    let effectivePaymentDueDate = existing.payment_due_date
    let paymentDueDateProvided = false
    if ('payment_due_date' in body) {
      paymentDueDateProvided = true
      const pdd = body.payment_due_date
      if (pdd === null || pdd === '') {
        effectivePaymentDueDate = null
      } else if (validateDateString(pdd)) {
        effectivePaymentDueDate = pdd
      } else {
        errors.push('Payment due date must be a valid calendar date in YYYY-MM-DD format or null.')
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ success: false, message: errors.join(' ') })
      return
    }

    // 5. Recalculate inclusive expiry date if plan or start_date changed
    let effectiveExpiryDate = existing.expiry_date
    if (('plan_id' in body || 'start_date' in body) && targetPlan) {
      effectiveExpiryDate = calculateInclusiveExpiry(
        effectiveStartDate,
        targetPlan.duration_value,
        targetPlan.duration_unit,
      )
    }

    // 6. Overlap protection: check other non-cancelled memberships for this member
    if (
      effectiveStartDate !== existing.start_date ||
      effectiveExpiryDate !== existing.expiry_date
    ) {
      const { data: otherMemberships, error: overlapErr } = await supabase
        .from('memberships')
        .select('id, start_date, expiry_date, status')
        .eq('member_id', existing.member_id)
        .neq('id', id)
        .neq('status', 'cancelled')

      if (overlapErr) throw overlapErr

      const overlap = (otherMemberships ?? []).find(
        m => m.start_date <= effectiveExpiryDate && m.expiry_date >= effectiveStartDate,
      )

      if (overlap) {
        res.status(409).json({
          success: false,
          message: `Member already has an active membership valid from ${overlap.start_date} to ${overlap.expiry_date}. Cannot create overlapping active memberships.`,
        })
        return
      }
    }

    // 7. Payment safety: check against amount already paid
    if ('actual_fee' in body) {
      const { data: paymentsData, error: payErr } = await supabase
        .from('payments')
        .select('amount')
        .eq('membership_id', id)

      if (payErr) throw payErr

      const totalPaid = (paymentsData ?? []).reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0,
      )

      if (effectiveActualFee < totalPaid - 0.005) {
        res.status(400).json({
          success: false,
          message: `Actual fee (₹${effectiveActualFee}) cannot be less than the amount already paid (₹${totalPaid}).`,
        })
        return
      }
    }

    // 8. Build updates payload
    const updates: Record<string, unknown> = {}
    if ('plan_id' in body) updates.plan_id = effectivePlanId
    if ('start_date' in body) updates.start_date = effectiveStartDate
    if ('plan_id' in body || 'start_date' in body) updates.expiry_date = effectiveExpiryDate
    if ('actual_fee' in body) updates.actual_fee = effectiveActualFee
    if (paymentDueDateProvided) updates.payment_due_date = effectivePaymentDueDate
    if (isCancelling) updates.status = 'cancelled'

    // 9. Execute membership update
    const { data: updated, error: updateErr } = await supabase
      .from('memberships')
      .update(updates)
      .eq('id', id)
      .select('*, membership_plans(id, name, duration_value, duration_unit)')
      .single()

    if (updateErr) throw updateErr

    // 10. Reminder safety: invalidate obsolete scheduled reminders
    const datesOrFeeChanged =
      ('plan_id' in body && effectivePlanId !== existing.plan_id) ||
      ('start_date' in body && effectiveStartDate !== existing.start_date) ||
      ('actual_fee' in body && effectiveActualFee !== Number(existing.actual_fee)) ||
      (paymentDueDateProvided && effectivePaymentDueDate !== existing.payment_due_date)

    if (datesOrFeeChanged || isCancelling) {
      await supabase
        .from('reminders')
        .update({
          status: 'cancelled',
          failure_reason: isCancelling
            ? 'Cancelled: membership was cancelled'
            : 'Cancelled: membership details updated',
          updated_at: new Date().toISOString(),
        })
        .eq('membership_id', id)
        .eq('status', 'scheduled')
    }

    // 11. Audit logging
    if (isCancelling) {
      await logAuditEvent({
        actorId: req.authUser?.id,
        entityType: 'membership',
        entityId: id,
        action: 'membership_cancelled',
        newData: {
          member_id: updated.member_id,
          status: 'cancelled',
        },
      })
    } else {
      await logAuditEvent({
        actorId: req.authUser?.id,
        entityType: 'membership',
        entityId: id,
        action: 'membership_updated',
        previousData: {
          plan_id: existing.plan_id,
          start_date: existing.start_date,
          expiry_date: existing.expiry_date,
          actual_fee: existing.actual_fee,
          payment_due_date: existing.payment_due_date,
        },
        newData: {
          plan_id: updated.plan_id,
          start_date: updated.start_date,
          expiry_date: updated.expiry_date,
          actual_fee: updated.actual_fee,
          payment_due_date: updated.payment_due_date,
        },
      })
    }

    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[membershipsController] updateMembership error', err)
    res.status(500).json({ success: false, message: 'Failed to update membership.' })
  }
}
