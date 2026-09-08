export type MemberStatus = 'active' | 'inactive'

export type MemberFilter =
  | 'all'
  | 'active'
  | 'inactive'
  | 'expiring_soon'
  | 'expired'
  | 'payment_pending'
  | 'payment_overdue'

export interface MembershipSummary {
  plan_name: string
  expiry_date: string
  status: string
}

export interface MemberListItem {
  id: string
  member_code: string
  full_name: string
  phone: string
  email: string | null
  status: MemberStatus
  joining_date: string
  created_at: string
  current_membership: MembershipSummary | null
}

export interface CurrentMembershipDetail {
  id: string
  plan_name: string
  start_date: string
  expiry_date: string
  actual_fee: number
  payment_due_date: string | null
  status: string
}

export interface MemberDetail {
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
  created_at: string
  updated_at: string
  current_membership: CurrentMembershipDetail | null
}

export interface MembersListResponse {
  members: MemberListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface CreateMemberPayload {
  full_name: string
  phone: string
  email?: string | null
  address?: string | null
  date_of_birth?: string | null
  joining_date: string
  notes?: string | null
}

export interface UpdateMemberPayload {
  full_name?: string
  phone?: string
  email?: string | null
  address?: string | null
  date_of_birth?: string | null
  joining_date?: string
  notes?: string | null
  status?: MemberStatus
}
