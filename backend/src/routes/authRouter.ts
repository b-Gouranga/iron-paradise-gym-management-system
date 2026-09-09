import { Router } from 'express'
import { setupOwner } from '../controllers/authController.js'
import { sensitiveAuthLimiter } from '../middleware/rateLimiter.js'

export const authRouter = Router()

/**
 * POST /api/auth/setup-owner
 *
 * Creates the first owner account. Public endpoint, but the controller
 * rejects the request with 409 Conflict if an owner already exists.
 * The owner role is always assigned server-side — never read from the body.
 */
authRouter.post('/setup-owner', sensitiveAuthLimiter, setupOwner)
