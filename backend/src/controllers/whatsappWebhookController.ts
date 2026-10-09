import crypto from 'crypto'
import type { Request, Response } from 'express'
import { env } from '../config/env.js'
import { getSupabaseAdmin } from '../services/database/supabaseAdmin.js'
import type { ReminderStatus } from '../types/reminders.js'

/**
 * Masks phone numbers or recipient IDs in logs for privacy.
 * E.g., '919876543210' -> '91****3210'
 */
function maskRecipient(id: string): string {
  if (!id) return '(none)'
  if (id.length <= 6) return '***'
  return `${id.slice(0, 2)}****${id.slice(-4)}`
}

/**
 * GET /api/whatsapp/webhook
 *
 * Meta WhatsApp Cloud API Webhook verification challenge.
 * Meta calls this endpoint when configuring the webhook URL in the Meta Developer Dashboard.
 *
 * Query parameters sent by Meta:
 * - hub.mode: 'subscribe'
 * - hub.verify_token: token configured in the Meta Dashboard
 * - hub.challenge: integer/string challenge to echo back
 *
 * Behavior:
 * - Verifies that hub.mode === 'subscribe'
 * - Compares hub.verify_token with META_WEBHOOK_VERIFY_TOKEN
 * - If matches, returns hub.challenge with HTTP 200
 * - If verification fails, returns HTTP 403
 * - Never exposes the configured verify token in responses or logs
 */
export function verifyWhatsAppWebhook(req: Request, res: Response): void {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  const configuredToken = env.metaWebhookVerifyToken

  if (
    mode === 'subscribe' &&
    typeof token === 'string' &&
    configuredToken &&
    token === configuredToken
  ) {
    console.log('[WhatsAppWebhook] Verification challenge succeeded.')
    res.status(200).send(challenge != null ? String(challenge) : '')
    return
  }

  if (!configuredToken) {
    console.warn(
      '[WhatsAppWebhook] Verification challenge rejected: META_WEBHOOK_VERIFY_TOKEN is not configured.',
    )
  } else {
    console.warn(
      '[WhatsAppWebhook] Verification challenge rejected: invalid mode or token mismatch.',
    )
  }

  res.status(403).json({
    success: false,
    message: 'Webhook verification token mismatch or invalid mode.',
  })
}

/**
 * POST /api/whatsapp/webhook
 *
 * Meta WhatsApp Cloud API event notification receiver.
 * Handles:
 * - Message status events: 'sent', 'delivered', 'read', 'failed'
 * - Inbound messages: logs safe debugging metadata without storing personal data
 * - Graceful handling of unknown/malformed payloads without crashing
 * - HMAC-SHA256 signature verification via X-Hub-Signature-256 when META_APP_SECRET is configured
 */
