export type TrainerStatusFilter = 'all' | 'active' | 'inactive'

export interface Trainer {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: 'trainer' | 'owner'
  is_active: boolean
  notes?: string | null
  created_at: string
  updated_at: string
  last_sign_in_at?: string | null
}

export interface TrainerSummary {
  total_trainers: number
  active_trainers: number
  inactive_trainers: number
}

export interface CreateTrainerInput {
  full_name: string
  email: string
  password: string
  phone?: string | null
  notes?: string | null
}

export interface UpdateTrainerInput {
  full_name?: string
  phone?: string | null
  notes?: string | null
}
