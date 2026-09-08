import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { requirePermission } from '../middleware/permissions.js'
import {
  listTrainers,
  getTrainer,
  createTrainer,
  updateTrainer,
  activateTrainer,
  deactivateTrainer,
  resetTrainerPassword,
} from '../controllers/trainersController.js'

export const trainersRouter = Router()

/**
 * GET   /api/trainers               — list trainers (accessible to owner & trainer)
 * GET   /api/trainers/:id           — get trainer details (accessible to owner & trainer)
 * POST  /api/trainers               — create trainer (owner only)
 * PATCH /api/trainers/:id           — update trainer profile (owner only)
 * PATCH /api/trainers/:id/activate  — activate trainer (owner only)
 * PATCH /api/trainers/:id/deactivate — deactivate trainer (owner only)
 * POST  /api/trainers/:id/reset-password — reset trainer password (owner only)
 */
trainersRouter.get('/', requireAuth, requirePermission('trainer:list'), listTrainers)
trainersRouter.get('/:id', requireAuth, requirePermission('trainer:list'), getTrainer)
trainersRouter.post('/', requireAuth, requirePermission('trainer:create'), createTrainer)
trainersRouter.patch('/:id', requireAuth, requirePermission('trainer:update'), updateTrainer)
trainersRouter.patch('/:id/activate', requireAuth, requirePermission('trainer:activate'), activateTrainer)
trainersRouter.patch('/:id/deactivate', requireAuth, requirePermission('trainer:deactivate'), deactivateTrainer)
trainersRouter.post('/:id/reset-password', requireAuth, requirePermission('trainer:update'), resetTrainerPassword)
