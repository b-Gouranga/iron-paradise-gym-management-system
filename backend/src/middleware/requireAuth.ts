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
 * - Attaches the verified `User` object to `req.authUser`.
 * - Returns 401 if missing or invalid.
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
    res.status(401).json({ success: false, message: 'Invalid or expired session.' })
    return
  }

  req.authUser = data.user
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
 * - Loads the user's profile from the database using the verified user ID.
 *   The role is NEVER read from JWT claims or the request body.
 * - Checks that the profile exists, is active, and has the required role.
 * - Attaches the profile to `req.authProfile` for downstream use.
 * - Returns 403 if the user does not have the required role.
 *
 * @example
 *   router.delete('/plans/:id', requireAuth, requireRole('owner'), deletePlan)
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

    const supabase = getSupabaseAdmin()

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.authUser.id)
      .single<ProfileRow>()

    if (error || !profile) {
      res.status(403).json({ success: false, message: 'Profile not found.' })
      return
    }

    if (!profile.is_active) {
      res.status(403).json({ success: false, message: 'Account is inactive.' })
      return
    }

    if (!roles.includes(profile.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions.' })
      return
    }

    req.authProfile = profile
    next()
  }
}
