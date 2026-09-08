import type { Request, Response } from 'express'
import { getSupabaseAdmin } from '../services/database/supabaseAdmin.js'
import { logAuditEvent } from '../services/audit/auditService.js'
import type { ProfileRow, TrainerDetail } from '../types/auth.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * GET /api/trainers
 * List all trainers with optional search, status filter, and KPI summary.
 * Read-only permission: 'trainer:list' (accessible to Owner and Trainer).
 */
export async function listTrainers(req: Request, res: Response): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()
    const { search, status } = req.query

    // 1. Fetch all profiles where role = 'trainer'
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'trainer')
      .order('created_at', { ascending: false })

    if (profileError) {
      res.status(500).json({ success: false, message: profileError.message })
      return
    }

    const allProfiles = (profiles || []) as ProfileRow[]

    // 2. Fetch auth users to map last_sign_in_at and user_metadata notes
    let authUserMap: Record<string, { last_sign_in_at: string | null; notes: string | null }> = {}
    try {
      const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      if (authData?.users) {
        for (const u of authData.users) {
          authUserMap[u.id] = {
            last_sign_in_at: u.last_sign_in_at ?? null,
            notes: (u.user_metadata?.notes as string) ?? null,
          }
        }
      }
    } catch (authErr) {
      console.warn('[trainersController] Unable to fetch auth users map:', authErr)
    }

    // 3. Compute KPI summary stats across all trainers in database
    const total_trainers = allProfiles.length
    const active_trainers = allProfiles.filter((p) => p.is_active).length
    const inactive_trainers = total_trainers - active_trainers

    // 4. Map profiles into TrainerDetail objects
    let list: TrainerDetail[] = allProfiles.map((p) => {
      const authInfo = authUserMap[p.id]
      return {
        ...p,
        notes: p.notes ?? authInfo?.notes ?? null,
        last_sign_in_at: authInfo?.last_sign_in_at ?? null,
      }
    })

    // 5. Apply status filter
    if (status === 'active') {
      list = list.filter((t) => t.is_active)
    } else if (status === 'inactive') {
      list = list.filter((t) => !t.is_active)
    }

    // 6. Apply search filter
    if (typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (t) =>
          t.full_name.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          (t.phone && t.phone.toLowerCase().includes(q)),
      )
    }

    res.json({
      success: true,
      data: list,
      summary: {
        total_trainers,
        active_trainers,
        inactive_trainers,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Internal server error.' })
  }
}

/**
 * GET /api/trainers/:id
 * Retrieve a single trainer profile.
 */
export async function getTrainer(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const supabase = getSupabaseAdmin()

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .eq('role', 'trainer')
      .single<ProfileRow>()

    if (error || !profile) {
      res.status(404).json({ success: false, message: 'Trainer not found.' })
      return
    }

    let last_sign_in_at: string | null = null
    let metadataNotes: string | null = null
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(id)
      if (authUser?.user) {
        last_sign_in_at = authUser.user.last_sign_in_at ?? null
        metadataNotes = (authUser.user.user_metadata?.notes as string) ?? null
      }
    } catch {
      // ignore
    }

    const trainer: TrainerDetail = {
      ...profile,
      notes: profile.notes ?? metadataNotes,
      last_sign_in_at,
    }

    res.json({ success: true, data: trainer })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Internal server error.' })
  }
}

/**
 * POST /api/trainers
 * Create a new trainer account in Supabase Auth + public.profiles.
 * Owner-only permission: 'trainer:create'.
 */
