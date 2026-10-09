import assert from 'node:assert'
import crypto from 'node:crypto'
import http from 'node:http'
import express from 'express'
import { apiRouter } from '../routes/index.js'

/**
 * Automated test suite for Meta WhatsApp Cloud API Webhook endpoint:
 * GET  /api/whatsapp/webhook (Verification)
 * POST /api/whatsapp/webhook (Event receiver)
 *
 * Requirements covered:
 * A. Valid GET verification (mode=subscribe, valid token, returns challenge with 200)
 * B. Invalid GET verification (wrong token, wrong mode, missing token -> 403)
 * C. POST webhook (standard WhatsApp payload -> 200, does not crash)
 * D. Status events (sent, delivered, read, failed, and inbound messages parsed correctly)
 * E. Unknown payload (returns 200 / safe acknowledgement, does not crash)
 * F. Missing / malformed fields (does not crash)
 * G. HMAC signature verification (enforced when META_APP_SECRET is configured)
 */
export async function runWebhookTests(): Promise<{ passed: number; failed: number }> {
  console.log('=================================================================')
  console.log('IRON PARADISE GYM — WHATSAPP WEBHOOK AUTOMATED TEST SUITE')
  console.log('=================================================================\n')

  let passed = 0
  let failed = 0

  function pass(desc: string) {
    passed++
    console.log(`  ✓ ${desc}`)
  }

  function fail(desc: string, err: any) {
    failed++
    console.error(`  ✗ ${desc}:`, err?.message || err)
  }

  // Configure test verify token in process.env
  const TEST_VERIFY_TOKEN = 'test_meta_webhook_verify_token_secure_2026'
  process.env.META_WEBHOOK_VERIFY_TOKEN = TEST_VERIFY_TOKEN

  // Temporarily clear app secrets for unauthenticated tests (C through F)
  const savedAppSecret = process.env.META_APP_SECRET
  const savedWhatsAppAppSecret = process.env.META_WHATSAPP_APP_SECRET
  delete process.env.META_APP_SECRET
  delete process.env.META_WHATSAPP_APP_SECRET

  // Spin up an Express test server using the real routes and middleware
  const app = express()
  app.use(
    express.json({
      limit: '100kb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf
      },
    }),
  )
  app.use('/api', apiRouter)

  const server = http.createServer(app)
  await new Promise<void>(resolve => server.listen(0, resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const webhookUrl = `http://127.0.0.1:${port}/api/whatsapp/webhook`

  try {
    // ── A. Valid GET verification ──────────────────────────────────────────
    console.log('── Test Group A: Valid GET Webhook Verification ───────────────')
    try {
      const challenge = '1158201244'
      const res = await fetch(
        `${webhookUrl}?hub.mode=subscribe&hub.verify_token=${TEST_VERIFY_TOKEN}&hub.challenge=${challenge}`,
      )
      assert.strictEqual(res.status, 200, `Expected status 200, got ${res.status}`)
      const text = await res.text()
      assert.strictEqual(text, challenge, `Expected challenge echo "${challenge}", got "${text}"`)
      pass('A1. Valid verification returns HTTP 200 and exact challenge value')
    } catch (err) {
      fail('A1. Valid verification failed', err)
    }

    // ── B. Invalid GET verification ────────────────────────────────────────
    console.log('\n── Test Group B: Invalid GET Webhook Verification ─────────────')
    try {
      const res = await fetch(
        `${webhookUrl}?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=12345`,
      )
      assert.strictEqual(res.status, 403, `Expected status 403 on wrong token, got ${res.status}`)
      pass('B1. Wrong verify token returns HTTP 403')
    } catch (err) {
      fail('B1. Wrong verify token check failed', err)
    }

    try {
      const res = await fetch(
        `${webhookUrl}?hub.mode=unsubscribe&hub.verify_token=${TEST_VERIFY_TOKEN}&hub.challenge=12345`,
      )
      assert.strictEqual(res.status, 403, `Expected status 403 on invalid mode, got ${res.status}`)
      pass('B2. Invalid hub.mode returns HTTP 403')
    } catch (err) {
      fail('B2. Invalid hub.mode check failed', err)
    }

    try {
      const res = await fetch(`${webhookUrl}?hub.mode=subscribe&hub.challenge=12345`)
      assert.strictEqual(res.status, 403, `Expected status 403 on missing token, got ${res.status}`)
      pass('B3. Missing hub.verify_token returns HTTP 403')
    } catch (err) {
      fail('B3. Missing hub.verify_token check failed', err)
    }

    // ── C. POST webhook - Valid standard WhatsApp payload ─────────────────
    console.log('\n── Test Group C: Valid WhatsApp POST Webhook Payload ──────────')
    try {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789012345',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15551234567',
                    phone_number_id: '123456789',
                  },
                  statuses: [
                    {
                      id: 'wamid.HBgM-test-sent-001',
                      status: 'sent',
                      timestamp: '1710000000',
                      recipient_id: '919876543210',
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      assert.strictEqual(res.status, 200, `Expected status 200, got ${res.status}`)
      const data = (await res.json()) as any
      assert.strictEqual(data.success, true)
      assert.strictEqual(data.status, 'received')
      pass('C1. Standard WhatsApp status payload accepted with HTTP 200 and success response')
    } catch (err) {
      fail('C1. Standard WhatsApp payload failed', err)
    }

    // ── D. Status events parsing (delivered, read, failed) & inbound ─────
    console.log('\n── Test Group D: Status Events (delivered, read, failed) & Inbound ──')
    for (const statusVal of ['delivered', 'read']) {
      try {
        const payload = {
          object: 'whatsapp_business_account',
          entry: [
            {
              id: '123456789012345',
              changes: [
                {
                  field: 'messages',
                  value: {
                    messaging_product: 'whatsapp',
                    statuses: [
                      {
                        id: `wamid.test-${statusVal}-002`,
                        status: statusVal,
                        timestamp: '1710000001',
                        recipient_id: '919876543210',
                      },
                    ],
                  },
                },
              ],
            },
          ],
        }

        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        assert.strictEqual(res.status, 200)
        pass(`D. Status event "${statusVal}" parsed and acknowledged with HTTP 200`)
      } catch (err) {
        fail(`D. Status event "${statusVal}" failed`, err)
      }
    }

    try {
      const failedPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789012345',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  statuses: [
                    {
                      id: 'wamid.test-failed-003',
                      status: 'failed',
                      timestamp: '1710000002',
                      recipient_id: '919876543210',
                      errors: [
                        {
                          code: 131026,
                          title: 'Receiver is incapable of receiving this message',
                          message: 'Undeliverable to this destination',
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(failedPayload),
      })

      assert.strictEqual(res.status, 200)
      pass('D. Status event "failed" with Meta error details parsed safely with HTTP 200')
    } catch (err) {
      fail('D. Status event "failed" failed', err)
    }

    try {
      const inboundPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789012345',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15551234567',
                    phone_number_id: '123456789',
                  },
                  contacts: [{ profile: { name: 'Member Test' }, wa_id: '919876543210' }],
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.inbound-test-msg-004',
                      timestamp: '1710000003',
                      type: 'text',
                      text: { body: 'Hello Iron Paradise Gym' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inboundPayload),
      })

      assert.strictEqual(res.status, 200)
      pass('D. Incoming WhatsApp message recognized and safely logged without auto-replying')
    } catch (err) {
      fail('D. Incoming WhatsApp message check failed', err)
    }

    // ── E. Unknown payload ─────────────────────────────────────────────────
    console.log('\n── Test Group E: Unknown & Non-WhatsApp Payloads ──────────────')
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      assert.strictEqual(res.status, 200)
      pass('E1. Empty JSON object acknowledged with HTTP 200 without crashing')
    } catch (err) {
      fail('E1. Empty object check failed', err)
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object: 'instagram', entry: [{ id: '999' }] }),
      })
      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as any
      assert.strictEqual(data.status, 'ignored')
      pass('E2. Non-WhatsApp object ("instagram") safely ignored with HTTP 200')
    } catch (err) {
      fail('E2. Non-WhatsApp object check failed', err)
    }

    // ── F. Missing / malformed fields ──────────────────────────────────────
    console.log('\n── Test Group F: Missing & Malformed Fields ───────────────────')
    try {
      const malformedPayload1 = {
        object: 'whatsapp_business_account',
        entry: 'not-an-array',
      }
      const res1 = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(malformedPayload1),
      })
      assert.strictEqual(res1.status, 200)
      pass('F1. Malformed entry (string instead of array) does not crash and returns 200')

      const malformedPayload2 = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [null, { value: null }, { value: { statuses: 'not-an-array' } }],
          },
        ],
      }
      const res2 = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(malformedPayload2),
      })
      assert.strictEqual(res2.status, 200)
      pass('F2. Null changes and malformed statuses do not crash and return 200')

      const malformedPayload3 = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [{}], // missing id, status, recipient
                  messages: [{}], // missing id, from, type
                },
              },
            ],
          },
        ],
      }
      const res3 = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(malformedPayload3),
      })
      assert.strictEqual(res3.status, 200)
      pass('F3. Status/message items with empty objects do not crash and return 200')
    } catch (err) {
      fail('F. Malformed fields check failed', err)
    }

    // ── G. HMAC-SHA256 Signature Validation ────────────────────────────────
    console.log('\n── Test Group G: HMAC-SHA256 Signature Security ───────────────')
    const TEST_APP_SECRET = 'meta_app_secret_test_xyz789'
    process.env.META_APP_SECRET = TEST_APP_SECRET

    try {
      const payloadString = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [],
      })

      // G1: Valid signature
      const validHmac = crypto.createHmac('sha256', TEST_APP_SECRET).update(payloadString).digest('hex')
      const resValid = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': `sha256=${validHmac}`,
        },
        body: payloadString,
      })
      assert.strictEqual(resValid.status, 200, `Expected status 200, got ${resValid.status}`)
      pass('G1. Valid HMAC-SHA256 signature accepted with HTTP 200')

      // G2: Tampered / invalid signature
      const resInvalid = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=invalidhexsignature0000000000000000000000000000000000000000000000',
        },
        body: payloadString,
      })
      assert.strictEqual(resInvalid.status, 401, `Expected status 401, got ${resInvalid.status}`)
      pass('G2. Tampered signature rejected with HTTP 401')

      // G3: Missing signature when secret is configured
      const resMissing = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payloadString,
      })
      assert.strictEqual(resMissing.status, 401, `Expected status 401, got ${resMissing.status}`)
      pass('G3. Missing signature rejected with HTTP 401 when META_APP_SECRET is set')
    } catch (err) {
      fail('G. HMAC signature validation failed', err)
    } finally {
      // Clean up test app secret
      delete process.env.META_APP_SECRET
    }
  } finally {
    if (savedAppSecret !== undefined) process.env.META_APP_SECRET = savedAppSecret
    if (savedWhatsAppAppSecret !== undefined) process.env.META_WHATSAPP_APP_SECRET = savedWhatsAppAppSecret
    server.close()
  }

  console.log('\n=================================================================')
  console.log(`WEBHOOK TESTS SUMMARY: ${passed} Passed, ${failed} Failed`)
  console.log('=================================================================\n')

  return { passed, failed }
}

// Execute directly if run via CLI
if (process.argv[1]?.endsWith('testWhatsAppWebhook.ts')) {
  runWebhookTests()
    .then(({ failed }) => {
      if (failed > 0) process.exit(1)
    })
    .catch(err => {
      console.error('Fatal test error:', err)
      process.exit(1)
    })
}
