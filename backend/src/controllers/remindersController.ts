import type { Request, Response } from 'express'
import { getSupabaseAdmin } from '../services/database/supabaseAdmin.js'
import { logAuditEvent } from '../services/audit/auditService.js'
import {
  ensureDefaultSettingsAndTemplates,
  generateReminders,
  processReminders,
} from '../services/reminders/reminderEngine.js'
import {
  getSampleTemplateContext,
  renderTemplate,
} from '../services/reminders/templateEngine.js'
import type {
  MessageHistoryRow,
  MessageHistoryWithDetails,
  ReminderChannel,
  ReminderRow,
  ReminderSettingRow,
  ReminderStage,
  ReminderStatsSummary,
  ReminderStatus,
  ReminderWithDetails,
} from '../types/reminders.js'

/**
 * GET /api/reminders
 *
 * Lists paginated reminders with search and filters (stage, status, channel).
 * Includes summary statistics.
 */
export async function listReminders(req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseAdmin()
  await ensureDefaultSettingsAndTemplates()

  const q = String(req.query.q || req.query.search || '').trim()
  const stage = String(req.query.stage || '').trim()
  const status = String(req.query.status || '').trim()
  const channel = String(req.query.channel || '').trim()
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20))
  const offset = (page - 1) * limit

  try {
    // 1. Calculate overall reminder counts
    const { data: allStatuses } = await supabase.from('reminders').select('status')
    const stats: ReminderStatsSummary = {
      scheduledCount: 0,
      sentCount: 0,
      failedCount: 0,
      cancelledCount: 0,
      totalCount: (allStatuses ?? []).length,
    }

    for (const r of allStatuses ?? []) {
      if (r.status === 'scheduled') stats.scheduledCount++
      else if (r.status === 'sent' || r.status === 'delivered') stats.sentCount++
      else if (r.status === 'failed') stats.failedCount++
      else if (r.status === 'cancelled') stats.cancelledCount++
    }

    // 2. Filter by member name or code if search query present
    let memberIds: string[] | null = null
    if (q) {
      const sanitized = q.replace(/[%_\\]/g, '\\$&')
      const { data: matchedMembers } = await supabase
        .from('members')
        .select('id')
        .or(`full_name.ilike.%${sanitized}%,member_code.ilike.%${sanitized}%`)

      memberIds = (matchedMembers ?? []).map((m: { id: string }) => m.id)
      if (memberIds.length === 0) {
        res.json({
          success: true,
          data: {
            reminders: [],
            total: 0,
            page,
            limit,
            totalPages: 0,
            stats,
          },
        })
        return
      }
    }

    // 3. Build reminders query
    let query = supabase
      .from('reminders')
      .select('*', { count: 'exact' })

    if (memberIds !== null) {
      query = query.in('member_id', memberIds)
    }
    if (stage) {
      query = query.eq('reminder_stage', stage)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (channel) {
      query = query.eq('channel', channel)
    }

    query = query
      .order('scheduled_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: rows, count, error } = await query
    if (error) throw error

    const pRows = (rows ?? []) as ReminderRow[]
    const memberIdsToFetch = [...new Set(pRows.map(r => r.member_id))]
    const membershipIdsToFetch = [...new Set(pRows.map(r => r.membership_id))]

    const [membersRes, membershipsRes] = await Promise.all([
      memberIdsToFetch.length > 0
        ? supabase.from('members').select('id, full_name, member_code, phone').in('id', memberIdsToFetch)
        : { data: [] },
      membershipIdsToFetch.length > 0
        ? supabase.from('memberships').select('id, actual_fee, expiry_date, payment_due_date, membership_plans(name)').in('id', membershipIdsToFetch)
        : { data: [] },
    ])

    const memberLookup = new Map<string, { full_name: string; member_code: string; phone: string }>()
    for (const m of (membersRes.data ?? []) as unknown as Array<{ id: string; full_name: string; member_code: string; phone: string }>) {
      memberLookup.set(m.id, m)
    }

    const membershipLookup = new Map<string, { plan_name: string; expiry_date: string; payment_due_date: string | null }>()
    for (const ms of (membershipsRes.data ?? []) as unknown as Array<{
      id: string
      actual_fee: number
      expiry_date: string
      payment_due_date: string | null
      membership_plans: { name: string } | { name: string }[] | null
    }>) {
      const p = Array.isArray(ms.membership_plans) ? ms.membership_plans[0] : ms.membership_plans
      membershipLookup.set(ms.id, {
        plan_name: p?.name ?? 'Standard Plan',
        expiry_date: ms.expiry_date,
        payment_due_date: ms.payment_due_date,
      })
    }

    const enriched: ReminderWithDetails[] = pRows.map(r => {
      const m = memberLookup.get(r.member_id)
      const ms = membershipLookup.get(r.membership_id)
      return {
        ...r,
        member_name: m?.full_name ?? 'Unknown Member',
        member_code: m?.member_code ?? '—',
        member_phone: m?.phone ?? '—',
        plan_name: ms?.plan_name ?? 'Standard Plan',
        expiry_date: ms?.expiry_date,
        payment_due_date: ms?.payment_due_date,
        is_simulated: true,
      }
    })

    const total = count ?? 0
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0

    res.json({
      success: true,
      data: {
        reminders: enriched,
        total,
        page,
        limit,
        totalPages,
        stats,
      },
    })
  } catch (err) {
    console.error('[remindersController] listReminders error', err)
    res.status(500).json({ success: false, message: 'Failed to load reminders.' })
  }
}

/**
 * GET /api/reminders/history
 *
 * Lists paginated message history (audit trail) with search and filters.
 */
export async function listMessageHistory(req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseAdmin()

  const q = String(req.query.q || req.query.search || '').trim()
  const channel = String(req.query.channel || '').trim()
  const status = String(req.query.status || '').trim()
  const stage = String(req.query.stage || '').trim()
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20))
  const offset = (page - 1) * limit

  try {
    let memberIds: string[] | null = null
    if (q) {
      const sanitized = q.replace(/[%_\\]/g, '\\$&')
      const { data: matchedMembers } = await supabase
        .from('members')
        .select('id')
        .or(`full_name.ilike.%${sanitized}%,member_code.ilike.%${sanitized}%`)

      memberIds = (matchedMembers ?? []).map((m: { id: string }) => m.id)
      if (memberIds.length === 0) {
        res.json({
          success: true,
          data: {
            history: [],
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        })
        return
      }
    }

    let query = supabase
      .from('message_history')
      .select('*', { count: 'exact' })

    if (memberIds !== null) {
      query = query.in('member_id', memberIds)
    }
    if (channel) {
      query = query.eq('channel', channel)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (stage) {
      query = query.eq('reminder_stage', stage)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: rows, count, error } = await query
    if (error) throw error

    const hRows = (rows ?? []) as MessageHistoryRow[]
    const memberIdsToFetch = [...new Set(hRows.map(h => h.member_id))]
    const membershipIdsToFetch = [...new Set(hRows.map(h => h.membership_id))]

    const [membersRes, membershipsRes] = await Promise.all([
      memberIdsToFetch.length > 0
        ? supabase.from('members').select('id, full_name, member_code, phone').in('id', memberIdsToFetch)
        : { data: [] },
      membershipIdsToFetch.length > 0
        ? supabase.from('memberships').select('id, membership_plans(name)').in('id', membershipIdsToFetch)
        : { data: [] },
    ])

    const memberLookup = new Map<string, { full_name: string; member_code: string; phone: string }>()
    for (const m of (membersRes.data ?? []) as unknown as Array<{ id: string; full_name: string; member_code: string; phone: string }>) {
      memberLookup.set(m.id, m)
    }

    const planLookup = new Map<string, string>()
    for (const ms of (membershipsRes.data ?? []) as unknown as Array<{
      id: string
      membership_plans: { name: string } | { name: string }[] | null
    }>) {
      const p = Array.isArray(ms.membership_plans) ? ms.membership_plans[0] : ms.membership_plans
      planLookup.set(ms.id, p?.name ?? 'Standard Plan')
    }

    const enriched: MessageHistoryWithDetails[] = hRows.map(h => {
      const m = memberLookup.get(h.member_id)
      return {
        ...h,
        member_name: m?.full_name ?? 'Unknown Member',
        member_code: m?.member_code ?? '—',
        member_phone: m?.phone ?? '—',
        plan_name: planLookup.get(h.membership_id) ?? 'Standard Plan',
        is_simulated: true,
      }
    })

    const total = count ?? 0
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0

    res.json({
      success: true,
      data: {
        history: enriched,
        total,
        page,
        limit,
        totalPages,
      },
    })
  } catch (err) {
    console.error('[remindersController] listMessageHistory error', err)
    res.status(500).json({ success: false, message: 'Failed to load message history.' })
  }
}

/**
 * GET /api/reminders/settings
 *
 * Returns reminder settings for all 5 stages.
 */
export async function getReminderSettings(req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseAdmin()
  await ensureDefaultSettingsAndTemplates()

  try {
    const { data: settings, error } = await supabase
      .from('reminder_settings')
      .select('*')
      .order('reminder_stage')

    if (error) throw error

    res.json({ success: true, data: settings ?? [] })
  } catch (err) {
    console.error('[remindersController] getReminderSettings error', err)
    res.status(500).json({ success: false, message: 'Failed to load reminder settings.' })
  }
}

/**
 * PATCH /api/reminders/settings/:stage
 *
 * Updates reminder setting for a stage (Owner only).
 */
export async function updateReminderSetting(req: Request, res: Response): Promise<void> {
  const stage = String(req.params.stage || '').trim() as ReminderStage
  const { is_enabled, channel } = req.body ?? {}
  const supabase = getSupabaseAdmin()

  const validStages: ReminderStage[] = [
    'membership_expiry_7_days',
    'membership_expiry_1_day',
    'membership_expired',
    'payment_due',
    'payment_overdue',
  ]

  if (!validStages.includes(stage)) {
    res.status(400).json({ success: false, message: `Invalid reminder stage: ${stage}` })
    return
  }

  const updates: Partial<ReminderSettingRow> = {
    updated_at: new Date().toISOString(),
  }

  if (typeof is_enabled === 'boolean') {
    updates.is_enabled = is_enabled
  }

  if (channel === 'whatsapp' || channel === 'sms') {
    updates.channel = channel
  }

  try {
    const { data: updated, error } = await supabase
      .from('reminder_settings')
      .update(updates)
      .eq('reminder_stage', stage)
      .select()
      .single()

    if (error) throw error

    await logAuditEvent({
      actorId: req.authUser?.id,
      entityType: 'reminder_setting',
      entityId: updated.id,
      action: 'reminder_setting_updated',
      newData: {
        reminder_stage: updated.reminder_stage,
        is_enabled: updated.is_enabled,
        channel: updated.channel,
      },
    })

    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[remindersController] updateReminderSetting error', err)
    res.status(500).json({ success: false, message: 'Failed to update reminder setting.' })
  }
}

/**
 * GET /api/reminders/templates
 *
 * Returns all message templates.
 */
export async function getMessageTemplates(req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseAdmin()
  await ensureDefaultSettingsAndTemplates()

  try {
    const { data: templates, error } = await supabase
      .from('message_templates')
      .select('*')
      .order('reminder_stage')
      .order('channel')

    if (error) throw error

    res.json({ success: true, data: templates ?? [] })
  } catch (err) {
    console.error('[remindersController] getMessageTemplates error', err)
    res.status(500).json({ success: false, message: 'Failed to load message templates.' })
  }
}

/**
 * PATCH /api/reminders/templates/:id
 *
 * Updates message template body (Owner only).
 */
export async function updateMessageTemplate(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id || '').trim()
  const { body, is_active } = req.body ?? {}
  const supabase = getSupabaseAdmin()

  if (!id) {
    res.status(400).json({ success: false, message: 'Template ID is required.' })
    return
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (typeof body === 'string') {
    const trimmed = body.trim()
    if (!trimmed) {
      res.status(400).json({ success: false, message: 'Template body cannot be empty.' })
      return
    }
    updates.body = trimmed
  }

  if (typeof is_active === 'boolean') {
    updates.is_active = is_active
  }

  try {
    const { data: updated, error } = await supabase
      .from('message_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    await logAuditEvent({
      actorId: req.authUser?.id,
      entityType: 'message_template',
      entityId: updated.id,
      action: 'message_template_updated',
      newData: {
        reminder_stage: updated.reminder_stage,
        channel: updated.channel,
        is_active: updated.is_active,
      },
    })

    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[remindersController] updateMessageTemplate error', err)
    res.status(500).json({ success: false, message: 'Failed to update message template.' })
  }
}