export async function createTrainer(req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseAdmin()
  let createdAuthUserId: string | null = null

  try {
    const { full_name, email, password, phone, notes } = req.body

    // 1. Validation
    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      res.status(400).json({ success: false, message: 'Full name is required.' })
      return
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      res.status(400).json({ success: false, message: 'A valid email address is required.' })
      return
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      })
      return
    }

    const cleanName = full_name.trim()
    const cleanEmail = email.trim().toLowerCase()
    const cleanPhone = phone && typeof phone === 'string' && phone.trim() ? phone.trim() : null
    const cleanNotes = notes && typeof notes === 'string' && notes.trim() ? notes.trim() : null

    // 2. Check for duplicate email in profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (existingProfile) {
      res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      })
      return
    }

    // 3. Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        phone: cleanPhone,
        notes: cleanNotes,
        role: 'trainer',
      },
    })

    if (authError || !authData.user) {
      const msg = authError?.message || 'Failed to create auth user.'
      const isConflict = msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')
      res.status(isConflict ? 409 : 400).json({ success: false, message: msg })
      return
    }

    createdAuthUserId = authData.user.id

    // 4. Create profile in public.profiles (role is strictly 'trainer')
    const profilePayload: Record<string, unknown> = {
      id: createdAuthUserId,
      full_name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      role: 'trainer', // Enforced server-side
      is_active: true,
    }
    if (cleanNotes) {
      profilePayload.notes = cleanNotes
    }

    let { data: newProfile, error: profileInsertError } = await supabase
      .from('profiles')
      .insert(profilePayload)
      .select('*')
      .single<ProfileRow>()

    // If insert failed due to notes column missing, retry without notes column
    if (profileInsertError && profileInsertError.message?.includes('notes')) {
      delete profilePayload.notes
      const retryResult = await supabase
        .from('profiles')
        .insert(profilePayload)
        .select('*')
        .single<ProfileRow>()
      newProfile = retryResult.data
      profileInsertError = retryResult.error
    }

    if (profileInsertError || !newProfile) {
      // Rollback auth user creation if profile creation fails
      console.error('[trainersController] Profile creation failed, rolling back auth user:', profileInsertError)
      await supabase.auth.admin.deleteUser(createdAuthUserId)
      res.status(500).json({
        success: false,
        message: 'Failed to create trainer profile. Rolled back auth account.',
      })
      return
    }

    // 5. Audit logging
    await logAuditEvent({
      actorId: req.authUser?.id,
      entityType: 'trainer',
      entityId: newProfile.id,
      action: 'trainer_created',
      newData: {
        id: newProfile.id,
        full_name: newProfile.full_name,
        email: newProfile.email,
        phone: newProfile.phone,
        role: newProfile.role,
        is_active: newProfile.is_active,
        notes: cleanNotes,
      },
    })

    // 6. Return response (no passwords/secrets)
    const result: TrainerDetail = {
      ...newProfile,
      notes: newProfile.notes ?? cleanNotes,
      last_sign_in_at: null,
    }

    res.status(201).json({
      success: true,
      message: 'Trainer account created successfully.',
      data: result,
    })
  } catch (err: any) {
    if (createdAuthUserId) {
      try {
        await supabase.auth.admin.deleteUser(createdAuthUserId)
      } catch {
        // ignore rollback error
      }
    }
    res.status(500).json({ success: false, message: err.message || 'Internal server error.' })
  }
}

/**
 * PATCH /api/trainers/:id
 * Update trainer profile details (name, phone, notes).
 * Role changes are strictly forbidden.
 */
