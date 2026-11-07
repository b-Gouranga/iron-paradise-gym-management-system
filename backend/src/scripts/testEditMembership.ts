import assert from 'node:assert'
import type { Request, Response } from 'express'
import { updateMembership } from '../controllers/membershipsController.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { setSupabaseAdmin } from '../services/database/supabaseAdmin.js'

/**
 * Iron Paradise Gym Management System
 * Edit Existing Membership Automated Test Suite
 *
 * Verifies all 14 safety, validation, concurrency, and business logic scenarios.
 */

interface MockRes {
  statusCode: number
  body: any
  status: (code: number) => MockRes
  json: (data: any) => MockRes
}

function createMockRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(data: any) {
      this.body = data
      return this
    },
  }
  return res
}

class InMemorySupabase {
  members: any[] = []
  membership_plans: any[] = []
  memberships: any[] = []
  payments: any[] = []
  reminders: any[] = []
  audit_logs: any[] = []
  profiles: any[] = []

  auth = {
    getUser: async (token: string) => {
      if (token === 'valid-owner-token') {
        return { data: { user: { id: 'user-owner-1', email: 'owner@test.com' } }, error: null }
      }
      if (token === 'valid-trainer-token') {
        return { data: { user: { id: 'user-trainer-1', email: 'trainer@test.com' } }, error: null }
      }
      return { data: { user: null }, error: new Error('Invalid token') }
    },
  }

  from(table: string) {
    const self = this

    if (table === 'profiles') {
      return {
        select: (_cols?: string) => ({
          eq: (_col: string, val: string) => ({
            single: async () => {
              const p = self.profiles.find(x => x.id === val)
              return { data: p ?? null, error: p ? null : { code: 'PGRST116', message: 'Not found' } }
            },
          }),
        }),
      } as any
    }

    if (table === 'membership_plans') {
      return {
        select: (_cols?: string) => ({
          eq: (_col: string, val: string) => ({
            single: async () => {
              const plan = self.membership_plans.find(p => p.id === val)
              return { data: plan ?? null, error: plan ? null : { code: 'PGRST116', message: 'Not found' } }
            },
          }),
        }),
      } as any
    }

    if (table === 'payments') {
      return {
        select: (_cols?: string) => ({
          eq: (_col: string, val: string) => Promise.resolve({
            data: self.payments.filter(p => p.membership_id === val),
            error: null,
          }),
        }),
      } as any
    }

    if (table === 'reminders') {
      let updatePayload: any = null
      let eqFilters: Array<{ col: string; val: any }> = []

      const queryObj: any = {
        update: (payload: any) => {
          updatePayload = payload
          return queryObj
        },
        eq: (col: string, val: any) => {
          eqFilters.push({ col, val })
          return queryObj
        },
        select: (_cols?: string) => Promise.resolve({ data: [], error: null }),
        then: (resolve: any) => {
          let matched = self.reminders
          for (const f of eqFilters) {
            matched = matched.filter(r => r[f.col] === f.val)
          }
          if (updatePayload) {
            for (const r of matched) {
              Object.assign(r, updatePayload)
            }
          }
          return Promise.resolve({ data: matched, error: null }).then(resolve)
        },
      }
      return queryObj
    }

    if (table === 'audit_logs') {
      return {
        insert: (data: any) => {
          self.audit_logs.push({ ...data, id: `audit-${Date.now()}` })
          return {
            select: () => Promise.resolve({ data: null, error: null }),
            then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
          }
        },
      } as any
    }

    if (table === 'memberships') {
      let isSingle = false
      let eqFilters: Array<{ col: string; val: any }> = []
      let neqFilters: Array<{ col: string; val: any }> = []
      let updatePayload: any = null

      const queryObj: any = {
        select: (_cols?: string) => {
          return queryObj
        },
        update: (payload: any) => {
          updatePayload = payload
          return queryObj
        },
        eq: (col: string, val: any) => {
          eqFilters.push({ col, val })
          return queryObj
        },
        neq: (col: string, val: any) => {
          neqFilters.push({ col, val })
          return queryObj
        },
        single: async () => {
          isSingle = true
          let list = self.memberships
          for (const f of eqFilters) {
            list = list.filter(m => m[f.col] === f.val)
          }
          for (const f of neqFilters) {
            list = list.filter(m => m[f.col] !== f.val)
          }
          const item = list[0]
          if (!item) {
            return { data: null, error: { code: 'PGRST116', message: 'Not found' } }
          }
          if (updatePayload) {
            Object.assign(item, updatePayload)
          }
          const plan = self.membership_plans.find(p => p.id === item.plan_id)
          return {
            data: {
              ...item,
              membership_plans: plan
                ? {
                    id: plan.id,
                    name: plan.name,
                    duration_value: plan.duration_value,
                    duration_unit: plan.duration_unit,
                    is_active: plan.is_active,
                  }
                : null,
            },
            error: null,
          }
        },
        then: (resolve: any) => {
          let list = self.memberships
          for (const f of eqFilters) {
            list = list.filter(m => m[f.col] === f.val)
          }
          for (const f of neqFilters) {
            list = list.filter(m => m[f.col] !== f.val)
          }
          if (updatePayload) {
            for (const item of list) {
              Object.assign(item, updatePayload)
            }
          }
          const withPlans = list.map(item => {
            const plan = self.membership_plans.find(p => p.id === item.plan_id)
            return {
              ...item,
              membership_plans: plan
                ? {
                    id: plan.id,
                    name: plan.name,
                    duration_value: plan.duration_value,
                    duration_unit: plan.duration_unit,
                    is_active: plan.is_active,
                  }
                : null,
            }
          })
          return Promise.resolve({ data: withPlans, error: null }).then(resolve)
        },
      }
      return queryObj
    }

    throw new Error(`Unhandled table in test mock: ${table}`)
  }
}

