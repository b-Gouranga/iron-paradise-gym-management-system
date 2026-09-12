import type { Request, Response } from 'express'
import { getSupabaseAdmin } from '../services/database/supabaseAdmin.js'
import { logAuditEvent } from '../services/audit/auditService.js'
import { isMembershipEligibleForPendingDues } from '../utils/membershipStatus.js'
import type {
  MembershipPaymentSummary,
  MemberPaymentSummary,
  PaymentMethod,
  PaymentPurpose,
  PaymentRow,
  PaymentStatus,
  PaymentSummaryStats,
  PaymentWithDetails,
} from '../types/payments.js'

const VALID_METHODS: PaymentMethod[] = ['cash', 'upi', 'card', 'bank_transfer', 'other']
const VALID_PURPOSES: PaymentPurpose[] = [
  'new_membership',
  'renewal',
  'partial_payment',
  'pending_fee',
  'other',
]

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validateDateString(d: unknown): d is string {
  if (typeof d !== 'string' || !DATE_RE.test(d)) return false
  const [y, m, day] = d.split('-').map(Number)
  if (!y || !m || !day) return false
  const dateObj = new Date(Date.UTC(y, m - 1, day))
  return (
    dateObj.getUTCFullYear() === y &&
    dateObj.getUTCMonth() === m - 1 &&
    dateObj.getUTCDate() === day
  )
}

function isoDate(offsetDays = 0): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

/**
 * Single source of truth for payment status computation.
 *
 * Requirements:
 * - Paid: totalPaid >= actualFee
 * - Partially Paid: totalPaid > 0 AND totalPaid < actualFee (and not overdue)
 * - Unpaid: totalPaid === 0 (and not overdue)
 * - Overdue: pending > 0 AND payment_due_date < today
 */
export function computePaymentStatus(
  actualFee: number,
  totalPaid: number,
  dueDate: string | null | undefined,
): PaymentStatus {
  const pending = Math.max(0, actualFee - totalPaid)
  const today = isoDate()
  const isOverdue = Boolean(dueDate && dueDate < today && pending > 0.005)

  if (pending <= 0.005) {
    return 'Paid'
  }
  if (totalPaid <= 0.005) {
    return isOverdue ? 'Overdue' : 'Unpaid'
  }
  return isOverdue ? 'Overdue' : 'Partially Paid'
}

/**
 * GET /api/payments
 *
 * Paginated list of all recorded payments with joined member and plan details.
 * Supports query params:
 *   q / search — search by member name or member code
 *   method / payment_method — filter by payment_method
 *   purpose — filter by purpose
 *   date_from — filter payment_date >= date_from
 *   date_to — filter payment_date <= date_to
 *   page    — 1-based page number (default: 1)
 *   limit   — rows per page (default: 20)
 */
