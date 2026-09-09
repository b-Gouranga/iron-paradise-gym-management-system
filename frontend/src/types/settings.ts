/**
 * Frontend Settings types for Iron Paradise Gym Management System.
 */

export interface GymSettings {
  id: string
  gym_name: string
  contact_phone: string | null
  contact_email: string | null
  address: string | null
  currency_symbol: string
  currency_code: string
  member_id_prefix: string
  payment_due_grace_days: number
  reminder_advance_days: number
  created_at?: string
  updated_at?: string
}

export interface UpdateGymSettingsInput {
  gym_name?: string
  contact_phone?: string | null
  contact_email?: string | null
  address?: string | null
  currency_symbol?: string
  currency_code?: string
  member_id_prefix?: string
  payment_due_grace_days?: number
  reminder_advance_days?: number
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

export type SettingsTab = 'gym' | 'defaults' | 'reminders' | 'account' | 'audit'
