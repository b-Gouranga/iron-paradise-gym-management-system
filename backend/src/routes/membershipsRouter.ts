import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  getMembership,
  renewMembership,
  updateMembership,
  listMemberMemberships,
  createMembership,
} from '../controllers/membershipsController.js'
import {
  getMembershipPayments,
  recordPayment,
} from '../controllers/paymentsController.js'

export const membershipsRouter = Router()

/**
 * Direct membership routes (mounted at /api/memberships)
 *
 * GET   /api/memberships/:id          — single membership detail (requireAuth)
 * POST  /api/memberships/:id/renew    — renew membership (requireAuth: Owner & Trainer)
 * PATCH /api/memberships/:id          — conservative update (requireAuth)
 * GET   /api/memberships/:id/payments — get payments for this membership (requireAuth)
 * POST  /api/memberships/:id/payments — record payment for this membership (requireAuth)
 *
 * Also supports /api/memberships/member/:memberId for convenience
 */

membershipsRouter.get('/member/:memberId', requireAuth, listMemberMemberships)
membershipsRouter.post('/member/:memberId', requireAuth, createMembership)
membershipsRouter.post('/:id/renew', requireAuth, renewMembership)
membershipsRouter.get('/:id/payments', requireAuth, getMembershipPayments)
membershipsRouter.post('/:id/payments', requireAuth, recordPayment)
membershipsRouter.get('/:id', requireAuth, getMembership)
membershipsRouter.patch('/:id', requireAuth, updateMembership)
