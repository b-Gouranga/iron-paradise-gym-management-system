import type { Request, Response } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '../services/database/supabaseAdmin.js'
import type { MemberFilter } from '../types/members.js'
import { getEffectiveMembershipStatus, selectCurrentMembership } from '../utils/membershipStatus.js'
import { logAuditEvent } from '../services/audit/auditService.js'

// ── Date helpers ──────────────────────────────────────────────────────────────

function isoDate(offsetDays = 0): string {
  const d = new Date()
  if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

// ── member_code generation ────────────────────────────────────────────────────

/**
 * Generates the next sequential member code (e.g. IP-00042) by finding the
 * maximum numeric suffix across all existing member codes.
 *
 * Requirements:
 * - format: IP-XXXXX (zero-padded 5 digits, e.g. IP-00001)
 * - must not gap on failed insertions (uses max existing, not sequence)
 * - safe fallback to IP-00001 if table is empty
 */
async function generateNextMemberCode(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from('members')
    .select('member_code')
    .order('member_code', { ascending: false })
    .limit(1)

  if (error) throw error

  if (!data || data.length === 0 || !data[0].member_code) {
    return 'IP-00001'
  }

  const lastCode = data[0].member_code as string
  const match = lastCode.match(/^IP-(\d+)$/)
  if (!match) {
    return 'IP-00001'
  }

  const nextNum = parseInt(match[1], 10) + 1
  return `IP-${String(nextNum).padStart(5, '0')}`
}

// ── Membership attachment helper ──────────────────────────────────────────────

interface MembershipSummary {
  plan_name: string
  expiry_date: string
  status: string
}

async function attachMemberships(
  supabase: SupabaseClient,
  memberIds: string[],
): Promise<Map<string, MembershipSummary>> {
  const map = new Map<string, MembershipSummary>()
  if (memberIds.length === 0) return map

  const today = isoDate()
  const { data } = await supabase
    .from('memberships')
    .select('id, member_id, start_date, expiry_date, status, created_at, membership_plans(name)')
    .in('member_id', memberIds)
    .order('start_date', { ascending: false })

  type RowType = {
    id: string
    member_id: string
    start_date: string
    expiry_date: string
    status: string
    created_at?: string
    membership_plans: { name: string } | { name: string }[] | null
  }

  const rowsByMember = new Map<string, RowType[]>()
  for (const row of ((data ?? []) as unknown as RowType[])) {
    const list = rowsByMember.get(row.member_id) ?? []
    list.push(row)
    rowsByMember.set(row.member_id, list)
  }

  for (const [memberId, rows] of rowsByMember.entries()) {
    const chosen = selectCurrentMembership(rows, today) ?? rows[0]
    if (chosen) {
      const planName = Array.isArray(chosen.membership_plans)
        ? chosen.membership_plans[0]?.name
        : chosen.membership_plans?.name
      map.set(memberId, {
        plan_name: planName ?? 'Unknown Plan',
        expiry_date: chosen.expiry_date,
        status: getEffectiveMembershipStatus(chosen, today),
      })
    }
  }

  return map
}

// ── Validation helpers ────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validateEmail(v: string): boolean {
  return EMAIL_RE.test(v)
}

