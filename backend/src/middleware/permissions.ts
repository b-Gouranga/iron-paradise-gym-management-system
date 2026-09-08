import type { NextFunction, Request, Response } from 'express'
import type { ProfileRole } from '../types/auth.js'

export type Permission =
  | 'trainer:list'
  | 'trainer:create'
  | 'trainer:update'
  | 'trainer:activate'
  | 'trainer:deactivate'

const ROLE_PERMISSIONS: Record<ProfileRole, Permission[]> = {
  owner: [
    'trainer:list',
    'trainer:create',
    'trainer:update',
    'trainer:activate',
    'trainer:deactivate',
  ],
  trainer: [
    'trainer:list',
  ],
}

/**
 * Middleware factory requiring a specific permission.
 * Must be mounted AFTER requireAuth.
 * Checks the user's role permissions and enforces that the user is active.
 */
export function requirePermission(permission: Permission) {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.authUser) {
      res.status(401).json({ success: false, message: 'Authentication required.' })
      return
    }

    const profile = req.authProfile
    if (!profile) {
      res.status(403).json({ success: false, message: 'Profile not found or access denied.' })
      return
    }

    if (!profile.is_active) {
      res.status(403).json({ success: false, message: 'Account is deactivated.' })
      return
    }

    const userRole = profile.role as ProfileRole
    const userPermissions = ROLE_PERMISSIONS[userRole] || []
    if (!userPermissions.includes(permission)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Insufficient permissions for '${permission}'.`,
      })
      return
    }

    next()
  }
}
