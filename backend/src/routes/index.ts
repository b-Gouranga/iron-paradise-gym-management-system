import { Router } from 'express'
import { getHealth } from '../controllers/healthController.js'

export const apiRouter = Router()
apiRouter.get('/health', getHealth)
