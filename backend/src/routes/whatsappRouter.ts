import { Router } from 'express'
import {
  handleWhatsAppWebhook,
  verifyWhatsAppWebhook,
} from '../controllers/whatsappWebhookController.js'

export const whatsappRouter = Router()

/**
 * Meta WhatsApp Cloud API Webhook endpoints.
 *
 * GET  /api/whatsapp/webhook - Challenge verification for Meta Developer Dashboard
 * POST /api/whatsapp/webhook - Real-time event notifications (message status & incoming)
 */
whatsappRouter.get('/webhook', verifyWhatsAppWebhook)
whatsappRouter.post('/webhook', handleWhatsAppWebhook)