/**
 * POST /api/reminders/preview-template
 *
 * Previews a template body with sample or real member data.
 */
export async function previewTemplate(req: Request, res: Response): Promise<void> {
  const { body, member_id } = req.body ?? {}
  if (typeof body !== 'string') {
    res.status(400).json({ success: false, message: 'Template body string is required.' })
    return
  }

  try {
    let context = getSampleTemplateContext()

    if (member_id) {
      const supabase = getSupabaseAdmin()
      const { data: member } = await supabase
        .from('members')
        .select('full_name')
        .eq('id', member_id)
        .single()

      if (member) {
        context.member_name = member.full_name
      }
    }

    const rendered = renderTemplate(body, context)
    res.json({
      success: true,
      data: {
        rendered,
        context,
      },
    })
  } catch (err) {
    console.error('[remindersController] previewTemplate error', err)
    res.status(500).json({ success: false, message: 'Failed to preview template.' })
  }
}

/**
 * POST /api/reminders/generate
 *
 * Triggers server-side reminder generation.
 */
export async function triggerGenerate(req: Request, res: Response): Promise<void> {
  try {
    const result = await generateReminders()
    res.json({
      success: true,
      message: `Scanned ${result.scannedCount} memberships. Generated ${result.generatedCount} new reminder(s).`,
      data: result,
    })
  } catch (err) {
    console.error('[remindersController] triggerGenerate error', err)
    res.status(500).json({ success: false, message: 'Failed to generate reminders.' })
  }
}

