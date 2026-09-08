import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'
import {
  listMembers,
  getMember,
  createMember,
  updateMember,
  archiveMember,
} from '../controllers/membersController.js'
import {
  listMemberMemberships,
  createMembership,
} from '../controllers/membershipsController.js'
import { getMemberPayments } from '../controllers/paymentsController.js'
import { getMemberReminders } from '../controllers/remindersController.js'

export const membersRouter = Router()

/**
 * GET  /api/members                      — list, search, and filter members (requireAuth)
 * GET  /api/members/:id                  — single member detail (requireAuth)
 * POST /api/members                      — create member (requireAuth; owner or trainer)
 * PATCH /api/members/:id                 — update member personal fields (requireAuth; owner or trainer)
 * PATCH /api/members/:id/archive         — soft-archive member (owner only)
 * GET  /api/members/:memberId/memberships — list memberships for member (requireAuth)
 * POST /api/members/:memberId/memberships — create membership for member (requireAuth)
 * GET  /api/members/:memberId/payments   — list payments & financial summary for member (requireAuth)
 * GET  /api/members/:memberId/reminders  — list reminders & history for member (requireAuth)
 */

membersRouter.get('/', requireAuth, listMembers)
membersRouter.post('/', requireAuth, createMember)
membersRouter.get('/:memberId/memberships', requireAuth, listMemberMemberships)
membersRouter.post('/:memberId/memberships', requireAuth, createMembership)
membersRouter.get('/:memberId/payments', requireAuth, getMemberPayments)
membersRouter.get('/:id/payments', requireAuth, getMemberPayments)
membersRouter.get('/:memberId/reminders', requireAuth, getMemberReminders)
membersRouter.get('/:id/reminders', requireAuth, getMemberReminders)
membersRouter.get('/:id', requireAuth, getMember)
membersRouter.patch('/:id/archive', requireAuth, requireRole('owner'), archiveMember)
membersRouter.patch('/:id', requireAuth, updateMember)