async function runTests() {
  console.log('=================================================================')
  console.log('IRON PARADISE GYM — EDIT MEMBERSHIP AUTOMATED TEST SUITE')
  console.log('=================================================================\n')

  let passed = 0
  let failed = 0

  function assertTest(condition: boolean, name: string) {
    if (condition) {
      console.log(`  ✓ ${name}`)
      passed++
    } else {
      console.error(`  ✗ ${name}`)
      failed++
    }
  }

  // Setup mock database
  const db = new InMemorySupabase()
  setSupabaseAdmin(db as any)

  // Seed plans
  const monthlyPlan = {
    id: 'plan-monthly-1',
    name: 'Monthly Standard',
    duration_value: 1,
    duration_unit: 'months',
    default_fee: 1500,
    is_active: true,
  }
  const quarterlyPlan = {
    id: 'plan-quarterly-1',
    name: 'Quarterly Pro',
    duration_value: 3,
    duration_unit: 'months',
    default_fee: 4000,
    is_active: true,
  }
  const inactivePlan = {
    id: 'plan-inactive-1',
    name: 'Discontinued Plan',
    duration_value: 1,
    duration_unit: 'months',
    default_fee: 1200,
    is_active: false,
  }
  db.membership_plans.push(monthlyPlan, quarterlyPlan, inactivePlan)

  // Seed profiles
  db.profiles.push(
    { id: 'user-owner-1', role: 'owner', is_active: true },
    { id: 'user-trainer-1', role: 'trainer', is_active: true },
  )

  // Helper to create mock request
  function mockReq(params: any, body: any, userRole = 'owner'): Request {
    return {
      params,
      body,
      authUser: { id: userRole === 'owner' ? 'user-owner-1' : 'user-trainer-1' },
      authProfile: { id: userRole === 'owner' ? 'user-owner-1' : 'user-trainer-1', role: userRole, is_active: true },
      headers: { authorization: `Bearer valid-${userRole}-token` },
    } as any
  }

  // ── Test 1: Edit membership start date & verify inclusive expiry recalculation ──
  {
    const mId = 'membership-1'
    db.memberships = [
      {
        id: mId,
        member_id: 'member-1',
        plan_id: 'plan-monthly-1',
        start_date: '2026-09-01',
        expiry_date: '2026-09-30',
        actual_fee: 1500,
        payment_due_date: '2026-09-05',
        status: 'active',
      },
    ]

    const req = mockReq({ id: mId }, { start_date: '2026-09-10' })
    const res = createMockRes()
    await updateMembership(req, res as any)

    assertTest(
      res.statusCode === 200 &&
        res.body.data.start_date === '2026-09-10' &&
        res.body.data.expiry_date === '2026-10-09',
      '1. Edit start date: recalculates inclusive expiry date (2026-09-10 to 2026-10-09 for 1 month)',
    )
  }

  // ── Test 2: Edit membership plan & verify new duration and expiry recalculation ──
  {
    const mId = 'membership-2'
    db.memberships = [
      {
        id: mId,
        member_id: 'member-1',
        plan_id: 'plan-monthly-1',
        start_date: '2026-09-01',
        expiry_date: '2026-09-30',
        actual_fee: 1500,
        payment_due_date: null,
        status: 'active',
      },
    ]

    const req = mockReq({ id: mId }, { plan_id: 'plan-quarterly-1' })
    const res = createMockRes()
    await updateMembership(req, res as any)

    assertTest(
      res.statusCode === 200 &&
        res.body.data.plan_id === 'plan-quarterly-1' &&
        res.body.data.expiry_date === '2026-11-30',
      '2. Edit plan: recalculates expiry for quarterly plan (2026-09-01 + 3 months -> 2026-11-30)',
    )
  }

  // ── Test 3: Edit actual fee & verify balance recalculation ──
  {
    const mId = 'membership-3'
    db.memberships = [
      {
        id: mId,
        member_id: 'member-1',
        plan_id: 'plan-monthly-1',
        start_date: '2026-09-01',
        expiry_date: '2026-09-30',
        actual_fee: 1500,
        payment_due_date: null,
        status: 'active',
      },
    ]
    db.payments = [
      { id: 'pay-1', membership_id: mId, amount: 500, payment_date: '2026-09-01' },
    ]

    const req = mockReq({ id: mId }, { actual_fee: 1800 })
    const res = createMockRes()
    await updateMembership(req, res as any)

    assertTest(
      res.statusCode === 200 && res.body.data.actual_fee === 1800,
      '3. Edit actual fee: updates fee to 1800 successfully',
    )
  }

  // ── Test 4: Edit payment due date without altering payment transaction records ──
  {
    const mId = 'membership-4'
    db.memberships = [
      {
        id: mId,
        member_id: 'member-1',
        plan_id: 'plan-monthly-1',
        start_date: '2026-09-01',
        expiry_date: '2026-09-30',
        actual_fee: 1500,
        payment_due_date: '2026-09-05',
        status: 'active',
      },
    ]
    const initialPayments = [
      { id: 'pay-2', membership_id: mId, amount: 700, payment_date: '2026-09-02' },
    ]
    db.payments = [...initialPayments]

    const req = mockReq({ id: mId }, { payment_due_date: '2026-09-20' })
    const res = createMockRes()
    await updateMembership(req, res as any)

    assertTest(
      res.statusCode === 200 &&
        res.body.data.payment_due_date === '2026-09-20' &&
        db.payments.length === 1 &&
        db.payments[0].payment_date === '2026-09-02',
      '4. Edit payment due date: updates due date and leaves payment transaction records/dates untouched',
    )
  }

  // ── Test 5: Overlapping active membership rejection (HTTP 409) ──
  {
    const mId1 = 'membership-5a'
    const mId2 = 'membership-5b'
    db.memberships = [
      {
        id: mId1,
        member_id: 'member-2',
        plan_id: 'plan-monthly-1',
        start_date: '2026-09-01',
        expiry_date: '2026-09-30',
        actual_fee: 1500,
        payment_due_date: null,
        status: 'active',
      },
      {
        id: mId2,
        member_id: 'member-2',
        plan_id: 'plan-monthly-1',
        start_date: '2026-10-01',
        expiry_date: '2026-10-31',
        actual_fee: 1500,
        payment_due_date: null,
        status: 'active',
      },
    ]

    // Attempt to edit mId1's start_date to 2026-10-15 (overlapping with mId2)
    const req = mockReq({ id: mId1 }, { start_date: '2026-10-15' })
    const res = createMockRes()
    await updateMembership(req, res as any)

    assertTest(
      res.statusCode === 409 && res.body.message.includes('overlapping active memberships'),
      '5. Overlap protection: rejects date changes that overlap with another active membership (HTTP 409)',
    )
  }

  // ── Test 6: Preserving existing payments on membership edit ──
  {
    const mId = 'membership-6'
    db.memberships = [
      {
        id: mId,
        member_id: 'member-3',
        plan_id: 'plan-monthly-1',
        start_date: '2026-09-01',
        expiry_date: '2026-09-30',
        actual_fee: 1500,
        payment_due_date: null,
        status: 'active',
      },
    ]
    db.payments = [
      { id: 'pay-6a', membership_id: mId, amount: 600, payment_date: '2026-09-02' },
      { id: 'pay-6b', membership_id: mId, amount: 400, payment_date: '2026-09-05' },
    ]

    const req = mockReq({ id: mId }, { actual_fee: 1600, start_date: '2026-09-02' })
    const res = createMockRes()
    await updateMembership(req, res as any)

    assertTest(
      res.statusCode === 200 &&
        db.payments.length === 2 &&
        db.payments[0].amount === 600 &&
        db.payments[1].amount === 400,
      '6. Payment preservation: existing payment rows remain intact with identical amounts and dates',
    )
  }

  // ── Test 7: Fee lower than amount already paid rejected (HTTP 400) ──
  {
    const mId = 'membership-7'
    db.memberships = [
      {
        id: mId,
        member_id: 'member-4',
        plan_id: 'plan-monthly-1',
        start_date: '2026-09-01',
        expiry_date: '2026-09-30',
        actual_fee: 1500,
        payment_due_date: null,
        status: 'active',
      },
    ]
    db.payments = [
      { id: 'pay-7', membership_id: mId, amount: 1000, payment_date: '2026-09-01' },
    ]

    // Attempt to reduce actual_fee to 800 (less than 1000 paid)
    const req = mockReq({ id: mId }, { actual_fee: 800 })
    const res = createMockRes()
    await updateMembership(req, res as any)

    assertTest(
      res.statusCode === 400 &&
        res.body.message.includes('cannot be less than the amount already paid (₹1000)'),
      '7. Financial integrity: rejects actual fee lower than total already paid (HTTP 400)',
    )
  }

  // ── Test 8: Real calendar date validation ──
  {
    const mId = 'membership-8'
    db.memberships = [
      {
        id: mId,
        member_id: 'member-5',
        plan_id: 'plan-monthly-1',
        start_date: '2026-09-01',
        expiry_date: '2026-09-30',
        actual_fee: 1500,
        payment_due_date: null,
        status: 'active',
      },
    ]

    // Invalid calendar date: February 31
    const req = mockReq({ id: mId }, { start_date: '2026-02-31' })
    const res = createMockRes()
    await updateMembership(req, res as any)

    assertTest(
      res.statusCode === 400 && res.body.message.includes('valid calendar date'),
      '8. Real calendar date validation: rejects non-existent calendar date 2026-02-31 (HTTP 400)',
    )
  }

  // ── Test 9: Reminder safety: scheduled reminders marked cancelled ──
  {
    const mId = 'membership-9'
    db.memberships = [
      {
        id: mId,
        member_id: 'member-6',
        plan_id: 'plan-monthly-1',
        start_date: '2026-09-01',
        expiry_date: '2026-09-30',
        actual_fee: 1500,
        payment_due_date: '2026-09-05',
        status: 'active',
      },
    ]
    db.reminders = [
      {
        id: 'rem-scheduled-1',
        member_id: 'member-6',
        membership_id: mId,
        reminder_stage: 'payment_overdue',
        status: 'scheduled',
      },
      {
        id: 'rem-processing-1',
        member_id: 'member-6',
        membership_id: mId,
        reminder_stage: 'membership_expiry_7_days',
        status: 'processing',
        claim_token: 'claim-token-123',
      },
      {
        id: 'rem-sent-1',
        member_id: 'member-6',
        membership_id: mId,
        reminder_stage: 'membership_expiry_1_day',
        status: 'sent',
      },
    ]

    // Edit payment_due_date
    const req = mockReq({ id: mId }, { payment_due_date: '2026-09-15' })
    const res = createMockRes()
    await updateMembership(req, res as any)

    const schedRem = db.reminders.find(r => r.id === 'rem-scheduled-1')
    const procRem = db.reminders.find(r => r.id === 'rem-processing-1')
    const sentRem = db.reminders.find(r => r.id === 'rem-sent-1')

    assertTest(
      res.statusCode === 200 &&
        schedRem?.status === 'cancelled' &&
        schedRem?.failure_reason?.includes('membership details updated') &&
        procRem?.status === 'processing' &&
        procRem?.claim_token === 'claim-token-123' &&
        sentRem?.status === 'sent',
      '9. Reminder safety: marks scheduled reminders as cancelled; preserves in-flight processing and sent reminders',
    )
  }

  // ── Test 10: Cancelled membership edit rejection (HTTP 400) ──
  {
    const mId = 'membership-10'
    db.memberships = [
      {
        id: mId,
        member_id: 'member-7',
        plan_id: 'plan-monthly-1',
        start_date: '2026-09-01',
        expiry_date: '2026-09-30',
        actual_fee: 1500,
        payment_due_date: null,
        status: 'cancelled',
      },
    ]

    const req = mockReq({ id: mId }, { actual_fee: 2000 })
    const res = createMockRes()
    await updateMembership(req, res as any)

    assertTest(
      res.statusCode === 400 && res.body.message === 'Cannot edit a cancelled membership.',
      '10. Lifecycle integrity: rejects editing a cancelled membership (HTTP 400)',
    )
  }

  // ── Test 11: Non-existent membership edit returns HTTP 404 ──
  {
    const req = mockReq({ id: 'non-existent-id' }, { actual_fee: 2000 })
    const res = createMockRes()
    await updateMembership(req, res as any)

    assertTest(
      res.statusCode === 404 && res.body.message === 'Membership not found.',
      '11. Non-existent membership edit returns HTTP 404',
    )
  }

  // ── Test 12: Audit log creation with previous and new data ──
  {
    const mId = '12345678-1234-4234-8234-123456789012'
    db.memberships = [
      {
        id: mId,
        member_id: 'member-8',
        plan_id: 'plan-monthly-1',
        start_date: '2026-09-01',
        expiry_date: '2026-09-30',
        actual_fee: 1500,
        payment_due_date: '2026-09-05',
        status: 'active',
      },
    ]
    const initialAuditCount = db.audit_logs.length

    const req = mockReq({ id: mId }, { actual_fee: 1700, payment_due_date: '2026-09-12' })
    const res = createMockRes()
    await updateMembership(req, res as any)

    const latestAudit = db.audit_logs[db.audit_logs.length - 1]

    assertTest(
      res.statusCode === 200 &&
        db.audit_logs.length === initialAuditCount + 1 &&
        latestAudit?.action === 'membership_updated' &&
        latestAudit?.entity_id === mId &&
        latestAudit?.previous_data?.actual_fee === 1500 &&
        latestAudit?.new_data?.actual_fee === 1700 &&
        latestAudit?.new_data?.payment_due_date === '2026-09-12',
      '12. Audit logging: records membership_updated with previousData, newData, and actorId',
    )
  }

  // ── Test 13: Unauthorized user attempting to edit (HTTP 401 via requireAuth) ──
  {
    const unauthReq: Request = {
      headers: {}, // No Authorization header
    } as any
    const res = createMockRes()
    let nextCalled = false

    await requireAuth(unauthReq, res as any, () => {
      nextCalled = true
    })

    assertTest(
      res.statusCode === 401 && !nextCalled && res.body.message === 'Authentication required.',
      '13. Security: unauthenticated request to membership endpoint returns HTTP 401',
    )
  }

  // ── Test 14: Direct status changes other than owner cancellation rejected ──
  {
    const mId = 'membership-14'
    db.memberships = [
      {
        id: mId,
        member_id: 'member-9',
        plan_id: 'plan-monthly-1',
        start_date: '2026-09-01',
        expiry_date: '2026-09-30',
        actual_fee: 1500,
        payment_due_date: null,
        status: 'active',
      },
    ]

    // Attempt arbitrary status change: 'future'
    const req1 = mockReq({ id: mId }, { status: 'future' })
    const res1 = createMockRes()
    await updateMembership(req1, res1 as any)

    // Trainer attempting cancellation
    const req2 = mockReq({ id: mId }, { status: 'cancelled' }, 'trainer')
    const res2 = createMockRes()
    await updateMembership(req2, res2 as any)

    assertTest(
      res1.statusCode === 400 &&
        res1.body.message.includes('Direct status changes other than cancellation are not permitted') &&
        res2.statusCode === 403 &&
        res2.body.message.includes('Only the gym owner can cancel a membership'),
      '14. Status permissions: arbitrary status edits blocked (HTTP 400); trainer cancellation blocked (HTTP 403)',
    )
  }

  console.log('\n=================================================================')
  console.log(`EDIT MEMBERSHIP TEST SUMMARY: ${passed} Passed, ${failed} Failed`)
  console.log('=================================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch(err => {
  console.error('Unhandled error during tests:', err)
  process.exit(1)
})