/**
 * POST /api/reminders/process
 *
 * Triggers processing of scheduled reminders.
 */
export async function triggerProcess(req: Request, res: Response): Promise<void> {
  const { simulateFailure, failureReason } = req.body ?? {}
  try {
    const result = await processReminders({
      simulateFailure: Boolean(simulateFailure),
      failureReason: typeof failureReason === 'string' ? failureReason : undefined,
    })
    res.json({
      success: true,
      message: `Processed ${result.processedCount} reminder(s). Sent: ${result.sentCount}, Failed: ${result.failedCount}.`,
      data: result,
    })
  } catch (err) {
    console.error('[remindersController] triggerProcess error', err)
    res.status(500).json({ success: false, message: 'Failed to process reminders.' })
  }
}

/**
 * POST /api/reminders/run
 *
 * Combined execution: runs generateReminders() followed by processReminders().
 */
export async function triggerRun(req: Request, res: Response): Promise<void> {
  try {
    const genResult = await generateReminders()
    const procResult = await processReminders()

    res.json({
      success: true,
      message: `Generated ${genResult.generatedCount} new reminder(s). Dispatched ${procResult.processedCount} reminder(s).`,
      data: {
        generation: genResult,
        processing: procResult,
      },
    })
  } catch (err) {
    console.error('[remindersController] triggerRun error', err)
    res.status(500).json({ success: false, message: 'Failed to run reminder engine.' })
  }
}