export async function updateTrainer(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const { full_name, phone, notes } = req.body
    const supabase = getSupabaseAdmin()

    // 1. Fetch existing trainer
    const { data: existing, error: findError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single<ProfileRow>()

    if (findError || !existing) {
      res.status(404).json({ success: false, message: 'Trainer not found.' })
      return
    }

    if (existing.role !== 'trainer') {
      res.status(400).json({
        success: false,
        message: 'Cannot modify owner account via trainer management.',
      })
      return
    }

    // 2. Validate input
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (full_name !== undefined) {
      if (typeof full_name !== 'string' || !full_name.trim()) {
        res.status(400).json({ success: false, message: 'Full name cannot be empty.' })
        return
      }
      updates.full_name = full_name.trim()
    }

    if (phone !== undefined) {
      updates.phone = typeof phone === 'string' && phone.trim() ? phone.trim() : null
    }

    if (notes !== undefined) {
      updates.notes = typeof notes === 'string' && notes.trim() ? notes.trim() : null
    }

    // 3. Update profiles table
    let { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single<ProfileRow>()

    if (updateError && updateError.message?.includes('notes')) {
      delete updates.notes
      const retryResult = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single<ProfileRow>()
      updated = retryResult.data
      updateError = retryResult.error
    }

    if (updateError || !updated) {
      res.status(500).json({ success: false, message: updateError?.message || 'Update failed.' })
      return
    }

    // 4. Update auth user metadata for consistency
    const metaUpdates: Record<string, unknown> = {}
    if (updates.full_name) metaUpdates.full_name = updates.full_name
    if (phone !== undefined) metaUpdates.phone = updates.phone
    if (notes !== undefined) metaUpdates.notes = notes ? String(notes).trim() : null

    try {
      await supabase.auth.admin.updateUserById(id, {
        user_metadata: metaUpdates,
      })
    } catch {
      // non-fatal
    }

    // 5. Audit log
    await logAuditEvent({
      actorId: req.authUser?.id,
      entityType: 'trainer',
      entityId: id,
      action: 'trainer_updated',
      previousData: {
        full_name: existing.full_name,
        phone: existing.phone,
        notes: existing.notes,
      },
      newData: {
        full_name: updated.full_name,
        phone: updated.phone,
        notes: notes !== undefined ? notes : existing.notes,
      },
    })

    const finalResult: TrainerDetail = {
      ...updated,
      notes: (notes !== undefined ? notes : updated.notes) ?? null,
    }

    res.json({
      success: true,
      message: 'Trainer profile updated successfully.',
      data: finalResult,
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Internal server error.' })
  }
}

/**
 * PATCH /api/trainers/:id/activate
 * Reactivate a deactivated trainer account.
 */
export async function activateTrainer(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const supabase = getSupabaseAdmin()

    const { data: existing, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single<ProfileRow>()

    if (error || !existing) {
      res.status(404).json({ success: false, message: 'Trainer not found.' })
      return
    }

    if (existing.role !== 'trainer') {
      res.status(400).json({ success: false, message: 'Cannot modify non-trainer accounts.' })
      return
    }

    // 1. Update profiles table
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single<ProfileRow>()

    if (updateError || !updated) {
      res.status(500).json({ success: false, message: updateError?.message || 'Failed to activate.' })
      return
    }

    // 2. Unban user in Supabase Auth
    try {
      await supabase.auth.admin.updateUserById(id, {
        ban_duration: 'none',
      })
    } catch (authErr: any) {
      console.warn('[trainersController] Failed to clear ban_duration:', authErr.message)
    }

    // 3. Audit log
    await logAuditEvent({
      actorId: req.authUser?.id,
      entityType: 'trainer',
      entityId: id,
      action: 'trainer_activated',
      previousData: { is_active: false },
      newData: { is_active: true },
    })

    res.json({
      success: true,
      message: 'Trainer activated successfully.',
      data: updated,
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Internal server error.' })
  }
}

/**
 * PATCH /api/trainers/:id/deactivate
 * Deactivate a trainer account and immediately revoke access.
 */
export async function deactivateTrainer(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const supabase = getSupabaseAdmin()

    if (req.authUser?.id === id) {
      res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account.',
      })
      return
    }

    const { data: existing, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single<ProfileRow>()

    if (error || !existing) {
      res.status(404).json({ success: false, message: 'Trainer not found.' })
      return
    }

    if (existing.role !== 'trainer') {
      res.status(400).json({
        success: false,
        message: 'Cannot deactivate owner account.',
      })
      return
    }

    // 1. Update profiles table
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single<ProfileRow>()

    if (updateError || !updated) {
      res.status(500).json({ success: false, message: updateError?.message || 'Failed to deactivate.' })
      return
    }

    // 2. Ban in Supabase Auth (876000 hours = 100 years)
    try {
      await supabase.auth.admin.updateUserById(id, {
        ban_duration: '876000h',
      })
    } catch (authErr: any) {
      console.warn('[trainersController] Failed to set ban_duration:', authErr.message)
    }

    // 3. Audit log
    await logAuditEvent({
      actorId: req.authUser?.id,
      entityType: 'trainer',
      entityId: id,
      action: 'trainer_deactivated',
      previousData: { is_active: true },
      newData: { is_active: false },
    })

    res.json({
      success: true,
      message: 'Trainer deactivated successfully.',
      data: updated,
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Internal server error.' })
  }
}

/**
 * POST /api/trainers/:id/reset-password
 * Reset a trainer's password.
 * Owner-only operation.
 */
export async function resetTrainerPassword(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const { password } = req.body
    const supabase = getSupabaseAdmin()

    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      })
      return
    }

    const { data: existing, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single<ProfileRow>()

    if (error || !existing) {
      res.status(404).json({ success: false, message: 'Trainer not found.' })
      return
    }

    if (existing.role !== 'trainer') {
      res.status(400).json({
        success: false,
        message: 'Cannot reset owner password through trainer management.',
      })
      return
    }

    // Update password in Supabase Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(id, {
      password,
    })

    if (authError) {
      res.status(400).json({ success: false, message: authError.message })
      return
    }

    // Audit log without password
    await logAuditEvent({
      actorId: req.authUser?.id,
      entityType: 'trainer',
      entityId: id,
      action: 'trainer_password_reset',
      newData: {
        reset_by: req.authUser?.id,
      },
    })

    res.json({
      success: true,
      message: 'Password reset successfully.',
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Internal server error.' })
  }
}
