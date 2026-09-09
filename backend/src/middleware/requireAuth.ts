import type { NextFunction, Request, Response } from 'express'
import { getSupabaseAdmin } from '../services/database/supabaseAdmin.js'
import type { ProfileRole, ProfileRow } from '../types/auth.js'

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------

/**
 * Middleware that verifies the Supabase JWT from the Authorization header.
 *
 * - Extracts the Bearer token from `Authorization: Bearer <token>`
 * - Verifies it server-side via `supabase.auth.getUser(token)` — the token is
 *   NEVER decoded client-side or trusted from the request body.
 * - Checks the user's active status from `profiles` to immediately reject
 *   deactivated accounts with HTTP 403.
 * - Attaches verified user to `req.authUser` and profile to `req.authProfile`.
 * - Returns 401 if missing or invalid session.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required.' })
    return
  }

  const token = authHeader.slice(7)
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    const isBanned = error?.message?.toLowerCase().includes('banned')
    res.status(isBanned ? 403 : 401).json({
      success: false,
      message: isBanned ? 'Account is deactivated.' : 'Invalid or expired session.',
    })
    return
  }

  req.authUser = data.user

  // Verify account exists and active status against profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single<ProfileRow>()

  if (!profile) {
    res.status(403).json({ success: false, message: 'Profile not found or access denied.' })
    return
  }

  if (!profile.is_active) {
    res.status(403).json({ success: false, message: 'Account is deactivated.' })
    return
  }

  req.authProfile = profile
  next()
}

// ---------------------------------------------------------------------------
// requireRole
// ---------------------------------------------------------------------------

/**
 * Middleware factory that requires a specific role (or any of several roles).
 *
 * Must be used AFTER `requireAuth` (depends on `req.authUser`).
 *
 * - Reuses verified profile from `req.authProfile` or loads from database.
 * - Checks that the profile exists, is active, and has the required role.
 * - Returns 403 if the user does not have the required role or is inactive.
 */
export function requireRole(...roles: ProfileRole[]) {
  return async function (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!req.authUser) {
      res.status(401).json({ success: false, message: 'Authentication required.' })
      return
    }

    let profile = req.authProfile
    if (!profile) {
      const supabase = getSupabaseAdmin()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', req.authUser.id)
        .single<ProfileRow>()

      if (error || !data) {
        res.status(403).json({ success: false, message: 'Profile not found.' })
        return
      }
      profile = data
      req.authProfile = profile
    }

    if (!profile.is_active) {
      res.status(403).json({ success: false, message: 'Account is deactivated.' })
      return
    }

    if (!roles.includes(profile.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions.' })
      return
    }

    next()
  }
}
