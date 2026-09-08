import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'
import {
  listMembershipPlans,
  getMembershipPlan,
  createMembershipPlan,
  updateMembershipPlan,
  archiveMembershipPlan,
  reactivateMembershipPlan,
} from '../controllers/membershipPlansController.js'

export const membershipPlansRouter = Router()

/**
 * GET   /api/membership-plans            — list membership plans (requireAuth: Owner & Trainer)
 * POST  /api/membership-plans            — create a membership plan (requireAuth, requireRole('owner'))
 * GET   /api/membership-plans/:id        — get a membership plan (requireAuth: Owner & Trainer)
 * PATCH /api/membership-plans/:id/archive — deactivate plan (requireAuth, requireRole('owner'))
 * PATCH /api/membership-plans/:id/reactivate — reactivate plan (requireAuth, requireRole('owner'))
 * PATCH /api/membership-plans/:id        — update plan template (requireAuth, requireRole('owner'))
 */

membershipPlansRouter.get('/', requireAuth, listMembershipPlans)
membershipPlansRouter.post('/', requireAuth, requireRole('owner'), createMembershipPlan)
membershipPlansRouter.get('/:id', requireAuth, getMembershipPlan)
membershipPlansRouter.patch('/:id/archive', requireAuth, requireRole('owner'), archiveMembershipPlan)
membershipPlansRouter.patch('/:id/reactivate', requireAuth, requireRole('owner'), reactivateMembershipPlan)
membershipPlansRouter.patch('/:id', requireAuth, requireRole('owner'), updateMembershipPlan)
