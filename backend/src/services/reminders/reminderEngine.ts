import { getSupabaseAdmin } from '../database/supabaseAdmin.js'
import { notificationService } from '../notifications/notificationService.js'
import {
  DEFAULT_TEMPLATES,
  renderTemplate,
} from './templateEngine.js'
import type {
  ReminderChannel,
  ReminderGenerationResult,
  ReminderProcessResult,
  ReminderRow,
  ReminderSettingRow,
  ReminderStage,
  ReminderStatus,
  TemplateContext,
} from '../../types/reminders.js'

const ALL_STAGES: ReminderStage[] = [
  'membership_expiry_7_days',
  'membership_expiry_1_day',
  'membership_expired',
  'payment_due',
  'payment_overdue',
]

function getIsoDate(offsetDays = 0): string {
  const d = new Date()
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays)
  }
  return d.toISOString().split('T')[0]
}

/**
 * Ensures default reminder_settings and message_templates exist in Supabase.
 * Safe and idempotent to run on every startup or scan.
 */
export async function ensureDefaultSettingsAndTemplates(): Promise<void> {
  const supabase = getSupabaseAdmin()

  // 1. Check & seed reminder_settings
  const { data: existingSettings } = await supabase
    .from('reminder_settings')
    .select('reminder_stage')

  const existingStageSet = new Set(
    (existingSettings ?? []).map((s: { reminder_stage: string }) => s.reminder_stage),
  )

  const missingSettings = ALL_STAGES.filter(stage => !existingStageSet.has(stage)).map(stage => ({
    reminder_stage: stage,
    is_enabled: true,
    channel: 'whatsapp' as ReminderChannel,
  }))

  if (missingSettings.length > 0) {
    const { error: seedSettingsErr } = await supabase
      .from('reminder_settings')
      .insert(missingSettings)
    if (seedSettingsErr) {
      console.error('[ReminderEngine] Error seeding reminder_settings:', seedSettingsErr)
    }
  }

  // 2. Check & seed message_templates
  const { data: existingTemplates } = await supabase
    .from('message_templates')
    .select('reminder_stage, channel')

  const existingTemplateKeys = new Set(
    (existingTemplates ?? []).map(
      (t: { reminder_stage: string; channel: string }) => `${t.reminder_stage}:${t.channel}`,
    ),
  )

  const missingTemplates: Array<{
    reminder_stage: ReminderStage
    channel: ReminderChannel
    body: string
    is_active: boolean
  }> = []

  for (const stage of ALL_STAGES) {
    for (const channel of ['whatsapp', 'sms'] as ReminderChannel[]) {
      const key = `${stage}:${channel}`
      if (!existingTemplateKeys.has(key)) {
        missingTemplates.push({
          reminder_stage: stage,
          channel,
          body: DEFAULT_TEMPLATES[stage][channel],
          is_active: true,
        })
      }
    }
  }

  if (missingTemplates.length > 0) {
    const { error: seedTemplatesErr } = await supabase
      .from('message_templates')
      .insert(missingTemplates)
    if (seedTemplatesErr) {
      console.error('[ReminderEngine] Error seeding message_templates:', seedTemplatesErr)
    }
  }
}

/**
 * Server-side reminder generation engine.
 *
 * Scans memberships and payment balances to identify members matching
 * reminder stages, checks idempotency constraints, and creates 'scheduled' reminders.
 */
