import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/requireAuth.js'
import {
  cancelReminder,
  getMessageTemplates,
  getReminderSettings,
  listMessageHistory,
  listReminders,
  manualSendReminder,
  previewTemplate,
  retryReminder,
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
 * GET   /api/reminders                    — paginated list of all reminders (requireAuth: Owner & Trainer)
 * GET   /api/reminders/history            — paginated message history audit trail (requireAuth: Owner & Trainer)
 * GET   /api/reminders/settings           — view reminder settings (requireAuth: Owner & Trainer)
 * PATCH /api/reminders/settings/:stage    — update reminder setting (requireAuth: Owner only)
 * GET   /api/reminders/templates          — view message templates (requireAuth: Owner & Trainer)
 * PATCH /api/reminders/templates/:id      — update message template (requireAuth: Owner only)
 * POST  /api/reminders/preview-template   — preview rendered template (requireAuth: Owner & Trainer)
 * POST  /api/reminders/generate           — trigger reminder candidate scan (requireAuth: Owner only)
 * POST  /api/reminders/process            — trigger processing of scheduled reminders (requireAuth: Owner only)
 * POST  /api/reminders/run                — run generate + process combined (requireAuth: Owner only)
 * POST  /api/reminders/:id/send           — manually send a specific scheduled reminder (requireAuth: Owner & Trainer)
 * POST  /api/reminders/:id/retry          — manually retry a failed reminder (requireAuth: Owner & Trainer)
 * POST  /api/reminders/manual             — manually send a WhatsApp reminder for a member (requireAuth: Owner & Trainer)
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

// Engine bulk scan & process runs (Owner only)
remindersRouter.post('/generate', requireAuth, requireRole('owner'), triggerGenerate)
remindersRouter.post('/process', requireAuth, requireRole('owner'), triggerProcess)
remindersRouter.post('/run', requireAuth, requireRole('owner'), triggerRun)
remindersRouter.post('/:id/cancel', requireAuth, requireRole('owner'), cancelReminder)

// Individual reminder actions (Owner & Trainer permitted)
remindersRouter.post('/:id/send', requireAuth, sendReminder)
remindersRouter.post('/:id/retry', requireAuth, retryReminder)
remindersRouter.post('/manual', requireAuth, manualSendReminder)
