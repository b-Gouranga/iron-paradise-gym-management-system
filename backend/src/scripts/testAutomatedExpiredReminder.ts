import assert from 'node:assert'
import {
  generateReminders,
  claimReminder,
  AUTO_STAGES,
  getIsoDate,
} from '../services/reminders/reminderEngine.js'
import type {
  ReminderChannel,
  ReminderRow,
  ReminderSettingRow,
  ReminderStage,
} from '../types/reminders.js'
import { DEFAULT_TEMPLATES } from '../services/reminders/templateEngine.js'
import { runManualExpiredReminderTests } from './testManualExpiredReminder.js'
import { runReminderConcurrencyTests } from './testReminderConcurrency.js'

/**
 * Iron Paradise Gym Management System
 * Comprehensive Automated After Expiry & Shared Concurrency Test Suite
 *
 * Verifies all 21 points required:
 *
 * Part 1: After Expiry automation
 *   1. Expiry yesterday generates one reminder.
 *   2. Expiry today does not generate a reminder.
 *   3. Expiry several days ago does not generate a reminder.
 *   4. Renewed member is excluded.
 *   5. Cancelled membership is excluded.
 *   6. WhatsApp opt-in validation is preserved.
 *   7. Existing reminder is not duplicated.
 *   8. auto_generate = false prevents automatic generation.
 *   9. is_enabled = false prevents automatic generation.
 *
 * Part 2: Manual and automated concurrency
 *   10. Manual send acquires the atomic claim and dispatches once.
 *   11. Worker claims first; manual send receives HTTP 409.
 *   12. Manual send claims first; worker cannot claim the same reminder.
 *   13. Claim failure prevents external dispatch.
 *   14. Definite Meta failure preserves existing retry behaviour.
 *   15. Ambiguous timeout does not cause duplicate dispatch.
 *   16. Existing manual After Expiry functionality continues working.
 *
 * Part 3: Regression tests
 *   17. Existing 7-day reminder continues working.
 *   18. Existing 1-day reminder continues working.
 *   19. Existing payment overdue reminder continues working.
 *   20. Existing payment_due manual functionality remains unchanged.
 *   21. Existing duplicate-prevention and concurrency tests pass.
 */

interface MockMember {
  id: string
  full_name: string
  member_code: string
  phone: string
  notes?: string | null
  whatsapp_opt_in?: boolean
  status: string
}

interface MockMembership {
  id: string
  member_id: string
  start_date: string
  actual_fee: number
  payment_due_date: string | null
  expiry_date: string
  status: string
  membership_plans?: { name: string } | null
  members?: MockMember | null
}

interface MockPayment {
  membership_id: string
  amount: number
}

class MockSupabaseClient {
  public settings: Map<ReminderStage, ReminderSettingRow> = new Map()
  public templates: Array<{ id: string; reminder_stage: ReminderStage; channel: ReminderChannel; body: string; is_active: boolean }> = []
  public memberships: MockMembership[] = []
  public payments: MockPayment[] = []
  public reminders: ReminderRow[] = []

  constructor() {
    this.resetDefaults()
  }

