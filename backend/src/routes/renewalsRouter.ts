import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  getExpiredRenewals,
  getRenewalHistory,
  getUpcomingRenewals,
} from '../controllers/renewalsController.js'

export const renewalsRouter = Router()

/**
 * Renewals workbench routes (mounted at /api/renewals)
 *
 * All endpoints require authentication (accessible to Owner and Trainer).
 *
 * GET /api/renewals/upcoming — Active memberships approaching expiry
 * GET /api/renewals/expired  — Expired memberships without subsequent renewals
 * GET /api/renewals/history  — Completed renewal events and timeliness analytics
 */
renewalsRouter.use(requireAuth)

renewalsRouter.get('/upcoming', getUpcomingRenewals)
renewalsRouter.get('/expired', getExpiredRenewals)
renewalsRouter.get('/history', getRenewalHistory)
