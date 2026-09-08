import { getSupabaseAdmin } from '../database/supabaseAdmin.js'
import {
  type NotificationProvider,
  type NotificationProviderResult,
  mockNotificationProvider,
} from './mockNotificationProvider.js'
import type {
  ReminderChannel,
  ReminderStage,
  ReminderStatus,
} from '../../types/reminders.js'

export interface DispatchReminderInput {
  reminderId: string
  memberId: string
  membershipId: string
  reminderStage: ReminderStage
  channel: ReminderChannel
  recipientPhone: string
  message: string
  scheduledAt: string
  simulateFailure?: boolean
  failureReason?: string
}

export interface DispatchReminderOutput {
  providerResult: NotificationProviderResult
  historyId?: string
  status: ReminderStatus
}

export class NotificationService {
  constructor(private provider: NotificationProvider = mockNotificationProvider) {}

  /**
   * Dispatches a single reminder:
   * 1. Calls provider to send (simulated).
   * 2. Writes an immutable audit record to message_history.
   * 3. Updates reminders table with the outcome status.
   */
  async dispatchReminder(input: DispatchReminderInput): Promise<DispatchReminderOutput> {
    const supabase = getSupabaseAdmin()

    // 1. Send via provider
    const providerResult = await this.provider.send({
      memberId: input.memberId,
      recipientPhone: input.recipientPhone,
      channel: input.channel,
      message: input.message,
      reminderStage: input.reminderStage,
      scheduledAt: input.scheduledAt,
      simulateFailure: input.simulateFailure,
      failureReason: input.failureReason,
    })

    // 2. Insert immutable audit row into message_history
    const { data: historyRow, error: historyErr } = await supabase
      .from('message_history')
      .insert({
        reminder_id: input.reminderId,
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

    // 3. Update the reminder row status
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

    return {
      providerResult,
      historyId: historyRow?.id,
      status: providerResult.status,
    }
  }
}

export const notificationService = new NotificationService()