export async function handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  const appSecret = env.metaAppSecret

  // 1. Signature validation (enforced if META_APP_SECRET is configured)
  if (appSecret) {
    const signatureHeader = (req.headers['x-hub-signature-256'] as string) || ''
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      console.warn('[WhatsAppWebhook] Missing or malformed X-Hub-Signature-256 header.')
      res.status(401).json({
        success: false,
        message: 'Missing or malformed X-Hub-Signature-256 header.',
      })
      return
    }

    const rawBodyBuffer =
      (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}))
    const hmac = crypto.createHmac('sha256', appSecret)
    const expectedSignature = `sha256=${hmac.update(rawBodyBuffer).digest('hex')}`

    const sigBuf = Buffer.from(signatureHeader)
    const expectedBuf = Buffer.from(expectedSignature)

    if (
      sigBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
      console.warn('[WhatsAppWebhook] Invalid X-Hub-Signature-256 signature.')
      res.status(401).json({
        success: false,
        message: 'Invalid webhook signature.',
      })
      return
    }
  }

  // 2. Safe parsing of Meta webhook event payload
  try {
    const body = req.body
    if (!body || typeof body !== 'object') {
      console.log('[WhatsAppWebhook] Empty or non-object payload received. Acknowledging safely.')
      res.status(200).json({ success: true, status: 'received' })
      return
    }

    // Check if this is a WhatsApp Business Account notification
    if (body.object && body.object !== 'whatsapp_business_account') {
      console.log(`[WhatsAppWebhook] Non-WhatsApp object received ("${body.object}"). Acknowledging safely.`)
      res.status(200).json({ success: true, status: 'ignored' })
      return
    }

    const entries = Array.isArray(body.entry) ? body.entry : []
    const supabase = getSupabaseAdmin()

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue
      const changes = Array.isArray(entry.changes) ? entry.changes : []

      for (const change of changes) {
        if (!change || typeof change !== 'object') continue
        const value = change.value
        if (!value || typeof value !== 'object') continue

        // ── A. Message Status Updates (sent, delivered, read, failed) ───────
        if (Array.isArray(value.statuses)) {
          for (const item of value.statuses) {
            if (!item || typeof item !== 'object') continue

            const providerMessageId = typeof item.id === 'string' ? item.id : ''
            const rawStatus = typeof item.status === 'string' ? item.status.toLowerCase() : ''
            const recipientId = typeof item.recipient_id === 'string' ? item.recipient_id : ''
            const timestamp = item.timestamp != null ? String(item.timestamp) : ''
            const errors = Array.isArray(item.errors) ? item.errors : []

            if (!providerMessageId) {
              console.log('[WhatsAppWebhook] Status item missing provider message id; skipped.')
              continue
            }

            console.log(
              `[WhatsAppWebhook] Status event: id=${providerMessageId}, status=${rawStatus || 'unknown'}, recipient=${maskRecipient(recipientId)}, ts=${timestamp}`,
            )

            // Map Meta status to our internal ReminderStatus
            let mappedStatus: ReminderStatus | null = null
            let failureReason: string | null = null

            if (rawStatus === 'sent') {
              mappedStatus = 'sent'
            } else if (rawStatus === 'delivered') {
              mappedStatus = 'delivered'
            } else if (rawStatus === 'read') {
              mappedStatus = 'read'
            } else if (rawStatus === 'failed') {
              mappedStatus = 'failed'
              failureReason =
                errors[0]?.message ||
                errors[0]?.title ||
                `Meta delivery failure code: ${errors[0]?.code || 'unknown'}`
              console.warn(
                `[WhatsAppWebhook] Delivery failure reported: code=${errors[0]?.code}, title=${errors[0]?.title || 'none'}`,
              )
            }

            if (!mappedStatus) {
              console.log(
                `[WhatsAppWebhook] Unmapped status string "${rawStatus}"; acknowledged without DB update.`,
              )
              continue
            }

            // Look up corresponding record in public.message_history
            try {
              const { data: existingHistory, error: historyLookupErr } = await supabase
                .from('message_history')
                .select('id, reminder_id, status')
                .eq('provider_message_id', providerMessageId)
                .limit(1)
                .maybeSingle()

              if (historyLookupErr) {
                console.warn(
                  `[WhatsAppWebhook] Error looking up message_history for ${providerMessageId}:`,
                  historyLookupErr.message,
                )
                continue
              }

              if (!existingHistory) {
                console.log(
                  `[WhatsAppWebhook] No message_history record found for provider_message_id=${providerMessageId}; acknowledged.`,
                )
                continue
              }

              // Update message_history defensively
              const updatePayload: Record<string, unknown> = { status: mappedStatus }
              if (failureReason) {
                updatePayload.failure_reason = failureReason
              }

              const { error: historyUpdateErr } = await supabase
                .from('message_history')
                .update(updatePayload)
                .eq('id', existingHistory.id)

              if (historyUpdateErr) {
                // If message_history has an immutability trigger in this DB, log note without crashing
                console.log(
                  `[WhatsAppWebhook] Note on message_history update (${existingHistory.id}):`,
                  historyUpdateErr.message,
                )
              }

              // Update linked reminder row if exists
              if (existingHistory.reminder_id) {
                const { error: reminderUpdateErr } = await supabase
                  .from('reminders')
                  .update({
                    status: mappedStatus,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', existingHistory.reminder_id)

                if (reminderUpdateErr) {
                  console.warn(
                    `[WhatsAppWebhook] Error updating reminder ${existingHistory.reminder_id}:`,
                    reminderUpdateErr.message,
                  )
                } else {
                  console.log(
                    `[WhatsAppWebhook] Updated reminder ${existingHistory.reminder_id} status to "${mappedStatus}".`,
                  )
                }
              }
            } catch (dbErr: any) {
              console.warn(
                '[WhatsAppWebhook] Database update error on status event:',
                dbErr?.message || dbErr,
              )
            }
          }
        }

        // ── B. Incoming WhatsApp Messages ──────────────────────────────────
        if (Array.isArray(value.messages)) {
          for (const msg of value.messages) {
            if (!msg || typeof msg !== 'object') continue

            const msgId = typeof msg.id === 'string' ? msg.id : ''
            const msgType = typeof msg.type === 'string' ? msg.type : 'unknown'
            const from = typeof msg.from === 'string' ? msg.from : ''
            const timestamp = msg.timestamp != null ? String(msg.timestamp) : ''

            // Parse and log safe metadata for debugging
            // Do NOT store unnecessary message content or personal information
            // Do NOT reply, do NOT create chatbot, do NOT trigger reminders, do NOT modify member records
            console.log(
              `[WhatsAppWebhook] Inbound message received: id=${msgId || 'unknown'}, type=${msgType}, from=${maskRecipient(from)}, ts=${timestamp}`,
            )
          }
        }
      }
    }

    // Always respond 200 quickly so Meta does not retry
    res.status(200).json({ success: true, status: 'received' })
  } catch (err: any) {
    console.error('[WhatsAppWebhook] Error processing webhook payload:', err?.message || err)
    // Return HTTP 200 to acknowledge and avoid repeated retry storms
    res.status(200).json({
      success: false,
      message: 'Webhook received but encountered processing error.',
    })
  }
}