export async function listPayments(req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseAdmin()
  const q = String(req.query.q || req.query.search || '').trim()
  const method = String(req.query.method || req.query.payment_method || '').trim()
  const purpose = String(req.query.purpose || '').trim()
  const dateFrom = String(req.query.date_from || '').trim()
  const dateTo = String(req.query.date_to || '').trim()
  const page = String(req.query.page || '1')
  const limit = String(req.query.limit || '20')

  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
  const offset = (pageNum - 1) * limitNum

  try {
    // 1. Calculate overall summary metrics
    const [allPaymentsRes, allMembershipsRes] = await Promise.all([
      supabase.from('payments').select('membership_id, amount'),
      supabase.from('memberships').select('id, actual_fee, status, start_date, expiry_date'),
    ])

    const allPayments = (allPaymentsRes.data ?? []) as unknown as { membership_id: string; amount: number }[]
    const totalRevenue = allPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const totalRecordedCount = allPayments.length

    const paidByMembership = new Map<string, number>()
    for (const p of allPayments) {
      paidByMembership.set(
        p.membership_id,
        (paidByMembership.get(p.membership_id) ?? 0) + Number(p.amount),
      )
    }

    const today = isoDate()
    let totalPendingEstimate = 0
    let totalPendingCount = 0
    for (const m of (allMembershipsRes.data ?? []) as unknown as {
      id: string
      actual_fee: number
      status: string
      start_date: string
      expiry_date: string
    }[]) {
      if (!isMembershipEligibleForPendingDues(m, today)) continue

      const paid = paidByMembership.get(m.id) ?? 0
      const pending = Math.max(0, Number(m.actual_fee) - paid)
      if (pending > 0.005) {
        totalPendingEstimate += pending
        totalPendingCount++
      }
    }

    const summary: PaymentSummaryStats = {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalRecordedCount,
      totalPendingEstimate: Math.round(totalPendingEstimate * 100) / 100,
      totalPendingCount,
    }

    // 2. Member search filter
    let memberIds: string[] | null = null
    const searchTerm = q.trim()

    if (searchTerm) {
      const sanitized = searchTerm.replace(/[%_\\]/g, '\\$&')
      const { data: matchedMembers } = await supabase
        .from('members')
        .select('id')
        .or(`full_name.ilike.%${sanitized}%,member_code.ilike.%${sanitized}%`)

      memberIds = (matchedMembers ?? []).map(m => m.id as string)
      if (memberIds.length === 0) {
        res.json({
          success: true,
          data: {
            payments: [],
            total: 0,
            page: pageNum,
            limit: limitNum,
            totalPages: 0,
            pagination: {
              total: 0,
              page: pageNum,
              limit: limitNum,
              totalPages: 0,
            },
            summary,
          },
        })
        return
      }
    }

    // 3. Payments table query
    let query = supabase
      .from('payments')
      .select('*', { count: 'exact' })

    if (memberIds !== null) {
      query = query.in('member_id', memberIds)
    }

    if (method && VALID_METHODS.includes(method as PaymentMethod)) {
      query = query.eq('payment_method', method)
    }

    if (purpose && VALID_PURPOSES.includes(purpose as PaymentPurpose)) {
      query = query.eq('purpose', purpose)
    }

    if (dateFrom && validateDateString(dateFrom)) {
      query = query.gte('payment_date', dateFrom)
    }

    if (dateTo && validateDateString(dateTo)) {
      query = query.lte('payment_date', dateTo)
    }

    query = query
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)

    const { data: rows, count, error } = await query
    if (error) throw error

    // 4. Fetch member and plan lookups for returned payments
    const pRows = (rows ?? []) as unknown as PaymentRow[]
    const uniqueMemberIds = [...new Set(pRows.map(p => p.member_id))]
    const uniqueMembershipIds = [...new Set(pRows.map(p => p.membership_id))]

    const [membersRes, membershipsRes] = await Promise.all([
      uniqueMemberIds.length > 0
        ? supabase.from('members').select('id, full_name, member_code').in('id', uniqueMemberIds)
        : { data: [] },
      uniqueMembershipIds.length > 0
        ? supabase.from('memberships').select('id, membership_plans(name)').in('id', uniqueMembershipIds)
        : { data: [] },
    ])

    const memberLookup = new Map<string, { full_name: string; member_code: string }>()
    for (const m of (membersRes.data ?? []) as unknown as { id: string; full_name: string; member_code: string }[]) {
      memberLookup.set(m.id, m)
    }

    const planLookup = new Map<string, string>()
    for (const ms of (membershipsRes.data ?? []) as unknown as {
      id: string
      membership_plans: { name: string } | { name: string }[] | null
    }[]) {
      const p = Array.isArray(ms.membership_plans) ? ms.membership_plans[0] : ms.membership_plans
      planLookup.set(ms.id, p?.name ?? 'Unknown Plan')
    }

    const enriched: PaymentWithDetails[] = pRows.map(p => {
      const m = memberLookup.get(p.member_id)
      return {
        ...p,
        amount: Number(p.amount),
        member_name: m?.full_name ?? 'Unknown Member',
        member_code: m?.member_code ?? '—',
        plan_name: planLookup.get(p.membership_id) ?? 'Unknown Plan',
      }
    })

    const total = count ?? 0
    const totalPages = total > 0 ? Math.ceil(total / limitNum) : 0

    res.json({
      success: true,
      data: {
        payments: enriched,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
        },
        summary,
      },
    })
  } catch (err) {
    console.error('[paymentsController] listPayments error', err)
    res.status(500).json({ success: false, message: 'Failed to load payments.' })
  }
}

