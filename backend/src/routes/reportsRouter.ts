import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  getMemberships,
  getOverview,
  getPayments,
  getRenewals,
  getRevenue,
} from '../controllers/reportsController.js'

export const reportsRouter = Router()

/**
 * Reports routes (mounted at /api/reports)
 * All endpoints require authentication (Owner or Trainer).
 *
 * GET /api/reports/overview    — Executive KPIs summary
 * GET /api/reports/revenue     — Revenue breakdown, time series, transactions
 * GET /api/reports/payments    — Payment status, dues, balances
 * GET /api/reports/memberships — Membership counts and plan distribution
 * GET /api/reports/renewals    — Renewal counts, delay days, late renewals
 */
reportsRouter.use(requireAuth)

reportsRouter.get('/overview', getOverview)
reportsRouter.get('/revenue', getRevenue)
reportsRouter.get('/payments', getPayments)
reportsRouter.get('/memberships', getMemberships)
reportsRouter.get('/renewals', getRenewals)
