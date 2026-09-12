import crypto from 'crypto'
import type { Request, Response } from 'express'
import { env } from '../config/env.js'
import { getSupabaseAdmin } from '../services/database/supabaseAdmin.js'
import type { ReminderStatus } from '../types/reminders.js'

/**
 * GET /api/webhooks/whatsapp
 *
 * Meta WhatsApp Cloud API Webhook verification challenge.
 * Meta calls this endpoint when configuring the webhook URL in the Meta App Dashboard.
 */
export function verifyWhatsAppWebhook(req: Request, res: Response): void {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  const configuredToken = env.metaWhatsAppVerifyToken

  if (mode === 'subscribe' && token && configuredToken && token === configuredToken) {
    // Challenge verification passed
    res.status(200).send(challenge)
    return
  }

  res.status(403).json({
    success: false,
    message: 'Webhook verification token mismatch or invalid mode.',
  })
}

/**
 * POST /api/webhooks/whatsapp
 *
 * Meta WhatsApp Cloud API status callback notifications.
 *
 * Security & Design:
 * 1. Cryptographic HMAC-SHA256 signature verification via X-Hub-Signature-256 against raw body buffer.
 * 2. Idempotent status updates for: 'sent', 'delivered', 'read', 'failed'.
 * 3. Updates both public.message_history and public.reminders tables.
 * 4. Unknown message IDs handled gracefully without leaking errors.
 */
export async function handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  const signatureHeader = (req.headers['x-hub-signature-256'] as string) || ''
  const appSecret = env.metaWhatsAppAppSecret

  // 1. Enforce signature validation if app secret is configured
  if (appSecret) {
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      res.status(401).json({ success: false, message: 'Missing or malformed X-Hub-Signature-256 header.' })
      return
    }

    const rawBodyBuffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}))
    const hmac = crypto.createHmac('sha256', appSecret)
    const expectedSignature = `sha256=${hmac.update(rawBodyBuffer).digest('hex')}`

    const sigBuf = Buffer.from(signatureHeader)
    const expectedBuf = Buffer.from(expectedSignature)

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      res.status(401).json({ success: false, message: 'Invalid webhook signature.' })
      return
    }
  }

  // 2. Process Meta event payload
  try {
    const supabase = getSupabaseAdmin()
    const entries = req.body?.entry || []

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change?.value
        const statuses = value?.statuses || []

        for (const item of statuses) {
          const providerMessageId = item.id // e.g. "wamid.HBgM..."
          const rawStatus = String(item.status || '').toLowerCase() // 'sent' | 'delivered' | 'read' | 'failed'
          const errors = item.errors

          if (!providerMessageId) continue

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
              errors?.[0]?.message ||
              errors?.[0]?.title ||
              `Meta delivery failure code: ${errors?.[0]?.code || 'unknown'}`
          }

          if (!mappedStatus) continue

          // Look up corresponding record in public.message_history
          const { data: existingHistory } = await supabase
            .from('message_history')
            .select('id, reminder_id, status')
            .eq('provider_message_id', providerMessageId)
            .limit(1)
            .maybeSingle()

          if (!existingHistory) {
            // Unknown message ID or outside our tracking scope — acknowledge gracefully
            continue
          }

          // Build update payload for message_history
          const updatePayload: Record<string, unknown> = {
            status: mappedStatus,
          }
          if (failureReason) {
            updatePayload.failure_reason = failureReason
          }

          // Defensive update: If check constraint does not support 'read' in an unmigrated DB,
          // fallback safely to 'delivered' with a note rather than failing
          let updateErr: any = null
          const { error: err1 } = await supabase
            .from('message_history')
            .update(updatePayload)
            .eq('id', existingHistory.id)

          if (err1 && mappedStatus === 'read' && err1.message?.includes('check constraint')) {
            await supabase
              .from('message_history')
              .update({ status: 'delivered', failure_reason: 'Message read by recipient.' })
              .eq('id', existingHistory.id)
          } else if (err1) {
            updateErr = err1
          }

          if (updateErr) {
            console.error('[WebhooksController] Error updating message_history status:', updateErr)
          }

          // Update linked reminder row if exists
          if (existingHistory.reminder_id) {
            const reminderUpdate: Record<string, unknown> = {
              status: mappedStatus,
              updated_at: new Date().toISOString(),
            }
            const { error: remErr } = await supabase
              .from('reminders')
              .update(reminderUpdate)
              .eq('id', existingHistory.reminder_id)

            if (remErr && mappedStatus === 'read' && remErr.message?.includes('check constraint')) {
              await supabase
                .from('reminders')
                .update({ status: 'delivered', updated_at: new Date().toISOString() })
                .eq('id', existingHistory.reminder_id)
            }
          }
        }
      }
    }

    // Always respond 200 to Meta once received and processed
    res.status(200).json({ success: true, status: 'received', received: true })
  } catch (err: any) {
    console.error('[WebhooksController] Unexpected error in webhook processing:', err)
    res.status(500).json({ success: false, message: 'Internal server error processing webhook.' })
  }
}