export async function generateReminders(): Promise<ReminderGenerationResult> {
  const supabase = getSupabaseAdmin()
  const today = getIsoDate(0)
  const in7Days = getIsoDate(7)
  const in1Day = getIsoDate(1)

  await ensureDefaultSettingsAndTemplates()

  // 1. Fetch enabled reminder settings
  const { data: settingsRows, error: settingsErr } = await supabase
    .from('reminder_settings')
    .select('*')

  if (settingsErr) throw settingsErr

  const settingsMap = new Map<ReminderStage, ReminderSettingRow>()
  for (const s of (settingsRows ?? []) as ReminderSettingRow[]) {
    settingsMap.set(s.reminder_stage, s)
  }

  // 2. Fetch all message templates
  const { data: templatesRows, error: templatesErr } = await supabase
    .from('message_templates')
    .select('*')
    .eq('is_active', true)

  if (templatesErr) throw templatesErr

  const templateLookup = new Map<string, { id: string; body: string }>()
  for (const t of (templatesRows ?? []) as Array<{
    id: string
    reminder_stage: ReminderStage
    channel: ReminderChannel
    body: string
  }>) {
    templateLookup.set(`${t.reminder_stage}:${t.channel}`, { id: t.id, body: t.body })
  }

  // 3. Fetch existing reminders to enforce strict idempotency
  const { data: existingReminders, error: remErr } = await supabase
    .from('reminders')
    .select('member_id, membership_id, reminder_stage')

  if (remErr) throw remErr

  const existingRemKeySet = new Set(
    (existingReminders ?? []).map(
      (r: { member_id: string; membership_id: string; reminder_stage: string }) =>
        `${r.member_id}:${r.membership_id}:${r.reminder_stage}`,
    ),
  )

  // 4. Fetch memberships, members, and payment sums
  const [membershipsRes, paymentsRes] = await Promise.all([
    supabase
      .from('memberships')
      .select(
        'id, member_id, actual_fee, payment_due_date, expiry_date, status, membership_plans(name), members(id, full_name, member_code, phone, status)',
      ),
    supabase.from('payments').select('membership_id, amount'),
  ])

  if (membershipsRes.error) throw membershipsRes.error
  if (paymentsRes.error) throw paymentsRes.error

  const paidByMembership = new Map<string, number>()
  for (const p of (paymentsRes.data ?? []) as unknown as Array<{
    membership_id: string
    amount: number
  }>) {
    paidByMembership.set(
      p.membership_id,
      (paidByMembership.get(p.membership_id) ?? 0) + Number(p.amount),
    )
  }

  interface RawMembership {
    id: string
    member_id: string
    actual_fee: number
    payment_due_date: string | null
    expiry_date: string
    status: string
    membership_plans: { name: string } | { name: string }[] | null
    members: {
      id: string
      full_name: string
      member_code: string
      phone: string
      status: string
    } | null
  }

  const rawMemberships = (membershipsRes.data ?? []) as unknown as RawMembership[]
  const errors: string[] = []
  let generatedCount = 0
  let skippedCount = 0
  const remindersToInsert: Array<{
    member_id: string
    membership_id: string
    template_id: string | null
    reminder_stage: ReminderStage
    channel: ReminderChannel
    scheduled_at: string
    status: ReminderStatus
  }> = []

  for (const ms of rawMemberships) {
    const member = ms.members
    if (!member || member.status !== 'active') {
      continue
    }

    const planObj = Array.isArray(ms.membership_plans)
      ? ms.membership_plans[0]
      : ms.membership_plans
    const planName = planObj?.name ?? 'Standard Plan'
    const actualFee = Number(ms.actual_fee)
    const paid = paidByMembership.get(ms.id) ?? 0
    const pendingAmount = Math.max(0, Math.round((actualFee - paid) * 100) / 100)

    // Evaluate each of the 5 stages
    const candidateStages: ReminderStage[] = []

    // 1. 7 days before expiry
    if (ms.status === 'active' && ms.expiry_date === in7Days) {
      candidateStages.push('membership_expiry_7_days')
    }

    // 2. 1 day before expiry
    if (ms.status === 'active' && ms.expiry_date === in1Day) {
      candidateStages.push('membership_expiry_1_day')
    }

    // 3. After expiry
    if (ms.status === 'expired' || ms.expiry_date < today) {
      candidateStages.push('membership_expired')
    }

    // 4. Payment due
    if (
      pendingAmount > 0.005 &&
      ms.payment_due_date &&
      ms.payment_due_date === today
    ) {
      candidateStages.push('payment_due')
    }

    // 5. Payment overdue
    if (
      pendingAmount > 0.005 &&
      ms.payment_due_date &&
      ms.payment_due_date < today
    ) {
      candidateStages.push('payment_overdue')
    }

    for (const stage of candidateStages) {
      const setting = settingsMap.get(stage)
      if (!setting || !setting.is_enabled) {
        skippedCount++
        continue
      }

      const dedupeKey = `${member.id}:${ms.id}:${stage}`
      if (existingRemKeySet.has(dedupeKey)) {
        skippedCount++
        continue
      }

      // Channel preference
      const channel = setting.channel || 'whatsapp'
      const template = templateLookup.get(`${stage}:${channel}`)

      remindersToInsert.push({
        member_id: member.id,
        membership_id: ms.id,
        template_id: template?.id ?? null,
        reminder_stage: stage,
        channel,
        scheduled_at: new Date().toISOString(),
        status: 'scheduled',
      })

      // Mark in set to prevent duplicate candidates in same run
      existingRemKeySet.add(dedupeKey)
    }
  }

  if (remindersToInsert.length > 0) {
    const { data: inserted, error: insertErr } = await supabase
      .from('reminders')
      .insert(remindersToInsert)
      .select('id')

    if (insertErr) {
      console.error('[ReminderEngine] insert error:', insertErr)
      errors.push(insertErr.message)
    } else {
      generatedCount = inserted?.length ?? remindersToInsert.length
    }
  }

  return {
    scannedCount: rawMemberships.length,
    generatedCount,
    skippedCount,
    errors,
  }
}

/**
 * Processes scheduled reminders that are ready to send.
 * Dispatches via NotificationService (which logs immutable message_history).
 */
