import { getSupabaseAdmin } from '../database/supabaseAdmin.js'
import { getNotificationProvider } from './notificationProvider.js'
import type {
  NotificationProvider,
  NotificationProviderResult,
} from './types.js'
import type {
  ReminderChannel,
  ReminderStage,
  ReminderStatus,
  TemplateContext,
} from '../../types/reminders.js'

export interface DispatchReminderInput {
  reminderId?: string | null
  memberId: string
  membershipId: string
  reminderStage: ReminderStage
  channel: ReminderChannel
  recipientPhone: string
  message: string
  scheduledAt: string
  templateContext?: TemplateContext
  simulateFailure?: boolean
  failureReason?: string
  bypassOptInCheck?: boolean
}

export interface DispatchReminderOutput {
  providerResult: NotificationProviderResult
  historyId?: string
  status: ReminderStatus
}

export class NotificationService {
  constructor(private customProvider?: NotificationProvider) {}

  /**
   * Returns the active provider (either custom-injected or resolved via environment factory).
   */
  getProvider(): NotificationProvider {
    return this.customProvider ?? getNotificationProvider()
  }

  /**
   * Injects or clears a custom provider for testing or specialized execution.
   */
  setCustomProvider(provider: NotificationProvider | null): void {
    this.customProvider = provider ?? undefined
  }

  /**
   * Dispatches a single reminder:
   * 1. Verifies WhatsApp opt-in for the recipient.
   * 2. Calls provider to send (Mock or real Meta Cloud API).
   * 3. Writes an immutable audit record to public.message_history.
   * 4. Updates public.reminders table if linked.
   */
  async dispatchReminder(input: DispatchReminderInput): Promise<DispatchReminderOutput> {
    const supabase = getSupabaseAdmin()

    // 1. Verify WhatsApp opt-in consent if channel is WhatsApp
    if (input.channel === 'whatsapp' && !input.bypassOptInCheck) {
      let { data: member, error: memberErr } = await supabase
        .from('members')
        .select('id, notes, status, whatsapp_opt_in')
        .eq('id', input.memberId)
        .single()

      // Fallback if migration 006 column is not yet queried on older schema
      if (memberErr && memberErr.message?.includes('whatsapp_opt_in')) {
        const fallbackRes = await supabase
          .from('members')
          .select('id, notes, status')
          .eq('id', input.memberId)
          .single()
        member = fallbackRes.data as any
        memberErr = fallbackRes.error
      }

      if (memberErr || !member) {
        const failureReason = `Recipient member "${input.memberId}" not found in database.`
        return this.recordFailure(input, failureReason)
      }

      // Check explicit whatsapp_opt_in or fallback notes tag
      // We also check if member object has whatsapp_opt_in property directly
      const hasOptIn =
        (member as any).whatsapp_opt_in === true ||
        (member.notes && member.notes.includes('[opt_in:whatsapp]'))

      if (!hasOptIn) {
        const failureReason =
          'WhatsApp reminder blocked: Member has not opted in to WhatsApp messaging.'
        return this.recordFailure(input, failureReason)
      }
    }

    // 2. Dispatch via active notification provider
    const provider = this.getProvider()
    const providerResult = await provider.send({
      memberId: input.memberId,
      recipientPhone: input.recipientPhone,
      channel: input.channel,
      message: input.message,
      reminderStage: input.reminderStage,
      scheduledAt: input.scheduledAt,
      templateContext: input.templateContext,
      simulateFailure: input.simulateFailure,
      failureReason: input.failureReason,
    })

    // 3. Insert immutable record into message_history
    const { data: historyRow, error: historyErr } = await supabase
      .from('message_history')
      .insert({
        reminder_id: input.reminderId || null,
        member_id: input.memberId,
        membership_id: input.membershipId,
        reminder_stage: input.reminderStage,
        channel: input.channel,
        message: input.message,
        scheduled_at: input.scheduledAt,
        sent_at: providerResult.sentAt,
        status: providerResult.status,
        provider_message_id: providerResult.providerMessageId,
        failure_reason: providerResult.failureReason,
      })
      .select('id')
      .single()

    if (historyErr) {
      console.error('[NotificationService] Failed to insert message_history row:', historyErr)
    }

    // 4. Update the reminder row status if reminderId is provided
    if (input.reminderId) {
      const { error: reminderUpdateErr } = await supabase
        .from('reminders')
        .update({
          status: providerResult.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.reminderId)

      if (reminderUpdateErr) {
        console.error('[NotificationService] Failed to update reminder status:', reminderUpdateErr)
      }
    }

    return {
      providerResult,
      historyId: historyRow?.id,
      status: providerResult.status,
    }
  }

  /**
   * Helper to safely record a pre-dispatch failure (e.g. opt-in rejection or invalid phone).
   */
  private async recordFailure(
    input: DispatchReminderInput,
    reason: string,
  ): Promise<DispatchReminderOutput> {
    const supabase = getSupabaseAdmin()
    const providerResult: NotificationProviderResult = {
      success: false,
      status: 'failed',
      providerMessageId: `blocked-${Date.now()}`,
      sentAt: null,
      failureReason: reason,
      isSimulated: this.getProvider().name === 'mock',
    }

    const { data: historyRow } = await supabase
      .from('message_history')
      .insert({
        reminder_id: input.reminderId || null,
        member_id: input.memberId,
        membership_id: input.membershipId,
        reminder_stage: input.reminderStage,
        channel: input.channel,
        message: input.message,
        scheduled_at: input.scheduledAt,
        sent_at: null,
        status: 'failed',
        provider_message_id: providerResult.providerMessageId,
        failure_reason: reason,
      })
      .select('id')
      .single()

    if (input.reminderId) {
      await supabase
        .from('reminders')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.reminderId)
    }

    return {
      providerResult,
      historyId: historyRow?.id,
      status: 'failed',
    }
  }
}

export const notificationService = new NotificationService()
