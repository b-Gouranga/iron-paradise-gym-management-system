import type {
  ReminderChannel,
  ReminderStage,
  ReminderStatus,
  TemplateContext,
} from '../../types/reminders.js'
import type { MetaTemplatePayload } from './metaTemplateMapper.js'

export interface SendNotificationPayload {
  memberId: string
  recipientPhone: string
  channel: ReminderChannel
  message: string
  reminderStage: ReminderStage
  scheduledAt: string
  templateContext?: TemplateContext
  metaTemplatePayload?: MetaTemplatePayload
  simulateFailure?: boolean
  failureReason?: string
}

export interface NotificationProviderResult {
  success: boolean
  status: ReminderStatus
  providerMessageId: string
  sentAt: string | null
  failureReason: string | null
  isSimulated: boolean
}

export interface NotificationProvider {
  readonly name: 'mock' | 'meta'
  send(payload: SendNotificationPayload): Promise<NotificationProviderResult>
}
