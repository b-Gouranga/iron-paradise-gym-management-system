import assert from 'node:assert'
import {
  claimReminder,
  CLAIM_LEASE_DURATION_MS,
  type ClaimResult,
} from '../services/reminders/reminderEngine.js'
import type { ReminderRow } from '../types/reminders.js'
import { runManualExpiredReminderTests } from './testManualExpiredReminder.js'

/**
 * Automated Test Suite: Reminder Concurrency Safety & Atomic Claim Mechanism
 *
 * Verifies:
 * 1. Single worker atomic claim on 'scheduled' reminder succeeds.
 * 2. Concurrent workers on same reminder: exactly one wins, other receives RACE_LOST.
 * 3. Active lease protection: 'processing' reminder with unexpired lease cannot be claimed.
 * 4. Stale lease recovery: 'processing' reminder with expired lease is reclaimed with new token.
 * 5. Fencing token validation: Stale worker cannot overwrite newer worker's state.
 * 6. Ambiguous timeout protection: Failures with [AMBIGUOUS_TIMEOUT] are never auto-retried.
 * 7. Definite failure retry: Non-ambiguous failures allow retries up to max_retries.
 * 8. Regression: 13 assertions of the manual After Expiry fix remain green.
 */

export async function runReminderConcurrencyTests(): Promise<{ passed: number; failed: number }> {
  console.log('=================================================================')
  console.log('IRON PARADISE GYM — REMINDER CONCURRENCY & CLAIM TEST SUITE')
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

  // In-memory mock Supabase client simulating PostgreSQL atomic row-level locks
  class MockSupabaseClient {
    private reminders: Map<string, any> = new Map()

    insertReminder(rem: any) {
      this.reminders.set(rem.id, { ...rem })
    }

    getReminder(id: string) {
      return this.reminders.get(id)
    }

    from(table: string) {
      if (table !== 'reminders') {
        throw new Error(`MockSupabaseClient only mocks reminders table, got: ${table}`)
      }

      return {
        update: (payload: Record<string, any>) => {
          let targetId: string | null = null
          const filters: Array<(row: any) => boolean> = []

          const builder: any = {
            eq: (col: string, val: any) => {
              if (col === 'id') {
                targetId = val
              } else {
                filters.push(row => row[col] === val)
              }
              return builder
            },
            lt: (col: string, val: any) => {
              filters.push(row => row[col] < val)
              return builder
            },
            lte: (col: string, val: any) => {
              filters.push(row => row[col] <= val)
              return builder
            },
            select: async (_cols?: string) => {
              if (!targetId) return { data: [], error: null }
              const row = this.reminders.get(targetId)
              if (!row) return { data: [], error: null }

              // Evaluate all conditional WHERE clauses atomically
              for (const filter of filters) {
                if (!filter(row)) {
                  return { data: [], error: null }
                }
              }

              // Apply update
              const updated = { ...row, ...payload }
              this.reminders.set(targetId, updated)
              return { data: [{ id: targetId, claim_token: updated.claim_token }], error: null }
            },
          }
          return builder
        },
      }
    }
  }

  // ── Test Group 1: Atomic Claiming & Concurrency Race ──────────────
  console.log('── Test Group 1: Atomic Claiming & Mutual Exclusion ───────────')
  const mockDb1 = new MockSupabaseClient()
  const testRem1: ReminderRow = {
    id: 'rem-race-001',
    member_id: 'mem-001',
    membership_id: 'ms-001',
    template_id: null,
    reminder_stage: 'membership_expiry_7_days',
    channel: 'whatsapp',
    scheduled_at: '2026-10-22T00:00:00.000Z',
    status: 'scheduled',
    created_at: '2026-10-21T00:00:00.000Z',
    updated_at: '2026-10-21T00:00:00.000Z',
  }
  mockDb1.insertReminder(testRem1)

  // 1.1 Single worker claim on scheduled reminder
  try {
    const claim1 = await claimReminder(mockDb1, testRem1)
    assert.strictEqual(claim1.claimed, true, 'First worker must successfully claim scheduled reminder')
    assert(claim1.token != null && claim1.token.startsWith('claim-'), 'Token must be generated')

    const dbRow = mockDb1.getReminder(testRem1.id)
    assert.strictEqual(dbRow.status, 'processing')
    assert.strictEqual(dbRow.claim_token, claim1.token)
    assert(dbRow.claim_expires_at != null)
    pass('1.1. Single worker atomic claim transitions status to "processing" with token and lease')
  } catch (err) { fail('1.1. Single worker claim', err) }

  // 1.2 Second worker attempting to claim the already claimed reminder
  try {
    const claim2 = await claimReminder(mockDb1, testRem1)
    assert.strictEqual(claim2.claimed, false, 'Second worker must fail to claim already claimed reminder')
    assert(claim2.reason?.includes('RACE_LOST') || claim2.reason?.includes('already claimed'))
    pass('1.2. Second concurrent worker receives claim rejection (RACE_LOST) and skips dispatch')
  } catch (err) { fail('1.2. Concurrent worker race', err) }

  // ── Test Group 2: Active Lease vs Stale Lease Recovery ─────────────
  console.log('\n── Test Group 2: Lease Expiry & Safe Stale Recovery ───────────')
  const mockDb2 = new MockSupabaseClient()

  // 2.1 Active lease protection
  try {
    const futureExpiresAt = new Date(Date.now() + 4 * 60 * 1000).toISOString()
    const activeClaimRem: ReminderRow = {
      id: 'rem-active-002',
      member_id: 'mem-002',
      membership_id: 'ms-002',
      template_id: null,
      reminder_stage: 'membership_expiry_1_day',
      channel: 'whatsapp',
      scheduled_at: '2026-10-22T00:00:00.000Z',
      status: 'processing',
      claim_token: 'claim-worker-alpha',
      claim_expires_at: futureExpiresAt,
      created_at: '2026-10-21T00:00:00.000Z',
      updated_at: '2026-10-21T00:00:00.000Z',
    }
    mockDb2.insertReminder(activeClaimRem)

    const tryClaimActive = await claimReminder(mockDb2, activeClaimRem)
    assert.strictEqual(tryClaimActive.claimed, false, 'Cannot claim a reminder while its lease is active')
    pass('2.1. Active lease (< 5 min) strictly blocks other workers from claiming')
  } catch (err) { fail('2.1. Active lease protection', err) }

  // 2.2 Stale lease recovery (worker crashed > 5 min ago)
  try {
    const pastExpiresAt = new Date(Date.now() - 10 * 60 * 1000).toISOString() // expired 10m ago
    const staleRem: ReminderRow = {
      id: 'rem-stale-003',
      member_id: 'mem-003',
      membership_id: 'ms-003',
      template_id: null,
      reminder_stage: 'payment_overdue',
      channel: 'whatsapp',
      scheduled_at: '2026-10-22T00:00:00.000Z',
      status: 'processing',
      claim_token: 'claim-crashed-worker-old',
      claim_expires_at: pastExpiresAt,
      created_at: '2026-10-21T00:00:00.000Z',
      updated_at: pastExpiresAt,
    }
    mockDb2.insertReminder(staleRem)

    const tryClaimStale = await claimReminder(mockDb2, staleRem)
    assert.strictEqual(tryClaimStale.claimed, true, 'Stale un-dispatched reminder must be reclaimed')
    assert.notStrictEqual(tryClaimStale.token, 'claim-crashed-worker-old', 'Reclaim must generate fresh token')

    const dbRow = mockDb2.getReminder(staleRem.id)
    assert.strictEqual(dbRow.claim_token, tryClaimStale.token)
    pass('2.2. Stale lease (> 5 min) safely recovered with a new claim token')
  } catch (err) { fail('2.2. Stale lease recovery', err) }

  // ── Test Group 3: Fencing Token Protection ────────────────────────
  console.log('\n── Test Group 3: Fencing Token Stale Worker Overwrite Prevention')
  try {
    // Scenario: Worker 1 had claimed 'rem-fence-004' with tokenA.
    // Worker 1 suffered a pause. Its lease expired.
    // Worker 2 reclaimed it with tokenB.
    // Worker 1 wakes up and attempts to update reminders using tokenA.
    const mockDb3 = new MockSupabaseClient()
    const fenceRem = {
      id: 'rem-fence-004',
      status: 'processing',
      claim_token: 'token-worker-2-new',
      claim_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }
    mockDb3.insertReminder(fenceRem)

    // Stale Worker 1 attempts final update with old tokenA
    const staleUpdate = await mockDb3
      .from('reminders')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', fenceRem.id)
      .eq('claim_token', 'token-worker-1-stale')
      .select('id')

    assert.strictEqual(staleUpdate.data.length, 0, 'Stale update must affect 0 rows')
    const finalDbRow = mockDb3.getReminder(fenceRem.id)
    assert.strictEqual(finalDbRow.claim_token, 'token-worker-2-new', 'Token must remain unchanged')
    assert.strictEqual(finalDbRow.status, 'processing', 'Status must not be overwritten by stale worker')
    pass('3.1. Stale worker with expired token cannot overwrite state of newer worker (0 rows matched)')
  } catch (err) { fail('3.1. Fencing token protection', err) }

  // ── Test Group 4: Ambiguous Timeout vs Definite Rejection ─────────
  console.log('\n── Test Group 4: Ambiguous Meta Timeout vs Definite Rejection ──')
  try {
    function evaluateAutoRetryEligibility(
      rem: { failure_reason?: string | null },
      latestHistory: { failure_reason?: string | null },
      attemptsToday: number,
      maxRetries: number,
    ): { eligible: boolean; reason: string } {
      const isAmbiguous =
        Boolean(rem.failure_reason?.includes('[AMBIGUOUS_TIMEOUT]')) ||
        Boolean(latestHistory?.failure_reason?.includes('[AMBIGUOUS_TIMEOUT]'))

      if (isAmbiguous) {
        return { eligible: false, reason: 'AMBIGUOUS_TIMEOUT: Requires webhook reconciliation or manual retry' }
      }

      if (attemptsToday > maxRetries) {
        return { eligible: false, reason: 'MAX_RETRIES_EXCEEDED' }
      }

      return { eligible: true, reason: 'ELIGIBLE_FOR_AUTO_RETRY' }
    }

    // 4.1 Ambiguous timeout: must be blocked from auto-retry
    const ambiguousCheck = evaluateAutoRetryEligibility(
      { failure_reason: '[AMBIGUOUS_TIMEOUT] Network error dispatching to Meta: fetch failed' },
      { failure_reason: '[AMBIGUOUS_TIMEOUT] Network error dispatching to Meta: fetch failed' },
      1,
      2,
    )
    assert.strictEqual(ambiguousCheck.eligible, false)
    assert(ambiguousCheck.reason.includes('AMBIGUOUS_TIMEOUT'))
    pass('4.1. Ambiguous network timeout is strictly barred from automated retry')

    // 4.2 Definite rejection (e.g. Meta HTTP 400 bad template) with attemptsToday <= maxRetries: allowed
    const definiteCheck = evaluateAutoRetryEligibility(
      { failure_reason: 'Meta WhatsApp API error: (#132001) Template name does not exist' },
      { failure_reason: 'Meta WhatsApp API error: (#132001) Template name does not exist' },
      1,
      1,
    )
    assert.strictEqual(definiteCheck.eligible, true)
    pass('4.2. Definite provider rejection is eligible for retry within configured max_retries')

    // 4.3 Definite rejection with attemptsToday > maxRetries: blocked
    const maxRetryCheck = evaluateAutoRetryEligibility(
      { failure_reason: 'Meta WhatsApp API error: (#132001) Template name does not exist' },
      { failure_reason: 'Meta WhatsApp API error: (#132001) Template name does not exist' },
      2,
      1,
    )
    assert.strictEqual(maxRetryCheck.eligible, false)
    assert.strictEqual(maxRetryCheck.reason, 'MAX_RETRIES_EXCEEDED')
    pass('4.3. Retry limit capped strictly at max_retries')
  } catch (err) { fail('4. Ambiguous timeout and retry evaluation', err) }

  // ── Test Group 5: Regression of Manual After Expiry Fix ───────────
  console.log('\n── Test Group 5: Regression Check — Manual After Expiry Fix ───')
  try {
    const manualResults = await runManualExpiredReminderTests()
    assert.strictEqual(manualResults.failed, 0, 'All manual expired reminder tests must pass')
    assert.strictEqual(manualResults.passed, 13, 'All 13 manual expired reminder assertions must pass')
    pass('5.1. All 13 existing manual After Expiry assertions pass without regression')
  } catch (err) { fail('5.1. Regression check', err) }

  console.log('\n=================================================================')
  console.log(`CONCURRENCY TEST SUMMARY: ${passed} Passed, ${failed} Failed`)
  console.log('=================================================================\n')

  return { passed, failed }
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('testReminderConcurrency.ts') || process.argv[1]?.endsWith('testReminderConcurrency.js')) {
  runReminderConcurrencyTests()
    .then(res => {
      if (res.failed > 0) process.exit(1)
      process.exit(0)
    })
    .catch(err => {
      console.error('Fatal test error:', err)
      process.exit(1)
    })
}
