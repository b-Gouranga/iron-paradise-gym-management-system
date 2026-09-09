import type { Request, Response } from 'express'
import { getSupabaseAdmin } from '../services/database/supabaseAdmin.js'
import { logAuditEvent } from '../services/audit/auditService.js'

// ---------------------------------------------------------------------------
// POST /api/auth/setup-owner
// ---------------------------------------------------------------------------

/**
 * Creates the first (and only) owner account for Iron Paradise.
 *
 * Security properties:
 * - The `role` field is NEVER read from the request body. The server always
 *   sets it to 'owner' unconditionally, and only after verifying no owner
 *   exists yet.
 * - An application-level owner-count check is performed as an early-exit
 *   optimisation. It is NOT the final concurrency guarantee — it has a
 *   TOCTOU window between the count query and the INSERT.
 * - The database-level guarantee is the UNIQUE PARTIAL INDEX
 *   `profiles_single_owner_idx` (created in migration 002). If two concurrent
 *   requests both pass the count check, exactly one INSERT will succeed; the
 *   other will receive PostgreSQL error code 23505 (unique violation).
 * - If the profile INSERT fails (including a 23505 race loss), the
 *   newly-created Supabase Auth user is deleted to avoid orphaned accounts.
 * - Returns 409 Conflict both when the count check detects an existing owner
 *   and when the unique-index constraint is the deciding factor.
 */
export async function setupOwner(req: Request, res: Response): Promise<void> {
  const { fullName, email, password, phone } = req.body as {
    fullName?: unknown
    email?: unknown
    password?: unknown
    phone?: unknown
  }

  // ── Input validation ─────────────────────────────────────────────────────
  if (typeof fullName !== 'string' || fullName.trim().length === 0) {
    res.status(400).json({ success: false, message: 'fullName is required.' })
    return
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ success: false, message: 'A valid email address is required.' })
    return
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' })
    return
  }
  if (phone !== undefined && typeof phone !== 'string') {
    res.status(400).json({ success: false, message: 'phone must be a string if provided.' })
    return
  }

  const supabase = getSupabaseAdmin()

  // ── Check: no owner must already exist ──────────────────────────────────
  const { count, error: countError } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'owner')

  if (countError) {
    console.error('[setupOwner] owner count check failed', countError)
    res.status(500).json({ success: false, message: 'Server error. Please try again.' })
    return
  }

  if (count !== null && count > 0) {
    res.status(409).json({
      success: false,
      message: 'An owner account already exists. Only one owner can be created.',
    })
    return
  }

  // ── Create the Supabase Auth user ────────────────────────────────────────
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,   // Skip email confirmation for initial setup
    })

  if (authError || !authData.user) {
    console.error('[setupOwner] auth user creation failed', authError)
    const isEmailTaken =
      authError?.message?.toLowerCase().includes('already registered') ||
      authError?.message?.toLowerCase().includes('already been registered')
    res.status(isEmailTaken ? 409 : 500).json({
      success: false,
      message: isEmailTaken
        ? 'An account with this email already exists.'
        : 'Failed to create account. Please try again.',
    })
    return
  }

  const newUserId = authData.user.id

  // ── Insert the profile with role = 'owner' ───────────────────────────────
  // The role is set server-side here; it is never read from req.body.
  const { error: profileError } = await supabase.from('profiles').insert({
    id: newUserId,
    full_name: fullName.trim(),
    email: email.trim().toLowerCase(),
    phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
    role: 'owner',   // Always set server-side
    is_active: true,
  })

  if (profileError) {
    // Always roll back: delete the orphaned auth user regardless of failure type.
    // This prevents a dangling Supabase Auth account with no corresponding profile.
    await supabase.auth.admin.deleteUser(newUserId)

    // PostgreSQL unique-constraint violation (code 23505) means another concurrent
    // request won the race and already inserted an owner profile. The unique partial
    // index `profiles_single_owner_idx` is the actual concurrency guarantee here.
    // Return 409 — do NOT expose the raw PostgreSQL error details to the client.
    const isUniqueViolation =
      (profileError as { code?: string }).code === '23505' ||
      profileError.message?.toLowerCase().includes('duplicate key') ||
      profileError.message?.toLowerCase().includes('profiles_single_owner_idx')

    if (isUniqueViolation) {
      console.info('[setupOwner] unique-index race: concurrent request already created owner')
      res.status(409).json({
        success: false,
        message: 'An owner account already exists. Only one owner can be created.',
      })
      return
    }

    // Any other profile insert failure (foreign key mismatch, network error, etc.)
    console.error('[setupOwner] profile insert failed', profileError)
    res.status(500).json({
      success: false,
      message: 'Failed to create profile. Please try again.',
    })
    return
  }

  await logAuditEvent({
    actorId: newUserId,
    entityType: 'profile',
    entityId: newUserId,
    action: 'owner_setup',
    newData: {
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      role: 'owner',
    },
  })

  res.status(201).json({
    success: true,
    message: 'Owner account created successfully.',
  })
}