export async function processReminders(options?: {
  reminderId?: string
  simulateFailure?: boolean
  failureReason?: string
}): Promise<ReminderProcessResult> {
  const supabase = getSupabaseAdmin()

  let query = supabase
    .from('reminders')
    .select('*')
    .eq('status', 'scheduled')

  if (options?.reminderId) {
    query = query.eq('id', options.reminderId)
  }

  const { data: scheduledReminders, error: fetchErr } = await query
  if (fetchErr) throw fetchErr

  const remRows = (scheduledReminders ?? []) as ReminderRow[]
  if (remRows.length === 0) {
    return {
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      results: [],
    }
  }

  const uniqueMemberIds = [...new Set(remRows.map(r => r.member_id))]
  const uniqueMembershipIds = [...new Set(remRows.map(r => r.membership_id))]
  const uniqueTemplateIds = [
    ...new Set(remRows.map(r => r.template_id).filter((id): id is string => Boolean(id))),
  ]

  const [membersRes, membershipsRes, templatesRes, paymentsRes] = await Promise.all([
    uniqueMemberIds.length > 0
      ? supabase.from('members').select('id, full_name, member_code, phone').in('id', uniqueMemberIds)
      : { data: [] },
    uniqueMembershipIds.length > 0
      ? supabase.from('memberships').select('id, actual_fee, expiry_date, payment_due_date, membership_plans(name)').in('id', uniqueMembershipIds)
      : { data: [] },
    uniqueTemplateIds.length > 0
      ? supabase.from('message_templates').select('id, body').in('id', uniqueTemplateIds)
      : { data: [] },
    uniqueMembershipIds.length > 0
      ? supabase.from('payments').select('membership_id, amount').in('membership_id', uniqueMembershipIds)
      : { data: [] },
  ])

  const memberLookup = new Map<string, { full_name: string; member_code: string; phone: string }>()
  for (const m of (membersRes.data ?? []) as unknown as Array<{ id: string; full_name: string; member_code: string; phone: string }>) {
    memberLookup.set(m.id, m)
  }

  const membershipLookup = new Map<
    string,
    { actual_fee: number; expiry_date: string; payment_due_date: string | null; plan_name: string }
  >()
  for (const ms of (membershipsRes.data ?? []) as unknown as Array<{
    id: string
    actual_fee: number
    expiry_date: string
    payment_due_date: string | null
    membership_plans: { name: string } | { name: string }[] | null
  }>) {
    const p = Array.isArray(ms.membership_plans) ? ms.membership_plans[0] : ms.membership_plans
    membershipLookup.set(ms.id, {
      actual_fee: Number(ms.actual_fee),
      expiry_date: ms.expiry_date,
      payment_due_date: ms.payment_due_date,
      plan_name: p?.name ?? 'Standard Plan',
    })
  }

  const templateLookup = new Map<string, string>()
  for (const t of (templatesRes.data ?? []) as unknown as Array<{ id: string; body: string }>) {
    templateLookup.set(t.id, t.body)
  }

  const paidByMembership = new Map<string, number>()
  for (const p of (paymentsRes.data ?? []) as unknown as Array<{ membership_id: string; amount: number }>) {
    paidByMembership.set(
      p.membership_id,
      (paidByMembership.get(p.membership_id) ?? 0) + Number(p.amount),
    )
  }

  let sentCount = 0
  let failedCount = 0
  const results: ReminderProcessResult['results'] = []

  for (const rem of remRows) {
    const member = memberLookup.get(rem.member_id)
    const ms = membershipLookup.get(rem.membership_id)

    if (!member) {
      continue
    }

    const planName = ms?.plan_name ?? 'Membership'
    const actualFee = ms?.actual_fee ?? 0
    const paid = paidByMembership.get(rem.membership_id) ?? 0
    const pendingAmount = Math.max(0, Math.round((actualFee - paid) * 100) / 100)

    const context: TemplateContext = {
      member_name: member.full_name,
      membership_plan: planName,
      expiry_date: ms?.expiry_date ?? '—',
      pending_amount: pendingAmount.toLocaleString('en-IN'),
      payment_due_date: ms?.payment_due_date ?? '—',
      gym_name: 'Iron Paradise Gym',
    }

    const templateBody =
      (rem.template_id ? templateLookup.get(rem.template_id) : null) ||
      DEFAULT_TEMPLATES[rem.reminder_stage]?.[rem.channel] ||
      'Reminder from Iron Paradise Gym'

    const renderedMessage = renderTemplate(templateBody, context)

    const dispatchRes = await notificationService.dispatchReminder({
      reminderId: rem.id,
      memberId: rem.member_id,
      membershipId: rem.membership_id,
      reminderStage: rem.reminder_stage,
      channel: rem.channel,
      recipientPhone: member.phone,
      message: renderedMessage,
      scheduledAt: rem.scheduled_at,
      simulateFailure: options?.simulateFailure,
      failureReason: options?.failureReason,
    })

    if (dispatchRes.status === 'sent' || dispatchRes.status === 'delivered') {
      sentCount++
    } else {
      failedCount++
    }

    results.push({
      reminderId: rem.id,
      status: dispatchRes.status,
      providerMessageId: dispatchRes.providerResult.providerMessageId,
      failureReason: dispatchRes.providerResult.failureReason ?? undefined,
    })
  }

  return {
    processedCount: remRows.length,
    sentCount,
    failedCount,
    results,
  }
}
