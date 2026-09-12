import { env } from '../../config/env.js'
import { mapToMetaTemplate } from './metaTemplateMapper.js'
import { normalizeWhatsAppPhone } from './phoneNormalizer.js'
import type {
  NotificationProvider,
  NotificationProviderResult,
  SendNotificationPayload,
} from './types.js'

export interface MetaWhatsAppConfig {
  accessToken?: string
  phoneNumberId?: string
  businessAccountId?: string
  apiVersion?: string
}

/**
 * MetaWhatsAppProvider:
 *
 * Direct integration with Meta's WhatsApp Cloud API (Graph API).
 *
 * Security & Reliability Standards:
 * - Configurable API version (defaults cleanly to current stable version, e.g. v21.0).
 * - Never logs access tokens, app secrets, or authorization headers.
 * - Enforces strict non-destructive phone number normalization.
 * - Translates application reminder stages into Meta-approved template parameters.
 * - Returns 'sent' on initial API acceptance; true delivery is confirmed via webhook callbacks.
 * - Always tags isSimulated: false so production messages are never conflated with mock events.
 */
export class MetaWhatsAppProvider implements NotificationProvider {
  readonly name = 'meta' as const
  private accessToken: string
  private phoneNumberId: string
  private apiVersion: string

  constructor(config?: MetaWhatsAppConfig) {
    this.accessToken = config?.accessToken ?? env.metaWhatsAppAccessToken
    this.phoneNumberId = config?.phoneNumberId ?? env.metaWhatsAppPhoneNumberId
    this.apiVersion = (config?.apiVersion ?? env.metaWhatsAppApiVersion) || 'v25.0'
  }

  getApiVersion(): string {
    return this.apiVersion
  }

  /**
   * Validates that required production credentials are configured.
   * Throws an explicit descriptive error if credentials are missing (never silently falls back).
   */
  validateConfiguration(): { valid: boolean; error?: string } {
    if (!this.accessToken) {
      return {
        valid: false,
        error: 'Missing required configuration: META_WHATSAPP_ACCESS_TOKEN is not defined.',
      }
    }
    if (!this.phoneNumberId) {
      return {
        valid: false,
        error: 'Missing required configuration: META_WHATSAPP_PHONE_NUMBER_ID is not defined.',
      }
    }
    return { valid: true }
  }

  validateCredentials(): void {
    const check = this.validateConfiguration()
    if (!check.valid) {
      throw new Error(check.error)
    }
  }

  async send(payload: SendNotificationPayload): Promise<NotificationProviderResult> {
    const { recipientPhone, reminderStage, templateContext } = payload

    // 1. Validate configuration
    const configCheck = this.validateConfiguration()
    if (!configCheck.valid) {
      return {
        success: false,
        status: 'failed',
        providerMessageId: `meta-config-err-${Date.now()}`,
        sentAt: null,
        failureReason: configCheck.error || 'Meta WhatsApp credentials missing.',
        isSimulated: false,
      }
    }

    // 2. Safe non-destructive phone normalization
    const phoneResult = normalizeWhatsAppPhone(recipientPhone)
    if (!phoneResult.valid) {
      return {
        success: false,
        status: 'failed',
        providerMessageId: `meta-phone-err-${Date.now()}`,
        sentAt: null,
        failureReason: phoneResult.error || `Invalid recipient phone number: "${recipientPhone}".`,
        isSimulated: false,
      }
    }

    // 3. Map to Meta-approved template with ordered parameters (or use explicitly provided template)
    let templatePayload = payload.metaTemplatePayload
    if (!templatePayload) {
      const mappingResult = mapToMetaTemplate(reminderStage, templateContext)
      if (!mappingResult.ok) {
        return {
          success: false,
          status: 'failed',
          providerMessageId: `meta-template-err-${Date.now()}`,
          sentAt: null,
          failureReason: mappingResult.error,
          isSimulated: false,
        }
      }
      templatePayload = mappingResult.template
    }

    // 4. Construct Graph API request
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`
    const requestBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneResult.digitsOnly,
      type: 'template',
      template: templatePayload,
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = (await response.json().catch(() => null)) as any

      if (!response.ok) {
        // Extract sanitized error message from Meta's response structure
        const metaError = data?.error
        const sanitizedError = metaError?.message
          ? `(#${metaError.code ?? 'unknown'}) ${metaError.message}`
          : `HTTP ${response.status}: ${response.statusText}`

        return {
          success: false,
          status: 'failed',
          providerMessageId: `meta-err-${Date.now()}`,
          sentAt: null,
          failureReason: `Meta WhatsApp API error: ${sanitizedError}`,
          isSimulated: false,
        }
      }

      // Successful API dispatch — extract Meta message ID (e.g. "wamid.HBgM...")
      const providerMessageId =
        data?.messages?.[0]?.id || `wamid.meta-${Date.now()}`

      return {
        success: true,
        status: 'sent', // API accepted the message; delivery/read status comes via Webhook
        providerMessageId,
        sentAt: new Date().toISOString(),
        failureReason: null,
        isSimulated: false,
      }
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        providerMessageId: `meta-network-err-${Date.now()}`,
        sentAt: null,
        failureReason: `Network error dispatching to Meta WhatsApp Cloud API: ${this.sanitizeErrorMessage(err?.message || 'Unknown network failure')}`,
        isSimulated: false,
      }
    }
  }

  sanitizeErrorMessage(rawError: string): string {
    if (!rawError) return ''
    if (!this.accessToken) return rawError
    return rawError.split(this.accessToken).join('[REDACTED_TOKEN]')
  }
}
