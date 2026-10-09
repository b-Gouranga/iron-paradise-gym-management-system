import { Router } from 'express'
import { getHealth } from '../controllers/healthController.js'
import { authRouter } from './authRouter.js'
import { dashboardRouter } from './dashboardRouter.js'
import { membersRouter } from './membersRouter.js'
import { membershipPlansRouter } from './membershipPlansRouter.js'
import { membershipsRouter } from './membershipsRouter.js'
import { paymentsRouter } from './paymentsRouter.js'
import { remindersRouter } from './remindersRouter.js'
import { reportsRouter } from './reportsRouter.js'
import { trainersRouter } from './trainersRouter.js'
import { settingsRouter } from './settingsRouter.js'
import { auditLogsRouter } from './auditLogsRouter.js'
import { renewalsRouter } from './renewalsRouter.js'
import { whatsappRouter } from './whatsappRouter.js'

export const apiRouter = Router()

// Public — no authentication required
apiRouter.get('/health', getHealth)

// Auth routes (setup-owner is public but owner-guarded by controller logic)
apiRouter.use('/auth', authRouter)

// Dashboard routes — all protected by requireAuth (enforced in dashboardRouter)
apiRouter.use('/dashboard', dashboardRouter)

// Members routes — protected by requireAuth (enforced in membersRouter)
apiRouter.use('/members', membersRouter)

// Membership Plans routes — protected by requireAuth (enforced in membershipPlansRouter)
apiRouter.use('/membership-plans', membershipPlansRouter)

// Memberships routes — protected by requireAuth (enforced in membershipsRouter)
apiRouter.use('/memberships', membershipsRouter)

// Payments routes — protected by requireAuth (enforced in paymentsRouter)
apiRouter.use('/payments', paymentsRouter)

// Reminders routes — protected by requireAuth (enforced in remindersRouter)
apiRouter.use('/reminders', remindersRouter)

// Reports routes — protected by requireAuth (enforced in reportsRouter)
apiRouter.use('/reports', reportsRouter)

// Trainers routes — protected by requireAuth and permissions (enforced in trainersRouter)
apiRouter.use('/trainers', trainersRouter)

// Settings routes — protected by requireAuth (enforced in settingsRouter)
apiRouter.use('/settings', settingsRouter)

// Audit logs routes — Owner-only (enforced in auditLogsRouter)
apiRouter.use('/audit-logs', auditLogsRouter)

// Renewals workbench routes — protected by requireAuth (enforced in renewalsRouter)
apiRouter.use('/renewals', renewalsRouter)

// WhatsApp routes — public webhook endpoints for Meta verification and status callbacks
apiRouter.use('/whatsapp', whatsappRouter)
