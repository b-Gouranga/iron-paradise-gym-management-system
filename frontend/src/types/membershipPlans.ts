export type DurationUnit = 'days' | 'months' | 'years'

export type MembershipPlanFilter = 'all' | 'active' | 'inactive'

export interface MembershipPlan {
  id: string
  name: string
  duration_value: number
  duration_unit: DurationUnit
  default_fee: number
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateMembershipPlanPayload {
  name: string
  duration_value: number
  duration_unit: DurationUnit
  default_fee: number
  description?: string | null
}

export interface UpdateMembershipPlanPayload {
  name?: string
  duration_value?: number
  duration_unit?: DurationUnit
  default_fee?: number
  description?: string | null
}