/**
 * POST /api/reminders/:id/send
 *
 * Dispatches a single scheduled reminder immediately.
 */
export async function sendReminder(req: Request, res: Response): Promise<void> {
  const reminderId = String(req.params.id || '').trim()
  const { simulateFailure, failureReason } = req.body ?? {}

  if (!reminderId) {
    res.status(400).json({ success: false, message: 'Reminder ID is required.' })
    return
  }

  try {
    const result = await processReminders({
      reminderId,
      simulateFailure: Boolean(simulateFailure),
      failureReason: typeof failureReason === 'string' ? failureReason : undefined,
    })

    if (result.processedCount === 0) {
      res.status(404).json({ success: false, message: 'Scheduled reminder not found or already sent.' })
      return
    }

    res.json({
      success: true,
      message: 'Reminder dispatched via simulated provider.',
      data: result.results[0],
    })
  } catch (err) {
    console.error('[remindersController] sendReminder error', err)
    res.status(500).json({ success: false, message: 'Failed to send reminder.' })
  }
}

/**
 * POST /api/reminders/:id/cancel
 *
 * Cancels a scheduled reminder.
 */
export async function cancelReminder(req: Request, res: Response): Promise<void> {
  const reminderId = String(req.params.id || '').trim()
  const supabase = getSupabaseAdmin()

  if (!reminderId) {
    res.status(400).json({ success: false, message: 'Reminder ID is required.' })
    return
  }

  try {
    const { data: existing, error: findErr } = await supabase
      .from('reminders')
      .select('id, status')
      .eq('id', reminderId)
      .single()

    if (findErr || !existing) {
      res.status(404).json({ success: false, message: 'Reminder not found.' })
      return
    }

    if (existing.status !== 'scheduled') {
      res.status(400).json({
        success: false,
        message: `Cannot cancel reminder with status "${existing.status}". Only scheduled reminders can be cancelled.`,
      })
      return
    }

    const { data: updated, error: updateErr } = await supabase
      .from('reminders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', reminderId)
      .select()
      .single()

    if (updateErr) throw updateErr

    res.json({ success: true, message: 'Reminder cancelled.', data: updated })
  } catch (err) {
    console.error('[remindersController] cancelReminder error', err)
    res.status(500).json({ success: false, message: 'Failed to cancel reminder.' })
  }
}

/**
 * GET /api/members/:memberId/reminders
 *
 * Returns reminders and message history for a specific member.
 */
export async function getMemberReminders(req: Request, res: Response): Promise<void> {
  const memberId = String(req.params.memberId || req.params.id || '').trim()
  const supabase = getSupabaseAdmin()

  if (!memberId) {
    res.status(400).json({ success: false, message: 'Member ID is required.' })
    return
  }

  try {
    const [remindersRes, historyRes] = await Promise.all([
      supabase
        .from('reminders')
        .select('*')
        .eq('member_id', memberId)
        .order('scheduled_at', { ascending: false }),
      supabase
        .from('message_history')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false }),
    ])

    if (remindersRes.error) throw remindersRes.error
    if (historyRes.error) throw historyRes.error

    res.json({
      success: true,
      data: {
        reminders: (remindersRes.data ?? []).map(r => ({ ...r, is_simulated: true })),
        history: (historyRes.data ?? []).map(h => ({ ...h, is_simulated: true })),
      },
    })
  } catch (err) {
    console.error('[remindersController] getMemberReminders error', err)
    res.status(500).json({ success: false, message: 'Failed to load member reminders.' })
  }
}
