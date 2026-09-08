import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  getMembership,
  renewMembership,
  updateMembership,
  listMemberMemberships,
  createMembership,
} from '../controllers/membershipsController.js'

export const membershipsRouter = Router()

/**
 * Direct membership routes (mounted at /api/memberships)
 *
 * GET   /api/memberships/:id        — single membership detail (requireAuth)
 * POST  /api/memberships/:id/renew  — renew membership (requireAuth: Owner & Trainer)
 * PATCH /api/memberships/:id        — conservative update (requireAuth)
 *
 * Also supports /api/memberships/member/:memberId for convenience
 */

membershipsRouter.get('/member/:memberId', requireAuth, listMemberMemberships)
membershipsRouter.post('/member/:memberId', requireAuth, createMembership)
membershipsRouter.post('/:id/renew', requireAuth, renewMembership)
membershipsRouter.get('/:id', requireAuth, getMembership)
membershipsRouter.patch('/:id', requireAuth, updateMembership)
