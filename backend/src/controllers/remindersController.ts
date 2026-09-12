import type { Request, Response } from 'express'
import { env } from '../config/env.js'
import { getSupabaseAdmin } from '../services/database/supabaseAdmin.js'
import { logAuditEvent } from '../services/audit/auditService.js'
import { notificationService } from '../services/notifications/notificationService.js'
import {
  ensureDefaultSettingsAndTemplates,
  generateReminders,
  processReminders,
} from '../services/reminders/reminderEngine.js'
import {
  DEFAULT_TEMPLATES,
  getSampleTemplateContext,
  renderTemplate,
} from '../services/reminders/templateEngine.js'
import {
  isMembershipActive,
  selectCurrentMembership,
} from '../utils/membershipStatus.js'
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
  TemplateContext,
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
        is_simulated: env.messagingProvider === 'mock',
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
        is_simulated: h.provider_message_id?.startsWith('mock-') ?? (env.messagingProvider === 'mock'),
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
      message: 'Reminder dispatched.',
      data: result.results[0],
    })
  } catch (err) {
    console.error('[remindersController] sendReminder error', err)
    res.status(500).json({ success: false, message: 'Failed to send reminder.' })
  }
}

/**
 * POST /api/reminders/:id/retry
 *
 * Retries a failed reminder. Permitted for both Owner and Trainer.
 */
export async function retryReminder(req: Request, res: Response): Promise<void> {
  const reminderId = String(req.params.id || '').trim()
  const { simulateFailure, failureReason } = req.body ?? {}
  const supabase = getSupabaseAdmin()

  if (!reminderId) {
    res.status(400).json({ success: false, message: 'Reminder ID is required.' })
    return
  }

  try {
    const { data: rem, error: fetchErr } = await supabase
      .from('reminders')
      .select('*')
      .eq('id', reminderId)
      .maybeSingle()

    if (fetchErr || !rem) {
      res.status(404).json({ success: false, message: 'Reminder not found.' })
      return
    }

    if (rem.status !== 'failed') {
      res.status(400).json({
        success: false,
        message: `Only failed reminders can be retried. Current status is "${rem.status}".`,
      })
      return
    }

    // Reset reminder to 'scheduled' and dispatch
    await supabase
      .from('reminders')
      .update({ status: 'scheduled', updated_at: new Date().toISOString() })
      .eq('id', reminderId)

    const result = await processReminders({
      reminderId,
      simulateFailure: Boolean(simulateFailure),
      failureReason: typeof failureReason === 'string' ? failureReason : undefined,
    })

    if (result.processedCount === 0) {
      res.status(500).json({ success: false, message: 'Failed to process reminder retry.' })
      return
    }

    res.json({
      success: true,
      message: 'Reminder retry dispatched.',
      data: result.results[0],
    })
  } catch (err) {
    console.error('[remindersController] retryReminder error', err)
    res.status(500).json({ success: false, message: 'Failed to retry reminder.' })
  }
}

/**
 * In-flight lock set to prevent concurrent duplicate manual requests
 * for the same member + membership + reminder stage.
 */
const inFlightManualSends = new Set<string>()

/**
 * Cooldown window (in milliseconds) to prevent rapid duplicate manual sends
 * for the same member, membership, and stage after a successful send.
 */
const RAPID_DUPLICATE_COOLDOWN_MS = 60 * 1000 // 60 seconds

/**
 * POST /api/reminders/manual
 *
 * Sends a manual WhatsApp reminder for a member's active membership.
 * Permitted for both Owner and Trainer. Respects WhatsApp opt-in.
 */
