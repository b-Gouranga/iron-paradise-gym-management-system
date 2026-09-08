import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'
import {
  listMembers,
  getMember,
  createMember,
  updateMember,
  archiveMember,
} from '../controllers/membersController.js'

export const membersRouter = Router()

/**
 * GET  /api/members           — list, search, and filter members (requireAuth)
 * GET  /api/members/:id       — single member detail (requireAuth)
 * POST /api/members           — create member (requireAuth; owner or trainer)
 * PATCH /api/members/:id      — update member personal fields (requireAuth; owner or trainer)
 * PATCH /api/members/:id/archive — soft-archive member (owner only)
 *
 * Note: the /archive sub-route is mounted before /:id to ensure Express does
 * not ambiguously match it as an id parameter.
 */

membersRouter.get('/', requireAuth, listMembers)
membersRouter.post('/', requireAuth, createMember)
membersRouter.get('/:id', requireAuth, getMember)
membersRouter.patch('/:id/archive', requireAuth, requireRole('owner'), archiveMember)
membersRouter.patch('/:id', requireAuth, updateMember)
