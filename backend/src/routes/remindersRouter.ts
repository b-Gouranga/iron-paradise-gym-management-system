import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'
import {
  cancelReminder,
  getMessageTemplates,
  getReminderSettings,
  listMessageHistory,
  listReminders,
  previewTemplate,
  sendReminder,
  triggerGenerate,
  triggerProcess,
  triggerRun,
  updateMessageTemplate,
  updateReminderSetting,
} from '../controllers/remindersController.js'

export const remindersRouter = Router()

/**
 * Reminders routes (mounted at /api/reminders)
 *
 * GET   /api/reminders                    — paginated list of all reminders (requireAuth)
 * GET   /api/reminders/history            — paginated message history audit trail (requireAuth)
 * GET   /api/reminders/settings           — view reminder settings (requireAuth)
 * PATCH /api/reminders/settings/:stage    — update reminder setting (requireAuth: Owner only)
 * GET   /api/reminders/templates          — view message templates (requireAuth)
 * PATCH /api/reminders/templates/:id      — update message template (requireAuth: Owner only)
 * POST  /api/reminders/preview-template   — preview rendered template (requireAuth)
 * POST  /api/reminders/generate           — trigger reminder candidate scan (requireAuth: Owner only)
 * POST  /api/reminders/process            — trigger processing of scheduled reminders (requireAuth: Owner only)
 * POST  /api/reminders/run                — run generate + process combined (requireAuth: Owner only)
 * POST  /api/reminders/:id/send           — manually send a specific scheduled reminder (requireAuth: Owner only)
 * POST  /api/reminders/:id/cancel         — cancel a scheduled reminder (requireAuth: Owner only)
 */

// Reminders list & history (Owner & Trainer)
remindersRouter.get('/', requireAuth, listReminders)
remindersRouter.get('/history', requireAuth, listMessageHistory)

// Settings & Templates viewing (Owner & Trainer)
remindersRouter.get('/settings', requireAuth, getReminderSettings)
remindersRouter.get('/templates', requireAuth, getMessageTemplates)
remindersRouter.post('/preview-template', requireAuth, previewTemplate)

// Settings & Templates modifications (Owner only)
remindersRouter.patch('/settings/:stage', requireAuth, requireRole('owner'), updateReminderSetting)
remindersRouter.patch('/templates/:id', requireAuth, requireRole('owner'), updateMessageTemplate)

// Engine triggers & actions (Owner only)
remindersRouter.post('/generate', requireAuth, requireRole('owner'), triggerGenerate)
remindersRouter.post('/process', requireAuth, requireRole('owner'), triggerProcess)
remindersRouter.post('/run', requireAuth, requireRole('owner'), triggerRun)
remindersRouter.post('/:id/send', requireAuth, requireRole('owner'), sendReminder)
remindersRouter.post('/:id/cancel', requireAuth, requireRole('owner'), cancelReminder)