function validateDate(v: string): boolean {
  if (!DATE_RE.test(v)) return false
  const d = new Date(v)
  return !isNaN(d.getTime())
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/members
 *
 * Supports:
 *   q       — search by name, phone, email, or member_code (ilike)
 *   filter  — all | active | inactive | expiring_soon | expired | payment_pending | payment_overdue
 *   page    — 1-based page number (default 1)
 *   limit   — rows per page (default 20, max 100)
 *
 * Returns paginated members with their most-recent membership attached.
 * Complex filters (expiring_soon, expired, payment_pending, payment_overdue) are
 * resolved with pre-queries; financial calculations run server-side only.
 */
export async function listMembers(req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseAdmin()
  const {
    q = '',
    filter = 'all',
    page = '1',
    limit = '20',
  } = req.query as Record<string, string>

  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
  const offset = (pageNum - 1) * limitNum
  const today = isoDate()

  // Validate filter value
  const validFilters: MemberFilter[] = [
    'all', 'active', 'inactive', 'expiring_soon', 'expired', 'payment_pending', 'payment_overdue',
  ]
  const safeFilter: MemberFilter = validFilters.includes(filter as MemberFilter)
    ? (filter as MemberFilter)
    : 'all'

  try {
    // ── Pre-queries for complex filters ──────────────────────────────────────
    // These resolve a set of matching member IDs which are then applied to the
    // main query via `.in()`. Financial calculations remain server-side.

    let memberIdFilter: string[] | null = null

    if (safeFilter === 'expiring_soon') {
      const sevenDaysOut = isoDate(7)
      const { data, error } = await supabase
        .from('memberships')
        .select('member_id')
        .neq('status', 'cancelled')
        .lte('start_date', today)
        .gte('expiry_date', today)
        .lte('expiry_date', sevenDaysOut)
      if (error) throw error
      memberIdFilter = [...new Set((data ?? []).map(r => r.member_id as string))]
    }

    if (safeFilter === 'expired') {
      const { data: expiredData, error: expErr } = await supabase
        .from('memberships')
        .select('member_id')
        .neq('status', 'cancelled')
        .lt('expiry_date', today)
      if (expErr) throw expErr

      const expiredMemberIds = new Set((expiredData ?? []).map(r => r.member_id as string))

      // Exclude members who have an active membership that has not expired
      const { data: activeData, error: actErr } = await supabase
        .from('memberships')
        .select('member_id')
        .neq('status', 'cancelled')
        .lte('start_date', today)
        .gte('expiry_date', today)
      if (actErr) throw actErr

      for (const r of activeData ?? []) {
        expiredMemberIds.delete(r.member_id as string)
      }

      memberIdFilter = [...expiredMemberIds]
    }

    if (safeFilter === 'payment_pending' || safeFilter === 'payment_overdue') {
      const [membershipsRes, paymentsRes] = await Promise.all([
        supabase.from('memberships').select('id, member_id, actual_fee, payment_due_date'),
        supabase.from('payments').select('membership_id, amount'),
      ])
      if (membershipsRes.error) throw membershipsRes.error
      if (paymentsRes.error) throw paymentsRes.error

      const paidMap = new Map<string, number>()
      for (const p of (paymentsRes.data ?? []) as { membership_id: string; amount: number }[]) {
        paidMap.set(p.membership_id, (paidMap.get(p.membership_id) ?? 0) + Number(p.amount))
      }

      const pendingIds = new Set<string>()
      for (const m of (membershipsRes.data ?? []) as {
        id: string
        member_id: string
        actual_fee: number
        payment_due_date: string | null
      }[]) {
        const paid = paidMap.get(m.id) ?? 0
        const pending = Number(m.actual_fee) - paid
        if (pending > 0.005) {
          if (safeFilter === 'payment_overdue') {
            if (m.payment_due_date && m.payment_due_date < today) {
              pendingIds.add(m.member_id)
            }
          } else {
            pendingIds.add(m.member_id)
          }
        }
      }
      memberIdFilter = [...pendingIds]
    }

    // Early-exit: complex filter matched no members
    if (memberIdFilter !== null && memberIdFilter.length === 0) {
      return void res.json({
        success: true,
        data: { members: [], total: 0, page: pageNum, limit: limitNum, totalPages: 0 },
      })
    }

    // ── Main paginated query ──────────────────────────────────────────────────

    // Sanitise the search string to avoid LIKE injection
    const searchTerm = q.trim().replace(/[%_\\]/g, '\\$&')

    let query = supabase
      .from('members')
      .select(
        'id, member_code, full_name, phone, email, status, joining_date, created_at',
        { count: 'exact' },
      )

    if (searchTerm) {
      query = query.or(
        `full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,member_code.ilike.%${searchTerm}%`,
      )
    }

    if (safeFilter === 'active' || safeFilter === 'inactive') {
      query = query.eq('status', safeFilter)
    }

    if (memberIdFilter !== null) {
      query = query.in('id', memberIdFilter)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)

    const { data: members, count, error } = await query
    if (error) throw error

    // ── Attach most-recent membership per member ───────────────────────────

    const memberIds = (members ?? []).map(m => m.id as string)
    const membershipMap = await attachMemberships(supabase, memberIds)

    const enriched = (members ?? []).map(m => ({
      ...m,
      current_membership: membershipMap.get(m.id as string) ?? null,
    }))

    const total = count ?? 0
    const totalPages = Math.ceil(total / limitNum)

    res.json({
      success: true,
      data: { members: enriched, total, page: pageNum, limit: limitNum, totalPages },
    })
  } catch (err) {
    console.error('[membersController] listMembers error', err)
    res.status(500).json({ success: false, message: 'Failed to load members.' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/members/:id
 *
 * Returns the full member record plus a summary of their most-recent
 * membership. Payment history and full membership history are deferred to
 * Parts 7 and 8 respectively.
 */
export async function getMember(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const supabase = getSupabaseAdmin()

  try {
    const { data: member, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .single()

    if (error?.code === 'PGRST116' || !member) {
      res.status(404).json({ success: false, message: 'Member not found.' })
      return
    }
    if (error) throw error

    // Most-recent membership (1 row)
    const { data: memberships } = await supabase
      .from('memberships')
      .select('id, start_date, expiry_date, actual_fee, payment_due_date, status, membership_plans(name)')
      .eq('member_id', id)
      .order('start_date', { ascending: false })
      .limit(1)

    const latest = (memberships?.[0] ?? null) as unknown as {
      id: string
      start_date: string
      expiry_date: string
      actual_fee: number
      payment_due_date: string | null
      status: string
      membership_plans: { name: string } | { name: string }[] | null
    } | null

    const planName = Array.isArray(latest?.membership_plans)
      ? latest?.membership_plans[0]?.name
      : latest?.membership_plans?.name

    res.json({
      success: true,
      data: {
        ...member,
        current_membership: latest
          ? {
              id: latest.id,
              plan_name: planName ?? 'Unknown Plan',
              start_date: latest.start_date,
              expiry_date: latest.expiry_date,
              actual_fee: Number(latest.actual_fee),
              payment_due_date: latest.payment_due_date,
              status: latest.status,
            }
          : null,
      },
    })
  } catch (err) {
    console.error('[membersController] getMember error', err)
    res.status(500).json({ success: false, message: 'Failed to load member.' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/members
 *
 * Creates a new member.
 *
 * - member_code is generated server-side; the client never supplies it.
 * - Input is validated before any DB operation.
 * - On 23505 (unique constraint on member_code): retries with freshly calculated
 *   code up to 3 times, returning 409 only if collisions persist.
 */
export async function createMember(req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseAdmin()
  const body = req.body as Record<string, unknown>

  const fullName = String(body.full_name ?? '').trim()
  const phone = String(body.phone ?? '').trim()
  const joiningDate = String(body.joining_date ?? '').trim()

  const errors: string[] = []
  if (!fullName) errors.push('Full name is required.')
  if (!phone) errors.push('Phone number is required.')
  if (!joiningDate) {
    errors.push('Joining date is required.')
  } else if (!validateDate(joiningDate)) {
    errors.push('Joining date must be a valid date (YYYY-MM-DD).')
  }

  const email = body.email ? String(body.email).trim() || null : null
  if (email && !validateEmail(email)) errors.push('Email address is not valid.')

  const dob = body.date_of_birth ? String(body.date_of_birth).trim() || null : null
  if (dob && !validateDate(dob)) errors.push('Date of birth must be a valid date (YYYY-MM-DD).')

  if (errors.length > 0) {
    res.status(400).json({ success: false, message: errors.join(' ') })
    return
  }

  try {
    let newMember = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const member_code = await generateNextMemberCode(supabase)

      const { data, error } = await supabase
        .from('members')
        .insert({
          member_code,
          full_name: fullName,
          phone,
          email,
          address: body.address ? String(body.address).trim() || null : null,
          date_of_birth: dob,
          joining_date: joiningDate,
          notes: body.notes ? String(body.notes).trim() || null : null,
          status: 'active',
        })
        .select()
        .single()

      if (error) {
        if ((error as { code?: string }).code === '23505' && attempt < 2) {
          continue
        }
        if ((error as { code?: string }).code === '23505') {
          res.status(409).json({
            success: false,
            message: 'A member with this member code already exists. Please try again.',
          })
          return
        }
        throw error
      }

      newMember = data
      break
    }

    if (newMember) {
      await logAuditEvent({
        actorId: req.authUser?.id,
        entityType: 'member',
        entityId: newMember.id,
        action: 'member_created',
        newData: {
          member_code: newMember.member_code,
          full_name: newMember.full_name,
          phone: newMember.phone,
          status: newMember.status,
        },
      })
    }

    res.status(201).json({ success: true, data: newMember })
  } catch (err) {
    console.error('[membersController] createMember error', err)
    res.status(500).json({ success: false, message: 'Failed to create member.' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /api/members/:id
 *
 * Updates allowed personal fields on a member record.
 *
 * Fields that must never be updated here:
 *   - member_code  (system-controlled, immutable after creation)
 *   - id           (PK)
 *   - created_at   (audit timestamp)
 *
 * updated_at is handled automatically by the database trigger.
 */
export async function updateMember(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const supabase = getSupabaseAdmin()
  const body = req.body as Record<string, unknown>

  // Whitelist of editable fields
  const EDITABLE = [
    'full_name', 'phone', 'email', 'address',
    'date_of_birth', 'joining_date', 'notes', 'status',
  ] as const

  const updates: Record<string, unknown> = {}
  for (const field of EDITABLE) {
    if (field in body) {
      const v = body[field]
      // Normalise empty strings to null for nullable fields
      updates[field] =
        typeof v === 'string' && v.trim() === '' && field !== 'full_name' && field !== 'phone' && field !== 'joining_date'
          ? null
          : v
    }
  }

  // Validate provided fields
  if ('full_name' in updates) {
    const v = String(updates.full_name ?? '').trim()
    if (!v) { res.status(400).json({ success: false, message: 'Full name cannot be empty.' }); return }
    updates.full_name = v
  }
  if ('phone' in updates) {
    const v = String(updates.phone ?? '').trim()
    if (!v) { res.status(400).json({ success: false, message: 'Phone number cannot be empty.' }); return }
    updates.phone = v
  }
  if ('joining_date' in updates) {
    const v = String(updates.joining_date ?? '').trim()
    if (!validateDate(v)) { res.status(400).json({ success: false, message: 'Joining date must be a valid date (YYYY-MM-DD).' }); return }
    updates.joining_date = v
  }
  if ('email' in updates && updates.email) {
    const v = String(updates.email).trim()
    if (!validateEmail(v)) { res.status(400).json({ success: false, message: 'Email address is not valid.' }); return }
    updates.email = v
  }
  if ('date_of_birth' in updates && updates.date_of_birth) {
    const v = String(updates.date_of_birth).trim()
    if (!validateDate(v)) { res.status(400).json({ success: false, message: 'Date of birth must be a valid date (YYYY-MM-DD).' }); return }
    updates.date_of_birth = v
  }
  if ('status' in updates) {
    if (!['active', 'inactive'].includes(String(updates.status))) {
      res.status(400).json({ success: false, message: 'Status must be active or inactive.' })
      return
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ success: false, message: 'No valid fields to update.' })
    return
  }

  try {
    const { data: updated, error } = await supabase
      .from('members')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error?.code === 'PGRST116' || !updated) {
      res.status(404).json({ success: false, message: 'Member not found.' })
      return
    }
    if (error) throw error

    await logAuditEvent({
      actorId: req.authUser?.id,
      entityType: 'member',
      entityId: id,
      action: 'member_updated',
      newData: updates,
    })

    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[membersController] updateMember error', err)
    res.status(500).json({ success: false, message: 'Failed to update member.' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /api/members/:id/archive
 *
 * Sets a member's status to 'inactive'.
 * Owner-only — enforced by requireRole('owner') in the router.
 *
 * This is a soft archive, not a destructive delete. The member record and all
 * associated historical data (memberships, payments) are preserved per
 * REQUIREMENTS.md §3 and AGENTS.md security rules.
 *
 * Hard delete of member records is possible only via the DB directly (owner
 * privilege in RLS), and should be exceptional. It is not exposed as an API
 * endpoint in Part 5.
 */
export async function archiveMember(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const supabase = getSupabaseAdmin()

  try {
    const { data: updated, error } = await supabase
      .from('members')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select()
      .single()

    if (error?.code === 'PGRST116' || !updated) {
      res.status(404).json({ success: false, message: 'Member not found.' })
      return
    }
    if (error) throw error

    await logAuditEvent({
      actorId: req.authUser?.id,
      entityType: 'member',
      entityId: id,
      action: 'member_archived',
      newData: { status: 'inactive' },
    })

    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[membersController] archiveMember error', err)
    res.status(500).json({ success: false, message: 'Failed to archive member.' })
  }
}
