import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'
import { getAuditLogs } from '../controllers/auditLogsController.js'

export const auditLogsRouter = Router()

/**
 * GET /api/audit-logs
 * Strictly Owner-only. Trainers receive HTTP 403 Forbidden.
 */
auditLogsRouter.get('/', requireAuth, requireRole('owner'), getAuditLogs)
