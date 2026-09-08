/**
 * Part 9: Frontend types for Automated Reminders & Message History
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
  | 'failed'
  | 'cancelled'

export interface ReminderSetting {
  id: string
  reminder_stage: ReminderStage
  is_enabled: boolean
  channel: ReminderChannel
  created_at: string
  updated_at: string
}

export interface MessageTemplate {
  id: string
  reminder_stage: ReminderStage
  channel: ReminderChannel
  body: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ReminderItem {
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
  member_name: string
  member_code: string
  member_phone: string
  plan_name: string
  expiry_date?: string
  payment_due_date?: string | null
  is_simulated: boolean
}

export interface MessageHistoryItem {
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

export interface RemindersListResponse {
  reminders: ReminderItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  stats: ReminderStatsSummary
}

export interface MessageHistoryResponse {
  history: MessageHistoryItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface MemberRemindersResponse {
  reminders: ReminderItem[]
  history: MessageHistoryItem[]
}

export interface ReminderFilters {
  q?: string
  stage?: string
  status?: string
  channel?: string
  page?: number
  limit?: number
}

export interface HistoryFilters {
  q?: string
  channel?: string
  status?: string
  stage?: string
  page?: number
  limit?: number
}

export const REMINDER_STAGE_LABELS: Record<ReminderStage, string> = {
  membership_expiry_7_days: '7 Days Before Expiry',
  membership_expiry_1_day: '1 Day Before Expiry',
  membership_expired: 'After Expiry',
  payment_due: 'Payment Due',
  payment_overdue: 'Payment Overdue',
}
