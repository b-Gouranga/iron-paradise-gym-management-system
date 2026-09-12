import { Router } from 'express'
import {
  handleWhatsAppWebhook,
  verifyWhatsAppWebhook,
} from '../controllers/webhooksController.js'

export const webhooksRouter = Router()

/**
 * Public webhook endpoints for Meta WhatsApp Cloud API.
 * Authentication is performed via Meta verification challenge (GET)
 * and HMAC-SHA256 signature verification (POST).
 */
webhooksRouter.get('/whatsapp', verifyWhatsAppWebhook)
webhooksRouter.post('/whatsapp', handleWhatsAppWebhook)
