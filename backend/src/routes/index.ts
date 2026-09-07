import { Router } from 'express'
import { getHealth } from '../controllers/healthController.js'
import { authRouter } from './authRouter.js'

export const apiRouter = Router()

// Public — no authentication required
apiRouter.get('/health', getHealth)

// Auth routes (setup-owner is public but owner-guarded by controller logic)
apiRouter.use('/auth', authRouter)
