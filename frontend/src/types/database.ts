/**
 * Shared database domain types for frontend data-access code.
 * These mirror the Part 2 schema. Supabase-generated types can replace this
 * module after the project is linked to a Supabase instance.
 */
export type ProfileRole = 'owner' | 'trainer'
export type MemberStatus = 'active' | 'inactive'
export type MembershipStatus = 'active' | 'expired' | 'cancelled'
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other'
export type PaymentPurpose = 'new_membership' | 'renewal' | 'partial_payment' | 'pending_fee' | 'other'
export type ReminderStage =
  | 'membership_expiry_7_days'
  | 'membership_expiry_1_day'
  | 'membership_expired'
  | 'payment_due'
  | 'payment_overdue'
export type NotificationChannel = 'whatsapp' | 'sms'
export type ReminderStatus = 'scheduled' | 'sent' | 'delivered' | 'failed' | 'cancelled'

export interface Database {
  public: {
    Tables: {
      profiles: { Row: ProfileRow }
      members: { Row: MemberRow }
      membership_plans: { Row: MembershipPlanRow }
      memberships: { Row: MembershipRow }
      payments: { Row: PaymentRow }
      reminder_settings: { Row: ReminderSettingRow }
      message_templates: { Row: MessageTemplateRow }
      reminders: { Row: ReminderRow }
      message_history: { Row: MessageHistoryRow }
      audit_logs: { Row: AuditLogRow }
    }
  }
}

export interface ProfileRow { id: string; full_name: string; email: string; phone: string | null; role: ProfileRole; is_active: boolean; created_at: string; updated_at: string }
export interface MemberRow { id: string; member_code: string; full_name: string; phone: string; email: string | null; address: string | null; date_of_birth: string | null; joining_date: string; notes: string | null; status: MemberStatus; created_at: string; updated_at: string }
export interface MembershipPlanRow { id: string; name: string; duration_value: number; duration_unit: 'days' | 'months' | 'years'; default_fee: number; description: string | null; is_active: boolean; created_at: string; updated_at: string }
export interface MembershipRow { id: string; member_id: string; plan_id: string; previous_membership_id: string | null; start_date: string; expiry_date: string; actual_fee: number; payment_due_date: string | null; status: MembershipStatus; created_at: string; updated_at: string }
export interface PaymentRow { id: string; member_id: string; membership_id: string; amount: number; payment_date: string; payment_method: PaymentMethod; purpose: PaymentPurpose; notes: string | null; created_by: string | null; created_at: string }
export interface ReminderSettingRow { id: string; reminder_stage: ReminderStage; is_enabled: boolean; channel: NotificationChannel; created_at: string; updated_at: string }
export interface MessageTemplateRow { id: string; reminder_stage: ReminderStage; channel: NotificationChannel; body: string; is_active: boolean; created_at: string; updated_at: string }
export interface ReminderRow { id: string; member_id: string; membership_id: string; template_id: string | null; reminder_stage: ReminderStage; channel: NotificationChannel; scheduled_at: string; status: ReminderStatus; created_at: string; updated_at: string }
export interface MessageHistoryRow { id: string; reminder_id: string | null; member_id: string; membership_id: string; reminder_stage: ReminderStage; channel: NotificationChannel; message: string; scheduled_at: string; sent_at: string | null; status: ReminderStatus; provider_message_id: string | null; failure_reason: string | null; created_at: string }
export interface AuditLogRow { id: string; actor_id: string | null; entity_type: string; entity_id: string | null; action: string; previous_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; created_at: string }
