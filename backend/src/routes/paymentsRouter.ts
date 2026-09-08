import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  getMemberPayments,
  getMembershipPayments,
  listPayments,
  recordPayment,
} from '../controllers/paymentsController.js'

export const paymentsRouter = Router()

/**
 * Payments routes (mounted at /api/payments)
 *
 * GET   /api/payments                       — paginated list of all payments (requireAuth)
 * GET   /api/payments/member/:memberId      — all payments + balance summary for a member (requireAuth)
 * GET   /api/payments/membership/:membershipId — payments + balance summary for a membership (requireAuth)
 * POST  /api/payments/membership/:membershipId — record a manual payment (requireAuth)
 * POST  /api/payments                       — record a manual payment (requireAuth)
 */

paymentsRouter.get('/', requireAuth, listPayments)
paymentsRouter.get('/member/:memberId', requireAuth, getMemberPayments)
paymentsRouter.get('/member/:id', requireAuth, getMemberPayments)
paymentsRouter.get('/membership/:membershipId', requireAuth, getMembershipPayments)
paymentsRouter.get('/membership/:id', requireAuth, getMembershipPayments)
paymentsRouter.get('/:id/payments', requireAuth, getMembershipPayments)
paymentsRouter.post('/membership/:membershipId', requireAuth, recordPayment)
paymentsRouter.post('/membership/:id', requireAuth, recordPayment)
paymentsRouter.post('/:id/payments', requireAuth, recordPayment)
paymentsRouter.post('/', requireAuth, recordPayment)
