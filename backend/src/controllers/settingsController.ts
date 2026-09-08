import type { Request, Response } from 'express'
import { getSupabaseAdmin } from '../services/database/supabaseAdmin.js'
import { logAuditEvent } from '../services/audit/auditService.js'
import { env } from '../config/env.js'
import type { GymSettings, UpdateGymSettingsInput, UpdateProfileInput } from '../types/settings.js'
import type { ProfileRow } from '../types/auth.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Fallback in-memory settings in case migration 004 has not yet been applied to the remote DB
let fallbackGymSettings: GymSettings = {
  id: '00000000-0000-0000-0000-000000000001',
  gym_name: 'Iron Paradise Gym',
  contact_phone: '+91 98765 43210',
  contact_email: 'contact@ironparadisegym.com',
  address: 'Main Road, Guwahati, Assam',
  currency_symbol: '₹',
  currency_code: 'INR',
  member_id_prefix: 'IP-',
  payment_due_grace_days: 7,
  reminder_advance_days: 7,
  updated_at: new Date().toISOString(),
}

/**
 * GET /api/settings/gym
 * Retrieve the current gym business profile and operational defaults.
 * Accessible to all authenticated staff (Owner and Trainer).
 */
export async function getGymSettings(req: Request, res: Response): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('gym_settings')
      .select('*')
      .limit(1)
      .maybeSingle<GymSettings>()

    if (error) {
      // If table does not exist yet (PGRST205), return fallback default
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        res.json({ success: true, data: fallbackGymSettings })
        return
      }
      res.status(500).json({ success: false, message: error.message })
      return
    }

    if (!data) {
      // Table exists but no row seeded: seed the default row
      const { data: inserted, error: insertError } = await supabase
        .from('gym_settings')
        .insert({
          gym_name: fallbackGymSettings.gym_name,
          contact_phone: fallbackGymSettings.contact_phone,
          contact_email: fallbackGymSettings.contact_email,
          address: fallbackGymSettings.address,
          currency_symbol: fallbackGymSettings.currency_symbol,
          currency_code: fallbackGymSettings.currency_code,
          member_id_prefix: fallbackGymSettings.member_id_prefix,
          payment_due_grace_days: fallbackGymSettings.payment_due_grace_days,
          reminder_advance_days: fallbackGymSettings.reminder_advance_days,
        })
        .select('*')
        .single<GymSettings>()

      if (insertError) {
        res.json({ success: true, data: fallbackGymSettings })
        return
      }

      res.json({ success: true, data: inserted })
      return
    }

    // Keep fallback in sync with DB
    fallbackGymSettings = data
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Internal server error.' })
  }
}

/**
 * PATCH /api/settings/gym
 * Update the gym business profile and operational defaults.
 * Strictly restricted to Owners (HTTP 403 for Trainers).
 */
