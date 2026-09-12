import { randomUUID } from 'crypto'
import { normalizeWhatsAppPhone } from './phoneNormalizer.js'
import type {
  NotificationProvider,
  NotificationProviderResult,
  SendNotificationPayload,
} from './types.js'

/**
 * MockNotificationProvider:
 *
 * Implements a development-safe mock messaging provider that simulates
 * WhatsApp message delivery for testing and local environments.
 *
 * Security & Design Guarantees:
 * - NEVER contacts any real WhatsApp, Meta, or SMS API.
 * - Always tags generated IDs with 'mock-wa-' prefix.
 * - Returns isSimulated: true so that mock delivery is never misrepresented as real.
 * - Provides predictable, deterministic failure simulation for test scenarios.
 */
export class MockNotificationProvider implements NotificationProvider {
  readonly name = 'mock' as const

  async send(payload: SendNotificationPayload): Promise<NotificationProviderResult> {
    const { recipientPhone, simulateFailure, failureReason } = payload
    const now = new Date().toISOString()
    const mockId = `mock-wa-${randomUUID()}`

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

    // 2. Validate phone number format via safe normalizer
    const phoneResult = normalizeWhatsAppPhone(recipientPhone)
    if (!phoneResult.valid) {
      return {
        success: false,
        status: 'failed',
        providerMessageId: mockId,
        sentAt: null,
        failureReason: phoneResult.error || `Invalid recipient phone number: "${recipientPhone}".`,
        isSimulated: true,
      }
    }

    // 3. Simulated success (accepted by mock provider)
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
