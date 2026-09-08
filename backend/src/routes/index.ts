import { Router } from 'express'
import { getHealth } from '../controllers/healthController.js'
import { authRouter } from './authRouter.js'
import { dashboardRouter } from './dashboardRouter.js'
import { membersRouter } from './membersRouter.js'

export const apiRouter = Router()

// Public — no authentication required
apiRouter.get('/health', getHealth)

// Auth routes (setup-owner is public but owner-guarded by controller logic)
apiRouter.use('/auth', authRouter)

// Dashboard routes — all protected by requireAuth (enforced in dashboardRouter)
apiRouter.use('/dashboard', dashboardRouter)

// Members routes — protected by requireAuth (enforced in membersRouter)
apiRouter.use('/members', membersRouter)
