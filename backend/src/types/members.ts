/**
 * Server-side types for the Members module.
 * Mirror the Part 2 members table schema.
 */

export type MemberStatus = 'active' | 'inactive'
export type MemberFilter =
  | 'all'
  | 'active'
  | 'inactive'
  | 'expiring_soon'
  | 'expired'
  | 'payment_pending'
  | 'payment_overdue'

export interface MemberRow {
  id: string
  member_code: string
  full_name: string
  phone: string
  email: string | null
  address: string | null
  date_of_birth: string | null
  joining_date: string
  notes: string | null
  status: MemberStatus
  whatsapp_opt_in?: boolean
  created_at: string
  updated_at: string
}

export interface CreateMemberInput {
  full_name: string
  phone: string
  email?: string | null
  address?: string | null
  date_of_birth?: string | null
  joining_date: string
  notes?: string | null
  whatsapp_opt_in?: boolean
}

export interface UpdateMemberInput {
  full_name?: string
  phone?: string
  email?: string | null
  address?: string | null
  date_of_birth?: string | null
  joining_date?: string
  notes?: string | null
  status?: MemberStatus
  whatsapp_opt_in?: boolean
}
