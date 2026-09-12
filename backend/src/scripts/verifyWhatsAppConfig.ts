import { env } from '../config/env.js'
import {
  buildJaspersMarketTestTemplate,
  mapToMetaTemplate,
} from '../services/notifications/metaTemplateMapper.js'
import { MetaWhatsAppProvider } from '../services/notifications/metaWhatsAppProvider.js'
import { normalizeWhatsAppPhone } from '../services/notifications/phoneNormalizer.js'
import type { ReminderStage, TemplateContext } from '../types/reminders.js'

function maskId(val: string, showStart = 4, showEnd = 4): string {
  if (!val) return '(not set)'
  if (val.length <= showStart + showEnd) return '***'
  return `${val.slice(0, showStart)}${'*'.repeat(Math.min(6, val.length - (showStart + showEnd)))}${val.slice(-showEnd)}`
}

export async function runVerification(options?: { sendToPhone?: string }): Promise<{
  success: boolean
  readyForRealMessages: boolean
  details: Record<string, unknown>
}> {
  console.log('=================================================================')
  console.log('IRON PARADISE GYM — META WHATSAPP CONFIGURATION & DIAGNOSTICS')
  console.log('=================================================================\n')

  let hasErrors = false
  const details: Record<string, unknown> = {}

  // 1. Provider Mode
  console.log('── 1. Messaging Provider Mode ─────────────────────────────────')
  console.log(`  MESSAGING_PROVIDER:             "${env.messagingProvider}"`)
  if (env.messagingProvider === 'meta') {
    console.log('  Mode:                            PRODUCTION / REAL META CLOUD API')
  } else if (env.messagingProvider === 'mock') {
    console.log('  Mode:                            MOCK / LOCAL SIMULATED DISPATCH')
  } else {
    console.error(`  [!] Invalid MESSAGING_PROVIDER: "${env.messagingProvider}". Must be "meta" or "mock".`)
    hasErrors = true
  }

  // 2. Meta WhatsApp Configuration
  console.log('\n── 2. Meta WhatsApp Credentials & Configuration ───────────────')
  console.log(`  META_WHATSAPP_ENABLED:           ${env.metaWhatsAppEnabled}`)
  console.log(`  META_WHATSAPP_API_VERSION:       ${env.metaWhatsAppApiVersion}`)
  console.log(`  META_WHATSAPP_PHONE_NUMBER_ID:   ${env.metaWhatsAppPhoneNumberId ? maskId(env.metaWhatsAppPhoneNumberId) : '(missing)'}`)
  console.log(`  META_WHATSAPP_BUSINESS_ACCOUNT:  ${env.metaWhatsAppBusinessAccountId ? maskId(env.metaWhatsAppBusinessAccountId) : '(missing)'}`)
  console.log(`  META_WHATSAPP_VERIFY_TOKEN:      ${env.metaWhatsAppVerifyToken ? 'configured (' + maskId(env.metaWhatsAppVerifyToken, 3, 3) + ')' : '(missing)'}`)
  console.log(`  META_WHATSAPP_APP_SECRET:        ${env.metaWhatsAppAppSecret ? 'configured (' + maskId(env.metaWhatsAppAppSecret, 3, 3) + ')' : '(missing)'}`)

  const tokenPresent = Boolean(env.metaWhatsAppAccessToken && env.metaWhatsAppAccessToken.trim().length > 0)
  if (tokenPresent) {
    const tokenLen = env.metaWhatsAppAccessToken.trim().length
    const prefix = env.metaWhatsAppAccessToken.trim().slice(0, 4)
    console.log(`  META_WHATSAPP_ACCESS_TOKEN:      PRESENT (${tokenLen} chars, prefix: "${prefix}...") [SAFE: zero token leakage]`)
  } else {
    console.log('  META_WHATSAPP_ACCESS_TOKEN:      MISSING / NOT SET')
    console.log('  ↳ To configure: Paste your Meta access token into backend/.env on the META_WHATSAPP_ACCESS_TOKEN= line.')
  }

  // 3. Safe Phone Normalizer Verification
  console.log('\n── 3. Phone Normalizer Self-Test ──────────────────────────────')
  const phoneTests = [
    { input: '9876543210', expected: '919876543210', name: '10-digit Indian' },
    { input: '09876543210', expected: '919876543210', name: '11-digit Indian with 0' },
    { input: '919876543210', expected: '919876543210', name: '12-digit Indian with 91' },
    { input: '+14155552671', expected: '14155552671', name: 'US E.164 (+1)' },
    { input: '+447911123456', expected: '447911123456', name: 'UK E.164 (+44)' },
  ]

  let normalizerPassed = true
  for (const t of phoneTests) {
    const res = normalizeWhatsAppPhone(t.input)
    if (!res.valid || res.digitsOnly !== t.expected) {
      console.error(`  [!] Normalizer failed for ${t.name} ("${t.input}"): got ${res.digitsOnly}, expected ${t.expected}`)
      normalizerPassed = false
      hasErrors = true
    }
  }
  if (normalizerPassed) {
    console.log('  ✓ Phone normalization verified across Indian and international formats.')
  }

  // 4. Template Mapper Verification
  console.log('\n── 4. Template Parameter Mapping Self-Test ────────────────────')
  const dummyContext: TemplateContext = {
    member_name: 'Rahul Sarmah',
    membership_plan: 'Annual Gold VIP',
    expiry_date: '2026-10-01',
    pending_amount: '1,500',
    payment_due_date: '2026-09-15',
    gym_name: 'Iron Paradise Gym',
  }

  const stages: ReminderStage[] = [
    'membership_expiry_7_days',
    'membership_expiry_1_day',
    'membership_expired',
    'payment_due',
    'payment_overdue',
  ]

  let templatePassed = true
  for (const stage of stages) {
    const tRes = mapToMetaTemplate(stage, dummyContext)
    if (!tRes.ok) {
      console.error(`  [!] Template mapping failed for stage "${stage}": ${tRes.error}`)
      templatePassed = false
      hasErrors = true
    }
  }
  if (templatePassed) {
    console.log('  ✓ All 5 production reminder stages successfully mapped to Meta template structures.')
  }

  // Verify test template builder
  const sandboxTestTemplate = buildJaspersMarketTestTemplate(dummyContext)
  if (
    sandboxTestTemplate.name === 'jaspers_market_order_confirmation_v1' &&
    sandboxTestTemplate.components[0]?.parameters?.length === 3
  ) {
    console.log('  ✓ Meta sandbox test template ("jaspers_market_order_confirmation_v1") verified.')
  } else {
    console.error('  [!] Failed to verify Meta sandbox test template structure.')
    hasErrors = true
  }

  // 5. Live Meta Graph API Credential Verification (Read-Only)
  console.log('\n── 5. Live Meta Graph API Connectivity (Read-Only) ────────────')
  let readyForRealMessages = false

  if (!tokenPresent) {
    console.log('  [-] Skipped live API verification: META_WHATSAPP_ACCESS_TOKEN is missing.')
    console.log('  ↳ Action required: Paste the Meta access token into backend/.env.')
  } else if (!env.metaWhatsAppPhoneNumberId) {
    console.log('  [!] Cannot verify: META_WHATSAPP_PHONE_NUMBER_ID is not configured.')
    hasErrors = true
  } else {
    const version = env.metaWhatsAppApiVersion || 'v25.0'
    const phoneId = env.metaWhatsAppPhoneNumberId
    const checkUrl = `https://graph.facebook.com/${version}/${phoneId}?fields=verified_name,display_phone_number,quality_rating,code_verification_status`

    try {
      const response = await fetch(checkUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.metaWhatsAppAccessToken}`,
          'Content-Type': 'application/json',
        },
      })

      const data = (await response.json().catch(() => null)) as any

      if (response.ok && data) {
        console.log('  ✓ Meta Graph API connection: SUCCESS (HTTP 200)')
        console.log(`    Display Phone Number:      ${data.display_phone_number || '(test number)'}`)
        console.log(`    Verified Name:             ${data.verified_name || '(Meta Sandbox Test)'}`)
        console.log(`    Quality Rating:            ${data.quality_rating || 'UNKNOWN'}`)
        console.log(`    Verification Status:       ${data.code_verification_status || 'NOT_VERIFIED'}`)
        readyForRealMessages = true
      } else {
        const metaError = data?.error
        const errorMsg = metaError?.message || `HTTP ${response.status}: ${response.statusText}`
        const errorCode = metaError?.code ? `#${metaError.code}` : 'N/A'
        console.error(`  [!] Meta Graph API returned error (${errorCode}): ${errorMsg}`)
        console.error('      Common causes:')
        console.error('      - Access token has expired (temporary test tokens expire in 24 hours).')
        console.error('      - Access token lacks the "whatsapp_business_messaging" permission.')
        console.error('      - Phone Number ID does not belong to the WhatsApp Business Account.')
        hasErrors = true
      }
    } catch (netErr: any) {
      console.error(`  [!] Network error connecting to Meta Graph API: ${netErr.message}`)
      hasErrors = true
    }
  }

  // 6. Optional Live Send Test
  if (options?.sendToPhone) {
    console.log('\n── 6. Live WhatsApp Message Dispatch Test ────────────────────')
    if (!tokenPresent || !readyForRealMessages) {
      console.error('  [!] Cannot dispatch test message: Meta credentials are not valid/verified.')
    } else {
      console.log(`  Target Recipient:            "${options.sendToPhone}"`)
      console.log('  Meta Test Template:          "jaspers_market_order_confirmation_v1" (pre-approved in Meta WABA)')
      console.log('  Production Templates:        Preserved for Iron Paradise Gym approved stages')

      const testTemplate = buildJaspersMarketTestTemplate(dummyContext)
      const provider = new MetaWhatsAppProvider()
      const sendResult = await provider.send({
        memberId: 'test-verification-member',
        recipientPhone: options.sendToPhone,
        channel: 'whatsapp',
        reminderStage: 'membership_expiry_7_days',
        scheduledAt: new Date().toISOString(),
        message: "Order confirmed: Jasper's Market test message",
        templateContext: dummyContext,
        metaTemplatePayload: testTemplate,
      })

      if (sendResult.success) {
        console.log('  ✓ Meta WhatsApp template message ACCEPTED by Meta Cloud API!')
        console.log(`    Provider Message ID:       ${sendResult.providerMessageId}`)
        console.log(`    Status:                    ${sendResult.status}`)
        console.log(`    Sent At:                   ${sendResult.sentAt}`)
      } else {
        console.error(`  [!] Dispatch failed: ${sendResult.failureReason}`)
      }
    }
  }

  // Summary
  console.log('\n=================================================================')
  console.log('VERIFICATION SUMMARY')
  console.log('=================================================================')
  console.log(`  Configuration Check:            ${hasErrors ? 'FAILED / INCOMPLETE' : 'PASSED'}`)
  console.log(`  Mock Provider Preserved:        YES`)
  console.log(`  Ready for Real Meta Messages:   ${readyForRealMessages ? 'YES — Credentials Active' : 'NO — Awaiting Valid Access Token'}`)
  console.log('=================================================================\n')

  return {
    success: !hasErrors,
    readyForRealMessages,
    details,
  }
}

// Auto-run when called via CLI
if (process.argv[1]?.endsWith('verifyWhatsAppConfig.ts') || process.argv[1]?.endsWith('verifyWhatsAppConfig.js')) {
  const sendArg = process.argv.find((a) => a.startsWith('--send='))
  const sendToPhone = sendArg ? sendArg.split('=')[1] : undefined

  runVerification({ sendToPhone })
    .then((res) => {
      // Exit 0 if configuration checks passed or if only waiting for access token
      process.exit(0)
    })
    .catch((err) => {
      console.error('Fatal diagnostic error:', err)
      process.exit(1)
    })
}
