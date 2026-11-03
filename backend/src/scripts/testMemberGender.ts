import assert from 'node:assert'
import type { Request, Response } from 'express'
import {
  createMember,
  updateMember,
  getMember,
  listMembers,
} from '../controllers/membersController.js'
import { setSupabaseAdmin } from '../services/database/supabaseAdmin.js'

/**
 * Iron Paradise Gym Management System
 * Member Gender Field Automated Test Suite
 *
 * Verifies all requirements:
 * 1. createMember with explicit gender 'Male' saves and returns 'Male'.
 * 2. createMember with explicit gender 'Female' saves and returns 'Female'.
 * 3. createMember with omitted gender defaults to 'Male' (backward compatibility).
 * 4. createMember with empty string gender returns HTTP 400.
 * 5. createMember with invalid gender string returns HTTP 400.
 * 6. updateMember with gender 'Female' updates and returns 'Female'.
 * 7. updateMember with gender 'Male' updates and returns 'Male'.
 * 8. updateMember with empty string gender returns HTTP 400.
 * 9. updateMember with invalid gender string returns HTTP 400.
 * 10. getMember returns saved gender.
 * 11. getMember with legacy null gender falls back safely to 'Male'.
 * 12. listMembers includes gender for each member record.
 * 13. createMember fails with clear HTTP 500 migration error when gender column is missing (no silent drop).
 * 14. updateMember fails with clear HTTP 500 migration error when gender column is missing (no silent drop).
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

// In-memory mock database
class InMemorySupabase {
  members: any[] = []
  simulatedInsertError: any = null
  simulatedUpdateError: any = null

  from(table: string) {
    const self = this

    if (table === 'audit_logs') {
      return {
        insert: () => ({
          select: () => Promise.resolve({ data: null, error: null }),
          then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
        }),
      } as any
    }

    if (table === 'members') {
      let selectedFields = '*'
      let filterId: string | null = null
      let isSingle = false
      let orderCol: string | null = null
      let orderAsc = true
      let limitCount: number | null = null
      let rangeFrom = 0
      let rangeTo = 999

      const builder: any = {
        select(fields = '*', options?: any) {
          selectedFields = fields
          return builder
        },
        order(col: string, opts?: any) {
          orderCol = col
          orderAsc = opts?.ascending ?? true
          return builder
        },
        limit(n: number) {
          limitCount = n
          return builder
        },
        range(from: number, to: number) {
          rangeFrom = from
          rangeTo = to
          return builder
        },
        eq(col: string, val: any) {
          if (col === 'id') filterId = val
          return builder
        },
        single() {
          isSingle = true
          return builder.then ? builder.then() : Promise.resolve(builder._exec())
        },
        maybeSingle() {
          isSingle = true
          return builder._exec()
        },
        insert(payload: any) {
          if (self.simulatedInsertError) {
            return {
              select: () => ({
                single: async () => ({ data: null, error: self.simulatedInsertError }),
              }),
            }
          }
          const newRow = {
            id: `member-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...payload,
          }
          self.members.push(newRow)
          return {
            select: () => ({
              single: async () => ({ data: newRow, error: null }),
            }),
          }
        },
        update(updates: any) {
          return {
            eq: (col: string, val: any) => ({
              select: () => ({
                single: async () => {
                  if (self.simulatedUpdateError) {
                    return { data: null, error: self.simulatedUpdateError }
                  }
                  const row = self.members.find(m => m[col] === val)
                  if (!row) return { data: null, error: { code: 'PGRST116', message: 'Not found' } }
                  Object.assign(row, updates, { updated_at: new Date().toISOString() })
                  return { data: row, error: null }
                },
              }),
            }),
          }
        },
        _exec() {
          let rows = [...self.members]
          if (filterId) {
            rows = rows.filter(r => r.id === filterId)
          }
          if (orderCol) {
            rows.sort((a, b) => {
              const va = a[orderCol!] ?? ''
              const vb = b[orderCol!] ?? ''
              return orderAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
            })
          }
          const count = rows.length
          if (limitCount !== null) {
            rows = rows.slice(0, limitCount)
          } else {
            rows = rows.slice(rangeFrom, rangeTo + 1)
          }
          if (isSingle) {
            return { data: rows[0] ?? null, error: rows[0] ? null : { code: 'PGRST116', message: 'Not found' } }
          }
          return { data: rows, count, error: null }
        },
        then(resolve: any, reject: any) {
          const res = builder._exec()
          return Promise.resolve(res).then(resolve, reject)
        },
      }
      return builder
    }

    // Default mock for other tables (memberships, etc.)
    return {
      select: () => ({
        in: () => ({
          order: async () => ({ data: [], error: null }),
        }),
        eq: () => ({
          order: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }),
        order: () => ({
          limit: async () => ({ data: [], error: null }),
        }),
      }),
    } as any
  }
}

export async function runMemberGenderTests() {
  console.log('=================================================================')
  console.log('IRON PARADISE GYM — MEMBER GENDER AUTOMATED TEST SUITE')
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

  const mockDb = new InMemorySupabase()
  setSupabaseAdmin(mockDb as any)

  try {
    // ── Test 1: Create member with explicit gender 'Male' ─────────────────────
    try {
      const req = {
        body: {
          full_name: 'Vikram Rajput',
          phone: '9876543210',
          joining_date: '2026-11-01',
          gender: 'Male',
        },
        authUser: { id: 'user-admin' },
      } as unknown as Request
      const res = createMockRes()
      await createMember(req, res as unknown as Response)

      assert.strictEqual(res.statusCode, 201, `Expected 201, got ${res.statusCode}`)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.data.gender, 'Male')
      assert.strictEqual(res.body.data.full_name, 'Vikram Rajput')
      pass('1. createMember with explicit gender "Male" saves and returns "Male"')
    } catch (err) {
      fail('1. createMember with explicit gender "Male"', err)
    }

    // ── Test 2: Create member with explicit gender 'Female' ───────────────────
    let femaleMemberId = ''
    try {
      const req = {
        body: {
          full_name: 'Priya Sharma',
          phone: '9876543211',
          joining_date: '2026-11-01',
          gender: 'Female',
        },
        authUser: { id: 'user-admin' },
      } as unknown as Request
      const res = createMockRes()
      await createMember(req, res as unknown as Response)

      assert.strictEqual(res.statusCode, 201, `Expected 201, got ${res.statusCode}`)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.data.gender, 'Female')
      assert.strictEqual(res.body.data.full_name, 'Priya Sharma')
      femaleMemberId = res.body.data.id
      pass('2. createMember with explicit gender "Female" saves and returns "Female"')
    } catch (err) {
      fail('2. createMember with explicit gender "Female"', err)
    }

    // ── Test 3: Create member with omitted gender (backward compatibility) ─────
    let defaultMemberId = ''
    try {
      const req = {
        body: {
          full_name: 'Rohan Verma',
          phone: '9876543212',
          joining_date: '2026-11-01',
          // gender is omitted
        },
        authUser: { id: 'user-admin' },
      } as unknown as Request
      const res = createMockRes()
      await createMember(req, res as unknown as Response)

      assert.strictEqual(res.statusCode, 201, `Expected 201, got ${res.statusCode}`)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.data.gender, 'Male', 'Omitted gender must default to Male')
      defaultMemberId = res.body.data.id
      pass('3. createMember with omitted gender defaults to "Male" (backward compatibility)')
    } catch (err) {
      fail('3. createMember with omitted gender', err)
    }

    // ── Test 4: Create member with empty string gender returns HTTP 400 ────────
    try {
      const req = {
        body: {
          full_name: 'Test Member',
          phone: '9876543213',
          joining_date: '2026-11-01',
          gender: '',
        },
      } as unknown as Request
      const res = createMockRes()
      await createMember(req, res as unknown as Response)

      assert.strictEqual(res.statusCode, 400, `Expected 400, got ${res.statusCode}`)
      assert.strictEqual(res.body.success, false)
      assert.ok(res.body.message.includes('Gender is required'), `Expected error message, got: ${res.body.message}`)
      pass('4. createMember with empty string gender returns HTTP 400')
    } catch (err) {
      fail('4. createMember with empty string gender', err)
    }

    // ── Test 5: Create member with invalid gender returns HTTP 400 ────────────
    try {
      const req = {
        body: {
          full_name: 'Test Member',
          phone: '9876543214',
          joining_date: '2026-11-01',
          gender: 'Other',
        },
      } as unknown as Request
      const res = createMockRes()
      await createMember(req, res as unknown as Response)

      assert.strictEqual(res.statusCode, 400, `Expected 400, got ${res.statusCode}`)
      assert.strictEqual(res.body.success, false)
      assert.ok(res.body.message.includes('Gender must be either Male or Female'), `Expected error message, got: ${res.body.message}`)
      pass('5. createMember with invalid gender string returns HTTP 400')
    } catch (err) {
      fail('5. createMember with invalid gender', err)
    }

    // ── Test 6: Update member gender to 'Female' ──────────────────────────────
    try {
      const req = {
        params: { id: defaultMemberId },
        body: { gender: 'Female' },
        authUser: { id: 'user-admin' },
      } as unknown as Request
      const res = createMockRes()
      await updateMember(req, res as unknown as Response)

      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.data.gender, 'Female')
      pass('6. updateMember with gender "Female" updates and returns "Female"')
    } catch (err) {
      fail('6. updateMember with gender "Female"', err)
    }

    // ── Test 7: Update member gender to 'Male' ────────────────────────────────
    try {
      const req = {
        params: { id: femaleMemberId },
        body: { gender: 'Male' },
        authUser: { id: 'user-admin' },
      } as unknown as Request
      const res = createMockRes()
      await updateMember(req, res as unknown as Response)

      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.data.gender, 'Male')
      pass('7. updateMember with gender "Male" updates and returns "Male"')
    } catch (err) {
      fail('7. updateMember with gender "Male"', err)
    }

    // ── Test 8: Update member with empty string gender returns HTTP 400 ───────
    try {
      const req = {
        params: { id: defaultMemberId },
        body: { gender: '' },
      } as unknown as Request
      const res = createMockRes()
      await updateMember(req, res as unknown as Response)

      assert.strictEqual(res.statusCode, 400, `Expected 400, got ${res.statusCode}`)
      assert.strictEqual(res.body.success, false)
      assert.ok(res.body.message.includes('Gender cannot be empty'), `Expected error message, got: ${res.body.message}`)
      pass('8. updateMember with empty string gender returns HTTP 400')
    } catch (err) {
      fail('8. updateMember with empty string gender', err)
    }

    // ── Test 9: Update member with invalid gender returns HTTP 400 ────────────
    try {
      const req = {
        params: { id: defaultMemberId },
        body: { gender: 'NonBinary' },
      } as unknown as Request
      const res = createMockRes()
      await updateMember(req, res as unknown as Response)

      assert.strictEqual(res.statusCode, 400, `Expected 400, got ${res.statusCode}`)
      assert.strictEqual(res.body.success, false)
      assert.ok(res.body.message.includes('Gender must be either Male or Female'), `Expected error message, got: ${res.body.message}`)
      pass('9. updateMember with invalid gender string returns HTTP 400')
    } catch (err) {
      fail('9. updateMember with invalid gender', err)
    }

    // ── Test 10: getMember returns saved gender ──────────────────────────────
    try {
      const req = {
        params: { id: defaultMemberId },
      } as unknown as Request
      const res = createMockRes()
      await getMember(req, res as unknown as Response)

      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.data.gender, 'Female')
      pass('10. getMember returns saved gender')
    } catch (err) {
      fail('10. getMember returns saved gender', err)
    }

    // ── Test 11: getMember with legacy null gender falls back safely to 'Male' ─
    try {
      // Inject a legacy record directly into mockDb with gender: null
      const legacyId = 'member-legacy-null-gender'
      mockDb.members.push({
        id: legacyId,
        member_code: 'IP-00000',
        full_name: 'Legacy Member',
        phone: '9876543299',
        joining_date: '2026-01-01',
        status: 'active',
        gender: null,
      })

      const req = {
        params: { id: legacyId },
      } as unknown as Request
      const res = createMockRes()
      await getMember(req, res as unknown as Response)

      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.data.gender, 'Male', 'Legacy null gender must fallback to Male')
      pass('11. getMember with legacy null gender falls back safely to "Male"')
    } catch (err) {
      fail('11. getMember with legacy null gender fallback', err)
    }

    // ── Test 12: listMembers includes gender for each member record ───────────
    try {
      const req = {
        query: { page: '1', limit: '10' },
      } as unknown as Request
      const res = createMockRes()
      await listMembers(req, res as unknown as Response)

      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`)
      assert.strictEqual(res.body.success, true)
      assert.ok(res.body.data.members.length > 0)
      for (const m of res.body.data.members) {
        assert.ok(m.gender === 'Male' || m.gender === 'Female', `Member ${m.id} has invalid gender: ${m.gender}`)
      }
      pass('12. listMembers includes gender for each member record')
    } catch (err) {
      fail('12. listMembers includes gender', err)
    }

    // ── Test 13: Missing migration error handling on createMember (no silent drop) ─
    try {
      mockDb.simulatedInsertError = {
        code: '42703',
        message: 'column "gender" of relation "members" does not exist',
      }

      const req = {
        body: {
          full_name: 'Migration Test Member',
          phone: '9876543215',
          joining_date: '2026-11-01',
          gender: 'Male',
        },
      } as unknown as Request
      const res = createMockRes()
      await createMember(req, res as unknown as Response)

      assert.strictEqual(res.statusCode, 500, `Expected 500, got ${res.statusCode}`)
      assert.strictEqual(res.body.success, false)
      assert.ok(
        res.body.message.includes('Database schema migration required') &&
        res.body.message.includes('gender'),
        `Expected migration required message, got: ${res.body.message}`,
      )
      pass('13. createMember returns HTTP 500 migration error when gender column missing (no silent drop)')
    } catch (err) {
      fail('13. createMember missing migration check', err)
    } finally {
      mockDb.simulatedInsertError = null
    }

    // ── Test 14: Missing migration error handling on updateMember (no silent drop) ─
    try {
      mockDb.simulatedUpdateError = {
        code: '42703',
        message: 'column "gender" of relation "members" does not exist',
      }

      const req = {
        params: { id: defaultMemberId },
        body: { gender: 'Female' },
      } as unknown as Request
      const res = createMockRes()
      await updateMember(req, res as unknown as Response)

      assert.strictEqual(res.statusCode, 500, `Expected 500, got ${res.statusCode}`)
      assert.strictEqual(res.body.success, false)
      assert.ok(
        res.body.message.includes('Database schema migration required') &&
        res.body.message.includes('gender'),
        `Expected migration required message, got: ${res.body.message}`,
      )
      pass('14. updateMember returns HTTP 500 migration error when gender column missing (no silent drop)')
    } catch (err) {
      fail('14. updateMember missing migration check', err)
    } finally {
      mockDb.simulatedUpdateError = null
    }

  } finally {
    setSupabaseAdmin(undefined)
  }

  console.log('\n=================================================================')
  console.log(`MEMBER GENDER TEST SUMMARY: ${passed} Passed, ${failed} Failed`)
  console.log('=================================================================\n')

  return { passed, failed }
}

if (process.argv[1]?.endsWith('testMemberGender.ts')) {
  runMemberGenderTests().then(res => {
    if (res.failed > 0) process.exit(1)
  })
}