/**
 * GET /api/members/:memberId/payments
 *
 * Returns all payment records for a specific member along with comprehensive
 * financial summaries (contracted fees, total paid, total pending, payment status).
 */
export async function getMemberPayments(req: Request, res: Response): Promise<void> {
  const memberId = String(req.params.memberId || req.params.id || '').trim()
  const supabase = getSupabaseAdmin()

  if (!memberId || memberId === 'undefined') {
    res.status(400).json({ success: false, message: 'Member ID is required.' })
    return
  }

  try {
    // 1. Verify member exists
    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select('id, full_name, member_code')
      .eq('id', memberId)
      .single()

    if (memberErr?.code === 'PGRST116' || !member) {
      res.status(404).json({ success: false, message: 'Member not found.' })
      return
    }
    if (memberErr) throw memberErr

    // 2. Fetch memberships for this member
    const { data: memberships, error: msErr } = await supabase
      .from('memberships')
      .select('id, actual_fee, payment_due_date, status, start_date, expiry_date, membership_plans(name)')
      .eq('member_id', memberId)
      .order('start_date', { ascending: false })

    if (msErr) throw msErr

    // 3. Fetch all payments for this member
    const { data: payments, error: pErr } = await supabase
      .from('payments')
      .select('*')
      .eq('member_id', memberId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (pErr) throw pErr

    const pRows = (payments ?? []) as unknown as PaymentRow[]

    // Map payments to memberships
    const paidByMembership = new Map<string, number>()
    for (const p of pRows) {
      paidByMembership.set(
        p.membership_id,
        (paidByMembership.get(p.membership_id) ?? 0) + Number(p.amount),
      )
    }

    let totalContractedFee = 0
    let totalPaid = 0
    let totalPending = 0

    const membershipsSummary: MembershipPaymentSummary[] = (memberships ?? []).map(m => {
      const raw = m as unknown as {
        id: string
        actual_fee: number
        payment_due_date: string | null
        status: string
        membership_plans: { name: string } | { name: string }[] | null
      }

      const planObj = Array.isArray(raw.membership_plans) ? raw.membership_plans[0] : raw.membership_plans
      const planName = planObj?.name ?? 'Unknown Plan'
      const actualFee = Number(raw.actual_fee)
      const paid = paidByMembership.get(raw.id) ?? 0
      const pending = Math.max(0, Math.round((actualFee - paid) * 100) / 100)
      const pStatus = computePaymentStatus(actualFee, paid, raw.payment_due_date)

      totalContractedFee += actualFee
      totalPaid += paid
      totalPending += pending

      return {
        membership_id: raw.id,
        plan_name: planName,
        actual_fee: actualFee,
        total_paid: Math.round(paid * 100) / 100,
        pending_amount: pending,
        payment_status: pStatus,
        payment_due_date: raw.payment_due_date,
      }
    })

    const planMap = new Map<string, string>()
    for (const ms of membershipsSummary) {
      planMap.set(ms.membership_id, ms.plan_name)
    }

    const enrichedPayments: PaymentWithDetails[] = pRows.map(p => ({
      ...p,
      amount: Number(p.amount),
      member_name: member.full_name,
      member_code: member.member_code,
      plan_name: planMap.get(p.membership_id) ?? 'Unknown Plan',
    }))

    // Determine current membership status
    const currentActive = membershipsSummary[0] ?? null
    const currentStatus = currentActive?.payment_status ?? null

    const result: MemberPaymentSummary = {
      member_id: memberId,
      total_contracted_fee: Math.round(totalContractedFee * 100) / 100,
      total_paid: Math.round(totalPaid * 100) / 100,
      total_pending: Math.round(totalPending * 100) / 100,
      current_membership_status: currentStatus,
      memberships_summary: membershipsSummary,
      payments: enrichedPayments,
    }

    res.json({ success: true, data: result })
  } catch (err) {
    console.error('[paymentsController] getMemberPayments error', err)
    res.status(500).json({ success: false, message: 'Failed to load member payments.' })
  }
}

/**
 * GET /api/memberships/:membershipId/payments
 *
 * Returns payments and financial balance specifically for that membership.
 */
export async function getMembershipPayments(req: Request, res: Response): Promise<void> {
  const membershipId = String(req.params.membershipId || req.params.id || '').trim()
  const supabase = getSupabaseAdmin()

  if (!membershipId || membershipId === 'undefined') {
    res.status(400).json({ success: false, message: 'Membership ID is required.' })
    return
  }

  try {
    const { data: membership, error: msErr } = await supabase
      .from('memberships')
      .select('id, member_id, actual_fee, payment_due_date, status, membership_plans(name), members(full_name, member_code)')
      .eq('id', membershipId)
      .single()

    if (msErr?.code === 'PGRST116' || !membership) {
      res.status(404).json({ success: false, message: 'Membership not found.' })
      return
    }
    if (msErr) throw msErr

    const rawMs = membership as unknown as {
      id: string
      member_id: string
      actual_fee: number
      payment_due_date: string | null
      status: string
      membership_plans: { name: string } | { name: string }[] | null
      members: { full_name: string; member_code: string } | null
    }

    const planObj = Array.isArray(rawMs.membership_plans) ? rawMs.membership_plans[0] : rawMs.membership_plans
    const planName = planObj?.name ?? 'Unknown Plan'
    const memberName = rawMs.members?.full_name ?? 'Unknown Member'
    const memberCode = rawMs.members?.member_code ?? '—'

    // Fetch payments for this membership
    const { data: payments, error: pErr } = await supabase
      .from('payments')
      .select('*')
      .eq('membership_id', membershipId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (pErr) throw pErr

    const pRows = (payments ?? []) as unknown as PaymentRow[]
    const totalPaid = pRows.reduce((sum, p) => sum + Number(p.amount), 0)
    const actualFee = Number(rawMs.actual_fee)
    const pendingAmount = Math.max(0, Math.round((actualFee - totalPaid) * 100) / 100)
    const paymentStatus = computePaymentStatus(actualFee, totalPaid, rawMs.payment_due_date)

    const summary: MembershipPaymentSummary = {
      membership_id: membershipId,
      plan_name: planName,
      actual_fee: actualFee,
      total_paid: Math.round(totalPaid * 100) / 100,
      pending_amount: pendingAmount,
      payment_status: paymentStatus,
      payment_due_date: rawMs.payment_due_date,
    }

    const enrichedPayments: PaymentWithDetails[] = pRows.map(p => ({
      ...p,
      amount: Number(p.amount),
      member_name: memberName,
      member_code: memberCode,
      plan_name: planName,
    }))

    res.json({
      success: true,
      data: {
        summary,
        payments: enrichedPayments,
      },
    })
  } catch (err) {
    console.error('[paymentsController] getMembershipPayments error', err)
    res.status(500).json({ success: false, message: 'Failed to load membership payments.' })
  }
}

/**
 * POST /api/memberships/:membershipId/payments OR POST /api/payments
 *
 * Records a manual payment received by gym staff.
 *
 * Strict financial validations:
 * - Amount must be positive (> 0)
 * - Amount cannot exceed the remaining pending balance
 * - Payment date must be valid YYYY-MM-DD
 * - Payment method must be one of: cash, upi, card, bank_transfer, other
 * - Purpose must be one of: new_membership, renewal, partial_payment, pending_fee, other
 * - Preserves historical payments: never overwrites existing records
 */
export async function recordPayment(req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseAdmin()
  const membershipId = String(
    req.params.membershipId || req.params.id || req.body?.membership_id || '',
  ).trim()
  const body = (req.body ?? {}) as Record<string, unknown>

  const amountNum = Number(body.amount)
  const paymentDate = String(body.payment_date ?? '').trim()
  const paymentMethod = body.payment_method as PaymentMethod
  const purpose = body.purpose as PaymentPurpose
  const notes = body.notes ? String(body.notes).trim() || null : null

  const errors: string[] = []

  if (!membershipId) {
    errors.push('Membership ID is required.')
  }
  if (isNaN(amountNum) || !isFinite(amountNum) || amountNum <= 0) {
    errors.push('Payment amount must be a positive number greater than 0.')
  }
  if (!validateDateString(paymentDate)) {
    errors.push('Payment date must be a valid date in YYYY-MM-DD format.')
  }
  if (!VALID_METHODS.includes(paymentMethod)) {
    errors.push(`Payment method must be one of: ${VALID_METHODS.join(', ')}.`)
  }
  if (!VALID_PURPOSES.includes(purpose)) {
    errors.push(`Payment purpose must be one of: ${VALID_PURPOSES.join(', ')}.`)
  }

  if (errors.length > 0) {
    res.status(400).json({ success: false, message: errors.join(' ') })
    return
  }

  try {
    // 1. Fetch membership to verify it exists and get contracted fee & member_id
    const { data: membership, error: msErr } = await supabase
      .from('memberships')
      .select('id, member_id, actual_fee, payment_due_date, membership_plans(name)')
      .eq('id', membershipId)
      .single()

    if (msErr?.code === 'PGRST116' || !membership) {
      res.status(404).json({ success: false, message: 'Membership not found.' })
      return
    }
    if (msErr) throw msErr

    // 2. Fetch existing payments for this membership to compute current pending balance
    const { data: existingPayments, error: pErr } = await supabase
      .from('payments')
      .select('amount')
      .eq('membership_id', membershipId)

    if (pErr) throw pErr

    const existingTotalPaid = (existingPayments ?? []).reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    )
    const actualFee = Number(membership.actual_fee)
    const currentPending = Math.max(0, Math.round((actualFee - existingTotalPaid) * 100) / 100)

    // 3. Overpayment check
    const paymentAmount = Math.round(amountNum * 100) / 100
    if (paymentAmount > currentPending + 0.005) {
      res.status(400).json({
        success: false,
        message: `Payment amount (₹${paymentAmount.toLocaleString('en-IN')}) cannot exceed the remaining pending balance of ₹${currentPending.toLocaleString('en-IN')}.`,
      })
      return
    }

    // 4. Insert payment record
    const { data: newPayment, error: insertErr } = await supabase
      .from('payments')
      .insert({
        member_id: membership.member_id,
        membership_id: membership.id,
        amount: paymentAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        purpose: purpose,
        notes: notes,
        created_by: req.authUser?.id ?? null,
      })
      .select()
      .single()

    if (insertErr) throw insertErr

    await logAuditEvent({
      actorId: req.authUser?.id,
      entityType: 'payment',
      entityId: newPayment.id,
      action: 'payment_recorded',
      newData: {
        member_id: newPayment.member_id,
        membership_id: newPayment.membership_id,
        amount: newPayment.amount,
        payment_method: newPayment.payment_method,
        purpose: newPayment.purpose,
      },
    })

    // 5. Compute updated balance
    const newTotalPaid = Math.round((existingTotalPaid + paymentAmount) * 100) / 100
    const newPending = Math.max(0, Math.round((actualFee - newTotalPaid) * 100) / 100)
    const newStatus = computePaymentStatus(actualFee, newTotalPaid, membership.payment_due_date)

    const rawPlan = membership.membership_plans as unknown as
      | { name: string }
      | { name: string }[]
      | null
    const planName = Array.isArray(rawPlan) ? rawPlan[0]?.name : rawPlan?.name

    const updatedSummary: MembershipPaymentSummary = {
      membership_id: membership.id,
      plan_name: planName ?? 'Unknown Plan',
      actual_fee: actualFee,
      total_paid: newTotalPaid,
      pending_amount: newPending,
      payment_status: newStatus,
      payment_due_date: membership.payment_due_date,
    }

    res.status(201).json({
      success: true,
      data: {
        payment: newPayment,
        summary: updatedSummary,
      },
    })
  } catch (err) {
    console.error('[paymentsController] recordPayment error', err)
    res.status(500).json({ success: false, message: 'Failed to record payment.' })
  }
}