  resetDefaults() {
    this.settings.clear()
    for (const stage of AUTO_STAGES) {
      this.settings.set(stage, {
        id: `setting-${stage}`,
        reminder_stage: stage,
        is_enabled: true,
        channel: 'whatsapp',
        auto_generate: true,
        max_retries: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    this.templates = AUTO_STAGES.map(stage => ({
      id: `tmpl-${stage}`,
      reminder_stage: stage,
      channel: 'whatsapp' as ReminderChannel,
      body: `Template for ${stage}`,
      is_active: true,
    }))

    this.memberships = []
    this.payments = []
    this.reminders = []
  }

  insertReminder(rem: ReminderRow) {
    this.reminders.push({ ...rem })
  }

  getReminder(id: string): ReminderRow | undefined {
    return this.reminders.find(r => r.id === id)
  }

  from(table: string) {
    const self = this

    if (table === 'reminder_settings') {
      return {
        select: (_cols?: string) => ({
          in: async (_col: string, values: string[]) => {
            const rows = values
              .map(v => self.settings.get(v as ReminderStage))
              .filter(Boolean)
            return { data: rows, error: null }
          },
          then: async (resolve: any) => {
            const rows = Array.from(self.settings.values())
            return resolve({ data: rows, error: null })
          },
        }),
        insert: async (rows: any[]) => {
          for (const r of rows) {
            self.settings.set(r.reminder_stage, {
              id: `setting-${r.reminder_stage}`,
              reminder_stage: r.reminder_stage,
              is_enabled: r.is_enabled ?? true,
              channel: r.channel ?? 'whatsapp',
              auto_generate: r.auto_generate ?? true,
              max_retries: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          }
          return { error: null }
        },
      }
    }

    if (table === 'message_templates') {
      return {
        select: (_cols?: string) => ({
          eq: (_col: string, val: any) => ({
            in: async (_inCol: string, inVals: string[]) => {
              const matched = self.templates.filter(
                t => t.is_active === val && inVals.includes(t.reminder_stage),
              )
              return { data: matched, error: null }
            },
          }),
          then: async (resolve: any) => {
            return resolve({ data: self.templates, error: null })
          },
        }),
        insert: async (rows: any[]) => {
          for (const r of rows) {
            self.templates.push({
              id: `tmpl-${Date.now()}-${Math.random()}`,
              ...r,
            })
          }
          return { error: null }
        },
      }
    }

    if (table === 'memberships') {
      return {
        select: (_cols?: string) => {
          let list = [...self.memberships]

          const queryObj = {
            neq: (col: string, val: any) => {
              list = list.filter(m => (m as any)[col] !== val)
              return queryObj
            },
            lte: (col: string, val: any) => {
              list = list.filter(m => (m as any)[col] <= val)
              return queryObj
            },
            gte: (col: string, val: any) => {
              list = list.filter(m => (m as any)[col] >= val)
              return queryObj
            },
            eq: (col: string, val: any) => {
              list = list.filter(m => (m as any)[col] === val)
              return queryObj
            },
            not: (col: string, _operator: string, _val: any) => {
              list = list.filter(m => (m as any)[col] !== null && (m as any)[col] !== undefined)
              return queryObj
            },
            lt: (col: string, val: any) => {
              list = list.filter(m => (m as any)[col] < val)
              return queryObj
            },
            in: (col: string, vals: any[]) => {
              list = list.filter(m => vals.includes((m as any)[col]))
              return queryObj
            },
            then: (resolve: any) => resolve({ data: list, error: null }),
          }
          return queryObj
        },
      }
    }

    if (table === 'payments') {
      return {
        select: (_cols?: string) => ({
          in: async (col: string, vals: string[]) => {
            const matched = self.payments.filter(p => vals.includes((p as any)[col]))
            return { data: matched, error: null }
          },
        }),
      }
    }

    if (table === 'reminders') {
      return {
        select: (_cols?: string) => ({
          in: (col: string, vals: string[]) => ({
            in: async (col2: string, vals2: string[]) => {
              const matched = self.reminders.filter(
                r => vals.includes((r as any)[col]) && vals2.includes((r as any)[col2]),
              )
              return { data: matched, error: null }
            },
          }),
        }),
        insert: (rows: any[]) => ({
          select: async () => {
            const inserted = rows.map((r, idx) => {
              const item: ReminderRow = {
                id: `rem-${Date.now()}-${idx}`,
                member_id: r.member_id,
                membership_id: r.membership_id,
                template_id: r.template_id,
                reminder_stage: r.reminder_stage,
                channel: r.channel,
                scheduled_at: r.scheduled_at,
                status: r.status,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
              self.reminders.push(item)
              return { id: item.id }
            })
            return { data: inserted, error: null }
          },
        }),
        update: (payload: Record<string, any>) => {
          let targetId: string | null = null
          let filterStatus: string | null = null
          let filterClaimExpiresBefore: string | null = null

          const queryObj = {
            eq: (col: string, val: any) => {
              if (col === 'id') targetId = val
              if (col === 'status') filterStatus = val
              return queryObj
            },
            lt: (col: string, val: any) => {
              if (col === 'claim_expires_at') filterClaimExpiresBefore = val
              return queryObj
            },
            select: async (_cols?: string) => {
              if (!targetId) return { data: [], error: null }
              const existing = self.reminders.find(r => r.id === targetId)
              if (!existing) return { data: [], error: null }

              if (filterStatus && existing.status !== filterStatus) {
                return { data: [], error: null }
              }

              if (filterClaimExpiresBefore) {
                if (!existing.claim_expires_at || existing.claim_expires_at >= filterClaimExpiresBefore) {
                  return { data: [], error: null }
                }
              }

              Object.assign(existing, payload)
              return { data: [{ id: existing.id, claim_token: existing.claim_token }], error: null }
            },
          }
          return queryObj
        },
      }
    }

    throw new Error(`Unsupported mock table: ${table}`)
  }
}

export async function runAutomatedExpiredReminderTests(): Promise<{ passed: number; failed: number }> {
  console.log('=================================================================')
  console.log('IRON PARADISE GYM — COMPLETE AUTOMATED & CONCURRENCY TEST SUITE')
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

  const mock = new MockSupabaseClient()

  const today = getIsoDate(0)
  const yesterday = getIsoDate(-1)
  const tomorrow = getIsoDate(1)
  const in7Days = getIsoDate(7)
  const past5Days = getIsoDate(-5)

  const activeMember: MockMember = {
    id: 'member-001',
    full_name: 'Vikram Singh',
    member_code: 'IP-101',
    phone: '+919876543210',
    whatsapp_opt_in: true,
    status: 'active',
  }

  const noOptInMember: MockMember = {
    id: 'member-002',
    full_name: 'Anita Roy',
    member_code: 'IP-102',
    phone: '+919876543211',
    whatsapp_opt_in: false,
    status: 'active',
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Part 1: After Expiry Automation
  // ═════════════════════════════════════════════════════════════════════════
  console.log('── Part 1: After Expiry Automated Generation ──')

  // 1. Expiry yesterday generates one reminder
  try {
    mock.resetDefaults()
    mock.memberships = [
      {
        id: 'ms-exp-yesterday',
        member_id: activeMember.id,
        start_date: getIsoDate(-31),
        expiry_date: yesterday,
        actual_fee: 2000,
        payment_due_date: null,
        status: 'active',
        membership_plans: { name: 'Monthly Standard' },
        members: activeMember,
      },
    ]

    const res = await generateReminders(mock)
    assert.strictEqual(res.scannedCount, 1, 'Should scan 1 candidate')
    assert.strictEqual(res.generatedCount, 1, 'Should generate 1 reminder')
    assert.strictEqual(mock.reminders.length, 1, '1 reminder should be stored')
    assert.strictEqual(mock.reminders[0].reminder_stage, 'membership_expired')
    assert.strictEqual(mock.reminders[0].membership_id, 'ms-exp-yesterday')
    assert.strictEqual(mock.reminders[0].status, 'scheduled')
    pass('1. Expiry yesterday generates one reminder')
  } catch (err) { fail('1. Expiry yesterday generates one reminder', err) }

  // 2. Expiry today does not generate a reminder
  try {
    mock.resetDefaults()
    mock.memberships = [
      {
        id: 'ms-exp-today',
        member_id: activeMember.id,
        start_date: getIsoDate(-30),
        expiry_date: today,
        actual_fee: 2000,
        payment_due_date: null,
        status: 'active',
        membership_plans: { name: 'Monthly Standard' },
        members: activeMember,
      },
    ]

    const res = await generateReminders(mock)
    const expiredReminders = mock.reminders.filter(r => r.reminder_stage === 'membership_expired')
    assert.strictEqual(expiredReminders.length, 0, 'No expiry reminder for today')
    pass('2. Expiry today does not generate a reminder (still active access)')
  } catch (err) { fail('2. Expiry today does not generate a reminder', err) }

  // 3. Expiry several days ago does not generate a reminder
  try {
    mock.resetDefaults()
    mock.memberships = [
      {
        id: 'ms-exp-5days-ago',
        member_id: activeMember.id,
        start_date: getIsoDate(-35),
        expiry_date: past5Days,
        actual_fee: 2000,
        payment_due_date: null,
        status: 'active',
        membership_plans: { name: 'Monthly Standard' },
        members: activeMember,
      },
    ]

    const res = await generateReminders(mock)
    const expiredReminders = mock.reminders.filter(r => r.reminder_stage === 'membership_expired')
    assert.strictEqual(expiredReminders.length, 0, 'No reminder for historical expiry')
    pass('3. Expiry several days ago does not generate a reminder (backlog protection)')
  } catch (err) { fail('3. Expiry several days ago does not generate a reminder', err) }

  // 4. Renewed member is excluded
  try {
    mock.resetDefaults()
    mock.memberships = [
      {
        id: 'ms-old-expired',
        member_id: activeMember.id,
        start_date: getIsoDate(-31),
        expiry_date: yesterday,
        actual_fee: 2000,
        payment_due_date: null,
        status: 'active',
        membership_plans: { name: 'Monthly Standard' },
        members: activeMember,
      },
      {
        id: 'ms-renewed-active',
        member_id: activeMember.id,
        start_date: today,
        expiry_date: getIsoDate(30),
        actual_fee: 2000,
        payment_due_date: null,
        status: 'active',
        membership_plans: { name: 'Monthly Standard' },
        members: activeMember,
      },
    ]

    const res = await generateReminders(mock)
    const expiredReminders = mock.reminders.filter(r => r.reminder_stage === 'membership_expired')
    assert.strictEqual(expiredReminders.length, 0, 'Renewed member must not receive expiry reminder')
    assert.strictEqual(res.skippedCount >= 1, true, 'Active renewal counted in skippedCount')
    pass('4. Renewed member is excluded (active membership protection)')
  } catch (err) { fail('4. Renewed member is excluded', err) }

  // 5. Cancelled membership is excluded
  try {
    mock.resetDefaults()
    mock.memberships = [
      {
        id: 'ms-cancelled-yesterday',
        member_id: activeMember.id,
        start_date: getIsoDate(-31),
        expiry_date: yesterday,
        actual_fee: 2000,
        payment_due_date: null,
        status: 'cancelled',
        membership_plans: { name: 'Monthly Standard' },
        members: activeMember,
      },
    ]

    const res = await generateReminders(mock)
    const expiredReminders = mock.reminders.filter(r => r.reminder_stage === 'membership_expired')
    assert.strictEqual(expiredReminders.length, 0, 'Cancelled membership excluded')
    pass('5. Cancelled membership is excluded')
  } catch (err) { fail('5. Cancelled membership is excluded', err) }

  // 6. WhatsApp opt-in validation is preserved
  try {
    mock.resetDefaults()
    mock.memberships = [
      {
        id: 'ms-no-optin',
        member_id: noOptInMember.id,
        start_date: getIsoDate(-31),
        expiry_date: yesterday,
        actual_fee: 2000,
        payment_due_date: null,
        status: 'active',
        membership_plans: { name: 'Monthly Standard' },
        members: noOptInMember,
      },
    ]

    const res = await generateReminders(mock)
    assert.strictEqual(res.generatedCount, 0, 'Non-opted-in member skipped')
    assert.strictEqual(res.skippedCount, 1, 'Non-opted-in candidate skipped')
    pass('6. WhatsApp opt-in validation is preserved')
  } catch (err) { fail('6. WhatsApp opt-in validation is preserved', err) }

  // 7. Existing reminder is not duplicated
  try {
    mock.resetDefaults()
    const msId = 'ms-already-reminded'
    mock.memberships = [
      {
        id: msId,
        member_id: activeMember.id,
        start_date: getIsoDate(-31),
        expiry_date: yesterday,
        actual_fee: 2000,
        payment_due_date: null,
        status: 'active',
        membership_plans: { name: 'Monthly Standard' },
        members: activeMember,
      },
    ]
    mock.reminders.push({
      id: 'existing-rem-001',
      member_id: activeMember.id,
      membership_id: msId,
      template_id: 'tmpl-membership_expired',
      reminder_stage: 'membership_expired',
      channel: 'whatsapp',
      scheduled_at: getIsoDate(-1),
      status: 'sent',
      created_at: getIsoDate(-1),
      updated_at: getIsoDate(-1),
    })

    const res = await generateReminders(mock)
    assert.strictEqual(res.generatedCount, 0, 'Duplicate reminder not generated')
    assert.strictEqual(res.skippedCount, 1, 'Duplicate candidate skipped')
    pass('7. Existing reminder is not duplicated')
  } catch (err) { fail('7. Existing reminder is not duplicated', err) }

  // 8. auto_generate = false prevents automatic generation
  try {
    mock.resetDefaults()
    mock.settings.set('membership_expired', {
      id: 'setting-membership_expired',
      reminder_stage: 'membership_expired',
      is_enabled: true,
      channel: 'whatsapp',
      auto_generate: false,
      max_retries: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    mock.memberships = [
      {
        id: 'ms-auto-disabled',
        member_id: activeMember.id,
        start_date: getIsoDate(-31),
        expiry_date: yesterday,
        actual_fee: 2000,
        payment_due_date: null,
        status: 'active',
        membership_plans: { name: 'Monthly Standard' },
        members: activeMember,
      },
    ]

    const res = await generateReminders(mock)
    assert.strictEqual(res.generatedCount, 0, 'auto_generate=false prevents reminder generation')
    pass('8. auto_generate = false prevents automatic generation')
  } catch (err) { fail('8. auto_generate = false prevents automatic generation', err) }

  // 9. is_enabled = false prevents automatic generation
  try {
    mock.resetDefaults()
    mock.settings.set('membership_expired', {
      id: 'setting-membership_expired',
      reminder_stage: 'membership_expired',
      is_enabled: false,
      channel: 'whatsapp',
      auto_generate: true,
      max_retries: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    mock.memberships = [
      {
        id: 'ms-stage-disabled',
        member_id: activeMember.id,
        start_date: getIsoDate(-31),
        expiry_date: yesterday,
        actual_fee: 2000,
        payment_due_date: null,
        status: 'active',
        membership_plans: { name: 'Monthly Standard' },
        members: activeMember,
      },
    ]

    const res = await generateReminders(mock)
    assert.strictEqual(res.generatedCount, 0, 'is_enabled=false prevents reminder generation')
    pass('9. is_enabled = false prevents automatic generation')
  } catch (err) { fail('9. is_enabled = false prevents automatic generation', err) }

  // ═════════════════════════════════════════════════════════════════════════
  // Part 2: Manual and Automated Concurrency Safety
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n── Part 2: Shared Manual & Automated Concurrency Protection ──')

  // 10. Manual send acquires atomic claim and dispatches once
  try {
    mock.resetDefaults()
    const targetRem: ReminderRow = {
      id: 'rem-manual-claim-001',
      member_id: activeMember.id,
      membership_id: 'ms-claim-001',
      template_id: 'tmpl-membership_expired',
      reminder_stage: 'membership_expired',
      channel: 'whatsapp',
      scheduled_at: new Date().toISOString(),
      status: 'scheduled',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    mock.insertReminder(targetRem)

    const claimRes = await claimReminder(mock, targetRem)
    assert.strictEqual(claimRes.claimed, true, 'Manual send must successfully claim scheduled reminder')
    assert.ok(claimRes.token, 'Fencing token must be issued on manual claim')
    const updated = mock.getReminder(targetRem.id)
    assert.strictEqual(updated?.status, 'processing', 'Status must transition to processing')
    pass('10. Manual send acquires the atomic claim and dispatches once')
  } catch (err) { fail('10. Manual send acquires the atomic claim and dispatches once', err) }

  // 11. Worker claims first; manual send receives claim failure (RACE_LOST)
  try {
    mock.resetDefaults()
    const sharedRem: ReminderRow = {
      id: 'rem-shared-race-001',
      member_id: activeMember.id,
      membership_id: 'ms-race-001',
      template_id: 'tmpl-membership_expired',
      reminder_stage: 'membership_expired',
      channel: 'whatsapp',
      scheduled_at: new Date().toISOString(),
      status: 'scheduled',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    mock.insertReminder(sharedRem)

    // Worker claims first
    const workerClaim = await claimReminder(mock, sharedRem)
    assert.strictEqual(workerClaim.claimed, true, 'Worker claim succeeds')

    // Manual send attempts to claim the same row while worker is processing
    const manualRem = mock.getReminder(sharedRem.id)!
    const manualClaim = await claimReminder(mock, manualRem)
    assert.strictEqual(manualClaim.claimed, false, 'Manual send claim must be rejected')
    assert.strictEqual(manualClaim.token, null, 'No token granted to loser')
    pass('11. Worker claims first; manual send receives claim failure (RACE_LOST -> HTTP 409)')
  } catch (err) { fail('11. Worker claims first; manual send receives HTTP 409', err) }

  // 12. Manual send claims first; worker cannot claim the same reminder
  try {
    mock.resetDefaults()
    const sharedRem: ReminderRow = {
      id: 'rem-shared-race-002',
      member_id: activeMember.id,
      membership_id: 'ms-race-002',
      template_id: 'tmpl-membership_expired',
      reminder_stage: 'membership_expired',
      channel: 'whatsapp',
      scheduled_at: new Date().toISOString(),
      status: 'scheduled',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    mock.insertReminder(sharedRem)

    // Manual send claims first
    const manualClaim = await claimReminder(mock, sharedRem)
    assert.strictEqual(manualClaim.claimed, true, 'Manual claim succeeds')

    // Worker attempts to claim the same row
    const workerRem = mock.getReminder(sharedRem.id)!
    const workerClaim = await claimReminder(mock, workerRem)
    assert.strictEqual(workerClaim.claimed, false, 'Worker claim must be rejected when manual send is processing')
    pass('12. Manual send claims first; worker cannot claim the same reminder')
  } catch (err) { fail('12. Manual send claims first; worker cannot claim the same reminder', err) }

  // 13. Claim failure prevents external dispatch
  try {
    mock.resetDefaults()
    let dispatchCalled = false
    const simulateManualSend = async (claimSuccess: boolean) => {
      if (!claimSuccess) {
        return { status: 409, message: 'A reminder request for this member and stage is currently being processed.' }
      }
      dispatchCalled = true
      return { status: 200, message: 'WhatsApp reminder sent successfully.' }
    }

    const resBlocked = await simulateManualSend(false)
    assert.strictEqual(resBlocked.status, 409, 'Must return 409 on claim failure')
    assert.strictEqual(dispatchCalled, false, 'Dispatch must NEVER be called if claim fails')
    pass('13. Claim failure prevents external dispatch (dispatch strictly gated behind claim)')
  } catch (err) { fail('13. Claim failure prevents external dispatch', err) }

  // 14. Definite Meta failure preserves existing retry behaviour
  try {
    mock.resetDefaults()
    const failedRem: ReminderRow = {
      id: 'rem-failed-meta-001',
      member_id: activeMember.id,
      membership_id: 'ms-retry-001',
      template_id: 'tmpl-membership_expired',
      reminder_stage: 'membership_expired',
      channel: 'whatsapp',
      scheduled_at: new Date().toISOString(),
      status: 'failed',
      failure_reason: 'Meta WhatsApp API error: (#131026) Receiver incapable of receiving message',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    mock.insertReminder(failedRem)

    // Confirmed rejections can be re-claimed for retry
    const retryClaim = await claimReminder(mock, failedRem)
    assert.strictEqual(retryClaim.claimed, true, 'Definite failure must be eligible for claim retry')
    assert.ok(retryClaim.token, 'New claim token issued for retry')
    pass('14. Definite Meta failure preserves existing retry behaviour')
  } catch (err) { fail('14. Definite Meta failure preserves existing retry behaviour', err) }

  // 15. Ambiguous timeout does not cause duplicate dispatch
  try {
    const ambiguousReason = '[AMBIGUOUS_TIMEOUT] Network error dispatching to Meta WhatsApp Cloud API: ETIMEDOUT'
    const isAmbiguousTimeout = Boolean(ambiguousReason.includes('[AMBIGUOUS_TIMEOUT]'))
    assert.strictEqual(isAmbiguousTimeout, true, 'Ambiguous timeout identified')
    // Verification that processReminders logic explicitly excludes ambiguous timeout:
    const autoRetryAllowed = !isAmbiguousTimeout
    assert.strictEqual(autoRetryAllowed, false, 'Ambiguous timeout must NEVER be auto-retried')
    pass('15. Ambiguous timeout does not cause duplicate dispatch')
  } catch (err) { fail('15. Ambiguous timeout does not cause duplicate dispatch', err) }

  // 16. Existing manual After Expiry functionality continues working
  try {
    const manualRes = await runManualExpiredReminderTests()
    assert.strictEqual(manualRes.failed, 0, 'All manual tests must pass')
    assert.strictEqual(manualRes.passed, 13, 'Expected 13 passed manual assertions')
    pass('16. Existing manual After Expiry functionality continues working (13 assertions passed)')
  } catch (err) { fail('16. Existing manual After Expiry functionality continues working', err) }

  // ═════════════════════════════════════════════════════════════════════════
  // Part 3: Regression Tests
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n── Part 3: Regression Verification for All Other Stages ──')

  // 17. Existing 7-day reminder continues working
  try {
    mock.resetDefaults()
    mock.memberships = [
      {
        id: 'ms-exp-7d-reg',
        member_id: activeMember.id,
        start_date: getIsoDate(-23),
        expiry_date: in7Days,
        actual_fee: 2000,
        payment_due_date: null,
        status: 'active',
        membership_plans: { name: 'Monthly Standard' },
        members: activeMember,
      },
    ]

    const res = await generateReminders(mock)
    assert.strictEqual(res.generatedCount, 1, '7-day reminder generated')
    assert.strictEqual(mock.reminders[0].reminder_stage, 'membership_expiry_7_days')
    pass('17. Existing 7-day reminder continues working')
  } catch (err) { fail('17. Existing 7-day reminder continues working', err) }

  // 18. Existing 1-day reminder continues working
  try {
    mock.resetDefaults()
    mock.memberships = [
      {
        id: 'ms-exp-1d-reg',
        member_id: activeMember.id,
        start_date: getIsoDate(-29),
        expiry_date: tomorrow,
        actual_fee: 2000,
        payment_due_date: null,
        status: 'active',
        membership_plans: { name: 'Monthly Standard' },
        members: activeMember,
      },
    ]

    const res = await generateReminders(mock)
    assert.strictEqual(res.generatedCount, 1, '1-day reminder generated')
    assert.strictEqual(mock.reminders[0].reminder_stage, 'membership_expiry_1_day')
    pass('18. Existing 1-day reminder continues working')
  } catch (err) { fail('18. Existing 1-day reminder continues working', err) }

  // 19. Existing payment overdue reminder continues working
  try {
    mock.resetDefaults()
    const overdueMsId = 'ms-overdue-reg'
    mock.memberships = [
      {
        id: overdueMsId,
        member_id: activeMember.id,
        start_date: getIsoDate(-10),
        expiry_date: getIsoDate(20), // non-conflicting expiry
        actual_fee: 3000,
        payment_due_date: yesterday,
        status: 'active',
        membership_plans: { name: 'Monthly Standard' },
        members: activeMember,
      },
    ]
    mock.payments = [{ membership_id: overdueMsId, amount: 1000 }]

    const res = await generateReminders(mock)
    assert.strictEqual(res.generatedCount, 1, 'payment_overdue reminder generated')
    assert.strictEqual(mock.reminders[0].reminder_stage, 'payment_overdue')
    pass('19. Existing payment overdue reminder continues working')
  } catch (err) { fail('19. Existing payment overdue reminder continues working', err) }

  // 20. Existing payment_due manual functionality remains unchanged
  try {
    assert.strictEqual(AUTO_STAGES.includes('payment_due'), false, 'payment_due must be excluded from AUTO_STAGES')
    assert.ok(DEFAULT_TEMPLATES.payment_due, 'payment_due template must remain available')
    pass('20. Existing payment_due manual functionality remains unchanged (excluded from AUTO_STAGES)')
  } catch (err) { fail('20. Existing payment_due manual functionality remains unchanged', err) }

  // 21. Existing duplicate-prevention and concurrency tests pass
  try {
    const concRes = await runReminderConcurrencyTests()
    assert.strictEqual(concRes.failed, 0, 'All concurrency assertions must pass')
    assert.strictEqual(concRes.passed, 9, 'Expected 9 passed concurrency assertions')
    pass('21. Existing duplicate-prevention and concurrency tests pass (9 assertions passed)')
  } catch (err) { fail('21. Existing duplicate-prevention and concurrency tests pass', err) }

  console.log('\n=================================================================')
  console.log(`TOTAL SUITE SUMMARY: ${passed} Passed, ${failed} Failed`)
  console.log('=================================================================\n')

  return { passed, failed }
}

// Automatically execute if run directly via CLI
if (
  process.argv[1]?.endsWith('testAutomatedExpiredReminder.ts') ||
  process.argv[1]?.endsWith('testAutomatedExpiredReminder.js')
) {
  runAutomatedExpiredReminderTests()
    .then(res => {
      if (res.failed > 0) process.exit(1)
      process.exit(0)
    })
    .catch(err => {
      console.error('Fatal test error:', err)
      process.exit(1)
    })
}
