/**
 * Part 9: Automated Reminders & Message History types
 */

export type ReminderStage =
  | 'membership_expiry_7_days'
  | 'membership_expiry_1_day'
  | 'membership_expired'
  | 'payment_due'
  | 'payment_overdue'

export type ReminderChannel = 'whatsapp' | 'sms'

export type ReminderStatus =
  | 'scheduled'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled'

export interface ReminderSettingRow {
  id: string
  reminder_stage: ReminderStage
  is_enabled: boolean
  channel: ReminderChannel
  /** When false the engine will not auto-schedule this stage; manual send is still allowed. */
  auto_generate: boolean
  /** Max automatic retries per failed reminder per day (0–10). */
  max_retries: number
  created_at: string
  updated_at: string
}

export interface MessageTemplateRow {
  id: string
  reminder_stage: ReminderStage
  channel: ReminderChannel
  body: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ReminderRow {
  id: string
  member_id: string
  membership_id: string
  template_id: string | null
  reminder_stage: ReminderStage
  channel: ReminderChannel
  scheduled_at: string
  status: ReminderStatus
  created_at: string
  updated_at: string
}

export interface ReminderWithDetails extends ReminderRow {
  member_name: string
  member_code: string
  member_phone: string
  plan_name: string
  expiry_date?: string
  payment_due_date?: string | null
  pending_amount?: number
  is_simulated: boolean
}

export interface MessageHistoryRow {
  id: string
  reminder_id: string | null
  member_id: string
  membership_id: string
  reminder_stage: ReminderStage
  channel: ReminderChannel
  message: string
  scheduled_at: string
  sent_at: string | null
  status: ReminderStatus
  provider_message_id: string | null
  failure_reason: string | null
  created_at: string
}

export interface MessageHistoryWithDetails extends MessageHistoryRow {
  member_name: string
  member_code: string
  member_phone: string
  plan_name: string
  is_simulated: boolean
}

export interface ReminderStatsSummary {
  scheduledCount: number
  sentCount: number
  failedCount: number
  cancelledCount: number
  totalCount: number
}

export interface TemplateContext {
  member_name: string
  membership_plan: string
  expiry_date: string
  pending_amount: string | number
  payment_due_date: string
  gym_name: string
}

export interface ReminderGenerationResult {
  scannedCount: number
  generatedCount: number
  skippedCount: number
  errors: string[]
}

export interface ReminderProcessResult {
  processedCount: number
  sentCount: number
  failedCount: number
  results: Array<{
    reminderId: string
    status: ReminderStatus
    providerMessageId?: string
    failureReason?: string
  }>
}