export async function manualSendReminder(req: Request, res: Response): Promise<void> {
  const memberId = String(req.body?.memberId || req.body?.member_id || '').trim()
  const reminderStage = String(req.body?.reminderStage || req.body?.stage || '').trim()
  const providedMembershipId = req.body?.membershipId || req.body?.membership_id
    ? String(req.body?.membershipId || req.body?.membership_id).trim()
    : undefined
  const supabase = getSupabaseAdmin()

  if (!memberId || !reminderStage) {
    res.status(400).json({
      success: false,
      message: 'memberId and reminderStage are required.',
    })
    return
  }

  if (!DEFAULT_TEMPLATES[reminderStage as ReminderStage]) {
    res.status(400).json({
      success: false,
      message: 'Invalid reminder stage.',
    })
    return
  }

  try {
    // 1. Fetch member details
    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select('*')
      .eq('id', memberId)
      .single()

    if (memberErr || !member) {
      res.status(404).json({ success: false, message: 'Member not found.' })
      return
    }

    // 2. Fetch all memberships for this member with plan details
    const { data: rawMemberships, error: msErr } = await supabase
      .from('memberships')
      .select('*, membership_plans(name)')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })

    if (msErr) throw msErr

    const memberships = (rawMemberships ?? []) as any[]

    // 3. Resolve active membership using centralized lifecycle logic
    let targetMembership: any = null

    if (providedMembershipId) {
      const found = memberships.find(m => m.id === providedMembershipId)
      if (!found) {
        // Check if this membership belongs to someone else
        const { data: otherMs } = await supabase
          .from('memberships')
          .select('id, member_id')
          .eq('id', providedMembershipId)
          .single()

        if (otherMs && otherMs.member_id !== memberId) {
          res.status(400).json({
            success: false,
            message: 'Membership does not belong to the requested member.',
          })
          return
        }

        res.status(404).json({ success: false, message: 'Membership not found.' })
        return
      }

      if (!isMembershipActive(found)) {
        res.status(400).json({
          success: false,
          message: 'This member does not have an active membership.',
        })
        return
      }

      targetMembership = found
    } else {
      targetMembership = selectCurrentMembership(memberships)
    }

    if (!targetMembership) {
      res.status(400).json({
        success: false,
        message: 'This member does not have an active membership.',
      })
      return
    }

    // Validate that the resolved membership actually belongs to the requested member
    if (targetMembership.member_id !== memberId) {
      res.status(400).json({
        success: false,
        message: 'Membership does not belong to the requested member.',
      })
      return
    }

    const ms = targetMembership
    const resolvedMembershipId = ms.id
    const planName = Array.isArray(ms.membership_plans)
      ? ms.membership_plans[0]?.name
      : ms.membership_plans?.name || 'Membership'

    // 4. Duplicate / In-flight Concurrency Protection
    const sendKey = `${memberId}:${resolvedMembershipId}:${reminderStage}`

    if (inFlightManualSends.has(sendKey)) {
      res.status(409).json({
        success: false,
        message: 'A reminder request for this member and stage is currently being processed.',
      })
      return
    }

    // Check recent message history for duplicate within cooldown window (successful sends only)
    const { data: recentHistory } = await supabase
      .from('message_history')
      .select('id, status, created_at')
      .eq('member_id', memberId)
      .eq('membership_id', resolvedMembershipId)
      .eq('reminder_stage', reminderStage)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recentHistory && ['sent', 'delivered', 'read'].includes(recentHistory.status)) {
      const elapsedMs = Date.now() - new Date(recentHistory.created_at).getTime()
      if (elapsedMs < RAPID_DUPLICATE_COOLDOWN_MS) {
        res.status(409).json({
          success: false,
          message: 'A WhatsApp reminder for this stage was already sent recently. Please wait before sending again.',
        })
        return
      }
    }

    // Acquire in-flight lock
    inFlightManualSends.add(sendKey)

    try {
      // Find or create entry in reminders table to synchronize with reminder engine
      const { data: existingReminder } = await supabase
        .from('reminders')
        .select('*')
        .eq('member_id', memberId)
        .eq('membership_id', resolvedMembershipId)
        .eq('reminder_stage', reminderStage)
        .maybeSingle()

      let reminderId = existingReminder?.id
      if (!reminderId) {
        const { data: newRem, error: remInsertErr } = await supabase
          .from('reminders')
          .insert({
            member_id: memberId,
            membership_id: resolvedMembershipId,
            reminder_stage: reminderStage,
            channel: 'whatsapp',
            scheduled_at: new Date().toISOString(),
            status: 'scheduled',
          })
          .select('id')
          .maybeSingle()

        if (newRem) {
          reminderId = newRem.id
        } else if (remInsertErr?.code === '23505') {
          res.status(409).json({
            success: false,
            message: 'A reminder request for this member and stage is currently being processed.',
          })
          return
        }
      } else if (existingReminder.status === 'failed') {
        await supabase
          .from('reminders')
          .update({ status: 'scheduled', updated_at: new Date().toISOString() })
          .eq('id', reminderId)
      }

      // 5. Compute pending dues
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('membership_id', resolvedMembershipId)

      const totalPaid = (payments ?? []).reduce((acc: number, p: any) => acc + Number(p.amount), 0)
      const pendingAmount = Math.max(0, Math.round((Number(ms.actual_fee) - totalPaid) * 100) / 100)

      // 6. Build TemplateContext
      const context: TemplateContext = {
        member_name: member.full_name,
        membership_plan: planName,
        expiry_date: ms.expiry_date ?? '—',
        pending_amount: pendingAmount.toLocaleString('en-IN'),
        payment_due_date: ms.payment_due_date ?? '—',
        gym_name: 'Iron Paradise Gym',
      }

      const templateBody =
        DEFAULT_TEMPLATES[reminderStage as ReminderStage]?.whatsapp ||
        'Reminder from Iron Paradise Gym'
      const renderedMessage = renderTemplate(templateBody, context)

      // 7. Dispatch via NotificationService
      const dispatchRes = await notificationService.dispatchReminder({
        reminderId,
        memberId,
        membershipId: resolvedMembershipId,
        reminderStage: reminderStage as ReminderStage,
        channel: 'whatsapp',
        recipientPhone: member.phone,
        message: renderedMessage,
        scheduledAt: new Date().toISOString(),
        templateContext: context,
        simulateFailure: Boolean(req.body?.simulateFailure),
        failureReason: typeof req.body?.failureReason === 'string' ? req.body.failureReason : undefined,
      })

      if (dispatchRes.status === 'failed') {
        res.status(400).json({
          success: false,
          message: dispatchRes.providerResult.failureReason || 'Failed to dispatch WhatsApp reminder.',
          data: dispatchRes.providerResult,
        })
        return
      }

      res.json({
        success: true,
        message: 'WhatsApp reminder sent successfully.',
        data: dispatchRes.providerResult,
      })
    } finally {
      inFlightManualSends.delete(sendKey)
    }
  } catch (err) {
    console.error('[remindersController] manualSendReminder error', err)
    res.status(500).json({ success: false, message: 'Failed to send manual reminder.' })
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
        reminders: (remindersRes.data ?? []).map(r => ({
          ...r,
          is_simulated: env.messagingProvider === 'mock',
        })),
        history: (historyRes.data ?? []).map(h => ({
          ...h,
          is_simulated:
            h.provider_message_id?.startsWith('mock-') ??
            (env.messagingProvider === 'mock'),
        })),
      },
    })
  } catch (err) {
    console.error('[remindersController] getMemberReminders error', err)
    res.status(500).json({ success: false, message: 'Failed to load member reminders.' })
  }
}
