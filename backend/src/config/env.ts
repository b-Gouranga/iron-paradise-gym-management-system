import 'dotenv/config'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  messagingProvider: (process.env.MESSAGING_PROVIDER || 'mock').toLowerCase() as 'mock' | 'meta',
  metaWhatsAppEnabled: process.env.META_WHATSAPP_ENABLED === 'true',
  metaWhatsAppAccessToken: process.env.META_WHATSAPP_ACCESS_TOKEN || '',
  metaWhatsAppPhoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID || '',
  metaWhatsAppBusinessAccountId: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  metaWhatsAppApiVersion: process.env.META_WHATSAPP_API_VERSION || 'v25.0',
  get metaWebhookVerifyToken(): string {
    return (
      process.env.META_WEBHOOK_VERIFY_TOKEN ||
      process.env.META_WHATSAPP_VERIFY_TOKEN ||
      ''
    )
  },
  get metaWhatsAppVerifyToken(): string {
    return (
      process.env.META_WEBHOOK_VERIFY_TOKEN ||
      process.env.META_WHATSAPP_VERIFY_TOKEN ||
      ''
    )
  },
  get metaAppSecret(): string {
    return (
      process.env.META_APP_SECRET ||
      process.env.META_WHATSAPP_APP_SECRET ||
      ''
    )
  },
  get metaWhatsAppAppSecret(): string {
    return (
      process.env.META_APP_SECRET ||
      process.env.META_WHATSAPP_APP_SECRET ||
      ''
    )
  },
  /** Maximum number of scheduled reminders processed per worker run (default 50). */
  reminderBatchSize: Math.max(1, Number(process.env.REMINDER_BATCH_SIZE) || 50),
}
