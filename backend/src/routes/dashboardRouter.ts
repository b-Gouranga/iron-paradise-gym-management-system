import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { getSummary } from '../controllers/dashboardController.js'

export const dashboardRouter = Router()

/**
 * GET /api/dashboard/summary
 *
 * Returns aggregated dashboard metrics and bounded list data.
 * Protected: the caller must supply a valid Supabase JWT in the
 * Authorization: Bearer <token> header. The JWT is verified server-side
 * by requireAuth before any database query runs.
 */
dashboardRouter.get('/summary', requireAuth, getSummary)