export async function updateGymSettings(req: Request, res: Response): Promise<void> {
  try {
    const role = req.authProfile?.role
    if (role !== 'owner') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Only the gym owner can modify gym settings.',
      })
      return
    }

    const body = req.body as UpdateGymSettingsInput
    const supabase = getSupabaseAdmin()

    // 1. Validate inputs
    const updates: Partial<GymSettings> = {
      updated_at: new Date().toISOString(),
    }

    if (body.gym_name !== undefined) {
      if (typeof body.gym_name !== 'string' || !body.gym_name.trim()) {
        res.status(400).json({ success: false, message: 'Gym name cannot be empty.' })
        return
      }
      if (body.gym_name.trim().length > 100) {
        res.status(400).json({ success: false, message: 'Gym name cannot exceed 100 characters.' })
        return
      }
      updates.gym_name = body.gym_name.trim()
    }

    if (body.contact_phone !== undefined) {
      updates.contact_phone =
        typeof body.contact_phone === 'string' && body.contact_phone.trim()
          ? body.contact_phone.trim()
          : null
    }

    if (body.contact_email !== undefined) {
      if (body.contact_email && typeof body.contact_email === 'string') {
        const trimmed = body.contact_email.trim()
        if (!EMAIL_REGEX.test(trimmed)) {
          res.status(400).json({ success: false, message: 'Invalid contact email format.' })
          return
        }
        updates.contact_email = trimmed.toLowerCase()
      } else {
        updates.contact_email = null
      }
    }

    if (body.address !== undefined) {
      updates.address =
        typeof body.address === 'string' && body.address.trim()
          ? body.address.trim()
          : null
    }

    if (body.currency_symbol !== undefined) {
      if (typeof body.currency_symbol !== 'string' || !body.currency_symbol.trim()) {
        res.status(400).json({ success: false, message: 'Currency symbol cannot be empty.' })
        return
      }
      updates.currency_symbol = body.currency_symbol.trim()
    }

    if (body.currency_code !== undefined) {
      if (typeof body.currency_code !== 'string' || !body.currency_code.trim()) {
        res.status(400).json({ success: false, message: 'Currency code cannot be empty.' })
        return
      }
      updates.currency_code = body.currency_code.trim().toUpperCase()
    }

    if (body.member_id_prefix !== undefined) {
      if (typeof body.member_id_prefix !== 'string' || !body.member_id_prefix.trim()) {
        res.status(400).json({ success: false, message: 'Member ID prefix cannot be empty.' })
        return
      }
      const prefix = body.member_id_prefix.trim().toUpperCase()
      if (!/^[A-Z0-9_-]+$/.test(prefix)) {
        res.status(400).json({
          success: false,
          message: 'Member ID prefix must contain only uppercase letters, numbers, and dashes.',
        })
        return
      }
      updates.member_id_prefix = prefix
    }

    if (body.payment_due_grace_days !== undefined) {
      const graceDays = Number(body.payment_due_grace_days)
      if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 365) {
        res.status(400).json({
          success: false,
          message: 'Payment due grace days must be an integer between 0 and 365.',
        })
        return
      }
      updates.payment_due_grace_days = graceDays
    }

    if (body.reminder_advance_days !== undefined) {
      const advanceDays = Number(body.reminder_advance_days)
      if (!Number.isInteger(advanceDays) || advanceDays < 1 || advanceDays > 30) {
        res.status(400).json({
          success: false,
          message: 'Reminder advance days must be an integer between 1 and 30.',
        })
        return
      }
      updates.reminder_advance_days = advanceDays
    }

    // 2. Fetch existing settings for diff
    let existingSettings = fallbackGymSettings
    const { data: existingData, error: fetchErr } = await supabase
      .from('gym_settings')
      .select('*')
      .limit(1)
      .maybeSingle<GymSettings>()

    if (!fetchErr && existingData) {
      existingSettings = existingData
    }

    // 3. Update database or fallback
    let updatedResult: GymSettings = {
      ...existingSettings,
      ...updates,
    }

    if (!fetchErr && existingData) {
      const { data: updatedDb, error: updateErr } = await supabase
        .from('gym_settings')
        .update(updates)
        .eq('id', existingData.id)
        .select('*')
        .single<GymSettings>()

      if (updateErr) {
        res.status(500).json({ success: false, message: updateErr.message })
        return
      }
      if (updatedDb) {
        updatedResult = updatedDb
      }
    } else {
      fallbackGymSettings = updatedResult
    }

    // 4. Record audit log
    await logAuditEvent({
      actorId: req.authUser?.id,
      entityType: 'settings',
      entityId: updatedResult.id,
      action: 'gym_settings_updated',
      previousData: {
        gym_name: existingSettings.gym_name,
        contact_phone: existingSettings.contact_phone,
        contact_email: existingSettings.contact_email,
        address: existingSettings.address,
        currency_symbol: existingSettings.currency_symbol,
        currency_code: existingSettings.currency_code,
        member_id_prefix: existingSettings.member_id_prefix,
        payment_due_grace_days: existingSettings.payment_due_grace_days,
        reminder_advance_days: existingSettings.reminder_advance_days,
      },
      newData: {
        gym_name: updatedResult.gym_name,
        contact_phone: updatedResult.contact_phone,
        contact_email: updatedResult.contact_email,
        address: updatedResult.address,
        currency_symbol: updatedResult.currency_symbol,
        currency_code: updatedResult.currency_code,
        member_id_prefix: updatedResult.member_id_prefix,
        payment_due_grace_days: updatedResult.payment_due_grace_days,
        reminder_advance_days: updatedResult.reminder_advance_days,
      },
    })

    res.json({
      success: true,
      message: 'Gym settings updated successfully.',
      data: updatedResult,
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Internal server error.' })
  }
}

