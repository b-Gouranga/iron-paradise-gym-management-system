import type { Request, Response } from 'express'
import { getSupabaseAdmin } from '../services/database/supabaseAdmin.js'
import type { DurationUnit, MembershipPlanFilter } from '../types/membershipPlans.js'

const VALID_DURATION_UNITS: DurationUnit[] = ['days', 'months', 'years']

// ── Validation helpers ────────────────────────────────────────────────────────

function validateDurationUnit(v: unknown): v is DurationUnit {
  return typeof v === 'string' && VALID_DURATION_UNITS.includes(v as DurationUnit)
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/membership-plans
 *
 * Supports optional `filter`: 'all' | 'active' | 'inactive' (default: 'all').
 * Returns plans sorted predictably: active plans first, then sorted by creation date.
 */
export async function listMembershipPlans(req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { filter = 'all' } = req.query as Record<string, string>

  const safeFilter: MembershipPlanFilter =
    filter === 'active' || filter === 'inactive' ? filter : 'all'

  try {
    let query = supabase.from('membership_plans').select('*')

    if (safeFilter === 'active') {
      query = query.eq('is_active', true)
    } else if (safeFilter === 'inactive') {
      query = query.eq('is_active', false)
    }

    // Predictable ordering: active plans first, then chronological
    query = query
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: true })

    const { data: plans, error } = await query
    if (error) throw error

    res.json({
      success: true,
      data: plans ?? [],
    })
  } catch (err) {
    console.error('[membershipPlansController] listMembershipPlans error', err)
    res.status(500).json({ success: false, message: 'Failed to load membership plans.' })
  }
}

/**
 * GET /api/membership-plans/:id
 *
 * Returns a single membership plan by ID.
 */
export async function getMembershipPlan(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const supabase = getSupabaseAdmin()

  try {
    const { data: plan, error } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('id', id)
      .single()

    if (error?.code === 'PGRST116' || !plan) {
      res.status(404).json({ success: false, message: 'Membership plan not found.' })
      return
    }
    if (error) throw error

    res.json({ success: true, data: plan })
  } catch (err) {
    console.error('[membershipPlansController] getMembershipPlan error', err)
    res.status(500).json({ success: false, message: 'Failed to load membership plan.' })
  }
}

/**
 * POST /api/membership-plans
 *
 * Creates a new membership plan template.
 * Available to authenticated staff (Owner & Trainer).
 *
 * Server-side validation:
 * - name: required, non-empty, max 100 characters
 * - duration_value: required positive integer
 * - duration_unit: must be 'days', 'months', or 'years'
 * - default_fee: non-negative finite number
 * - description: optional, max 500 characters
 */
export async function createMembershipPlan(req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseAdmin()
  const body = req.body as Record<string, unknown>

  const name = String(body.name ?? '').trim()
  const durationValue = Number(body.duration_value)
  const durationUnit = body.duration_unit
  const defaultFee = Number(body.default_fee)
  const description = body.description ? String(body.description).trim() || null : null

  const errors: string[] = []

  if (!name) {
    errors.push('Plan name is required.')
  } else if (name.length > 100) {
    errors.push('Plan name cannot exceed 100 characters.')
  }

  if (!Number.isInteger(durationValue) || durationValue <= 0) {
    errors.push('Duration value must be a positive integer.')
  }

  if (!validateDurationUnit(durationUnit)) {
    errors.push('Duration unit must be one of: days, months, years.')
  }

  if (isNaN(defaultFee) || !isFinite(defaultFee) || defaultFee < 0) {
    errors.push('Default fee must be a valid non-negative number.')
  }

  if (description && description.length > 500) {
    errors.push('Description cannot exceed 500 characters.')
  }

  if (errors.length > 0) {
    res.status(400).json({ success: false, message: errors.join(' ') })
    return
  }

  try {
    const { data: newPlan, error } = await supabase
      .from('membership_plans')
      .insert({
        name,
        duration_value: durationValue,
        duration_unit: durationUnit,
        default_fee: Math.round(defaultFee * 100) / 100,
        description,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        res.status(409).json({
          success: false,
          message: 'A membership plan with this name already exists.',
        })
        return
      }
      throw error
    }

    res.status(201).json({ success: true, data: newPlan })
  } catch (err) {
    console.error('[membershipPlansController] createMembershipPlan error', err)
    res.status(500).json({ success: false, message: 'Failed to create membership plan.' })
  }
}

