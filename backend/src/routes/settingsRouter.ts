import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'
import { sensitiveAuthLimiter } from '../middleware/rateLimiter.js'
import {
  changePassword,
  getGymSettings,
  getMyProfile,
  updateGymSettings,
  updateMyProfile,
} from '../controllers/settingsController.js'

export const settingsRouter = Router()

/**
 * Settings routes (mounted at /api/settings)
 *
 * GET   /api/settings/gym             — get gym settings (Owner & Trainer)
 * PATCH /api/settings/gym             — update gym settings (Owner only, 403 for Trainer)
 * GET   /api/settings/profile         — get current user's profile (Owner & Trainer)
 * PATCH /api/settings/profile         — update current user's profile (Owner & Trainer)
 * POST  /api/settings/change-password — change current user's password (Owner & Trainer)
 */

// Gym profile & operational defaults
settingsRouter.get('/gym', requireAuth, getGymSettings)
settingsRouter.patch('/gym', requireAuth, requireRole('owner'), updateGymSettings)

// Current staff account settings
settingsRouter.get('/profile', requireAuth, getMyProfile)
settingsRouter.patch('/profile', requireAuth, updateMyProfile)
settingsRouter.post('/change-password', requireAuth, sensitiveAuthLimiter, changePassword)