/**
 * GET /api/settings/profile
 * Retrieve authenticated user's profile details.
 */
export async function getMyProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.authUser) {
      res.status(401).json({ success: false, message: 'Authentication required.' })
      return
    }

    const supabase = getSupabaseAdmin()
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.authUser.id)
      .single<ProfileRow>()

    if (error || !profile) {
      res.status(404).json({ success: false, message: 'Profile not found.' })
      return
    }

    let last_sign_in_at: string | null = null
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(req.authUser.id)
      if (authUser?.user) {
        last_sign_in_at = authUser.user.last_sign_in_at ?? null
      }
    } catch {
      // non-fatal
    }

    res.json({
      success: true,
      data: {
        ...profile,
        last_sign_in_at,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Internal server error.' })
  }
}

/**
 * PATCH /api/settings/profile
 * Update authenticated user's own profile (full_name and phone).
 * Strips role or email to block any privilege escalation attempts.
 */
export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.authUser) {
      res.status(401).json({ success: false, message: 'Authentication required.' })
      return
    }

    const { full_name, phone } = req.body as UpdateProfileInput
    const supabase = getSupabaseAdmin()

    // 1. Fetch existing profile
    const { data: existing, error: findError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.authUser.id)
      .single<ProfileRow>()

    if (findError || !existing) {
      res.status(404).json({ success: false, message: 'Profile not found.' })
      return
    }

    // 2. Validate input
    const updates: Partial<ProfileRow> = {
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

    // Explicitly reject/ignore role changes
    delete (updates as any).role
    delete (updates as any).email
    delete (updates as any).is_active

    // 3. Update profiles table
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.authUser.id)
      .select('*')
      .single<ProfileRow>()

    if (updateError || !updated) {
      res.status(500).json({ success: false, message: updateError?.message || 'Profile update failed.' })
      return
    }

    // 4. Update auth user metadata
    try {
      await supabase.auth.admin.updateUserById(req.authUser.id, {
        user_metadata: {
          full_name: updated.full_name,
          phone: updated.phone,
        },
      })
    } catch {
      // non-fatal
    }

    // 5. Audit log
    await logAuditEvent({
      actorId: req.authUser.id,
      entityType: 'profile',
      entityId: req.authUser.id,
      action: 'profile_updated',
      previousData: {
        full_name: existing.full_name,
        phone: existing.phone,
      },
      newData: {
        full_name: updated.full_name,
        phone: updated.phone,
      },
    })

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: updated,
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Internal server error.' })
  }
}

/**
 * POST /api/settings/change-password
 * Change password for the currently authenticated staff member.
 * Requires verification of current password before applying new password.
 */
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    if (!req.authUser || !req.authUser.email) {
      res.status(401).json({ success: false, message: 'Authentication required.' })
      return
    }

    const { currentPassword, newPassword } = req.body ?? {}

    if (!currentPassword || typeof currentPassword !== 'string') {
      res.status(400).json({ success: false, message: 'Current password is required.' })
      return
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long.',
      })
      return
    }

    if (currentPassword === newPassword) {
      res.status(400).json({
        success: false,
        message: 'New password cannot be the same as current password.',
      })
      return
    }

    const supabase = getSupabaseAdmin()

    // 1. Statelessly verify current credentials against Supabase Auth endpoint
    // Using fetch directly prevents polluting the supabaseAdmin singleton with user session
    const verifyRes = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: env.supabaseServiceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: req.authUser.email,
        password: currentPassword,
      }),
    })

    if (!verifyRes.ok) {
      res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      })
      return
    }

    // 2. Update password via Supabase Admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(req.authUser.id, {
      password: newPassword,
    })

    if (updateError) {
      res.status(500).json({ success: false, message: updateError.message })
      return
    }

    // 3. Log audit event (sensitive password keys scrubbed automatically by auditService)
    await logAuditEvent({
      actorId: req.authUser.id,
      entityType: 'auth',
      entityId: req.authUser.id,
      action: 'password_changed',
      newData: {
        user_id: req.authUser.id,
      },
    })

    res.json({
      success: true,
      message: 'Password changed successfully.',
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Internal server error.' })
  }
}