/**
 * PATCH /api/membership-plans/:id
 *
 * Updates editable template fields of a membership plan.
 * Available to authenticated staff (Owner & Trainer).
 *
 * CRITICAL HISTORICAL-FEE SAFETY RULE:
 * Modifying default_fee only changes this plan template for future memberships.
 * Existing memberships store actual_fee independently in the `memberships` table
 * and are NEVER altered by this operation.
 */
export async function updateMembershipPlan(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const supabase = getSupabaseAdmin()
  const body = req.body as Record<string, unknown>

  const updates: Record<string, unknown> = {}

  if ('name' in body) {
    const name = String(body.name ?? '').trim()
    if (!name) {
      res.status(400).json({ success: false, message: 'Plan name cannot be empty.' })
      return
    }
    if (name.length > 100) {
      res.status(400).json({ success: false, message: 'Plan name cannot exceed 100 characters.' })
      return
    }
    updates.name = name
  }

  if ('duration_value' in body) {
    const val = Number(body.duration_value)
    if (!Number.isInteger(val) || val <= 0) {
      res.status(400).json({ success: false, message: 'Duration value must be a positive integer.' })
      return
    }
    updates.duration_value = val
  }

  if ('duration_unit' in body) {
    if (!validateDurationUnit(body.duration_unit)) {
      res.status(400).json({ success: false, message: 'Duration unit must be days, months, or years.' })
      return
    }
    updates.duration_unit = body.duration_unit
  }

  if ('default_fee' in body) {
    const fee = Number(body.default_fee)
    if (isNaN(fee) || !isFinite(fee) || fee < 0) {
      res.status(400).json({ success: false, message: 'Default fee must be a non-negative number.' })
      return
    }
    updates.default_fee = Math.round(fee * 100) / 100
  }

  if ('description' in body) {
    const desc = body.description ? String(body.description).trim() || null : null
    if (desc && desc.length > 500) {
      res.status(400).json({ success: false, message: 'Description cannot exceed 500 characters.' })
      return
    }
    updates.description = desc
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ success: false, message: 'No valid fields provided for update.' })
    return
  }

  try {
    const { data: updated, error } = await supabase
      .from('membership_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error?.code === 'PGRST116' || !updated) {
      res.status(404).json({ success: false, message: 'Membership plan not found.' })
      return
    }

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        res.status(409).json({
          success: false,
          message: 'A membership plan with this name already exists.',
        })
        return
      }
      throw error
    }

    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[membershipPlansController] updateMembershipPlan error', err)
    res.status(500).json({ success: false, message: 'Failed to update membership plan.' })
  }
}

/**
 * PATCH /api/membership-plans/:id/archive
 *
 * Sets `is_active = false` on a membership plan.
 * OWNER ONLY — enforced by requireRole('owner') in the router.
 *
 * Non-destructive: preserves existing plan record and historical references.
 */
export async function archiveMembershipPlan(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const supabase = getSupabaseAdmin()

  try {
    const { data: updated, error } = await supabase
      .from('membership_plans')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single()

    if (error?.code === 'PGRST116' || !updated) {
      res.status(404).json({ success: false, message: 'Membership plan not found.' })
      return
    }
    if (error) throw error

    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[membershipPlansController] archiveMembershipPlan error', err)
    res.status(500).json({ success: false, message: 'Failed to deactivate membership plan.' })
  }
}

/**
 * PATCH /api/membership-plans/:id/reactivate
 *
 * Sets `is_active = true` on a membership plan.
 * OWNER ONLY — enforced by requireRole('owner') in the router.
 */
export async function reactivateMembershipPlan(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const supabase = getSupabaseAdmin()

  try {
    const { data: updated, error } = await supabase
      .from('membership_plans')
      .update({ is_active: true })
      .eq('id', id)
      .select()
      .single()

    if (error?.code === 'PGRST116' || !updated) {
      res.status(404).json({ success: false, message: 'Membership plan not found.' })
      return
    }
    if (error) throw error

    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[membershipPlansController] reactivateMembershipPlan error', err)
    res.status(500).json({ success: false, message: 'Failed to reactivate membership plan.' })
  }
}
