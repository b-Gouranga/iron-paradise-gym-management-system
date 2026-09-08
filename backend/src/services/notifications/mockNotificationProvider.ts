import { randomUUID } from 'crypto'
import type { ReminderChannel, ReminderStage, ReminderStatus } from '../../types/reminders.js'

export interface SendNotificationPayload {
  memberId: string
  recipientPhone: string
  channel: ReminderChannel
  message: string
  reminderStage: ReminderStage
  scheduledAt: string
  simulateFailure?: boolean
  failureReason?: string
}

export interface NotificationProviderResult {
  success: boolean
  status: ReminderStatus
  providerMessageId: string
  sentAt: string | null
  failureReason: string | null
  isSimulated: true
}

export interface NotificationProvider {
  send(payload: SendNotificationPayload): Promise<NotificationProviderResult>
}

/**
 * MockNotificationProvider:
 *
 * Implements a development-safe mock messaging provider that simulates
 * WhatsApp and SMS message delivery.
 *
 * Security & Design Guarantees:
 * - NEVER contacts any real WhatsApp, Meta, Twilio, or SMS API.
 * - Always tags generated IDs with 'mock-wa-' or 'mock-sms-' prefixes.
 * - Returns isSimulated: true so that mock delivery is never misrepresented as real.
 * - Provides predictable, deterministic failure simulation for test scenarios.
 */
export class MockNotificationProvider implements NotificationProvider {
  async send(payload: SendNotificationPayload): Promise<NotificationProviderResult> {
    const { recipientPhone, channel, simulateFailure, failureReason } = payload
    const now = new Date().toISOString()
    const prefix = channel === 'whatsapp' ? 'mock-wa' : 'mock-sms'
    const mockId = `${prefix}-${randomUUID()}`

    // 1. Check for intentional failure simulation
    if (simulateFailure) {
      return {
        success: false,
        status: 'failed',
        providerMessageId: mockId,
        sentAt: null,
        failureReason: failureReason || 'Simulated provider delivery failure (test scenario).',
        isSimulated: true,
      }
    }

    // 2. Validate phone number format (must contain at least 10 digits)
    const digits = (recipientPhone || '').replace(/\D/g, '')
    if (digits.length < 10) {
      return {
        success: false,
        status: 'failed',
        providerMessageId: mockId,
        sentAt: null,
        failureReason: `Invalid recipient phone number: "${recipientPhone}". Minimum 10 digits required.`,
        isSimulated: true,
      }
    }

    // 3. Simulated success
    return {
      success: true,
      status: 'sent',
      providerMessageId: mockId,
      sentAt: now,
      failureReason: null,
      isSimulated: true,
    }
  }
}

export const mockNotificationProvider = new MockNotificationProvider()
