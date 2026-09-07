-- Iron Paradise Gym Management System
-- Part 2: Supabase database foundation
--
-- This migration intentionally enables Row Level Security without adding permissive
-- policies. Part 3 will add authenticated owner/trainer policies.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  role text not null default 'trainer' check (role in ('owner', 'trainer')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  member_code text not null unique check (member_code ~ '^IP-[0-9]{5,}$'),
  full_name text not null check (char_length(trim(full_name)) > 0),
  phone text not null check (char_length(trim(phone)) > 0),
  email text,
  address text,
  date_of_birth date,
  joining_date date not null,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) > 0),
  duration_value integer not null check (duration_value > 0),
  duration_unit text not null check (duration_unit in ('days', 'months', 'years')),
  default_fee numeric(12, 2) not null check (default_fee >= 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  plan_id uuid not null references public.membership_plans(id) on delete restrict,
  previous_membership_id uuid references public.memberships(id) on delete restrict,
  start_date date not null,
  expiry_date date not null,
  actual_fee numeric(12, 2) not null check (actual_fee >= 0),
  payment_due_date date,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint memberships_expiry_after_start check (expiry_date >= start_date),
  constraint memberships_no_self_renewal check (previous_membership_id is null or previous_membership_id <> id),
  unique (id, member_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null,
  membership_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null check (payment_method in ('cash', 'upi', 'card', 'bank_transfer', 'other')),
  purpose text not null check (purpose in ('new_membership', 'renewal', 'partial_payment', 'pending_fee', 'other')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint payments_member_membership_match
    foreign key (membership_id, member_id)
    references public.memberships(id, member_id)
    on delete restrict
);

create table public.reminder_settings (
  id uuid primary key default gen_random_uuid(),
  reminder_stage text not null unique check (reminder_stage in (
    'membership_expiry_7_days',
    'membership_expiry_1_day',
    'membership_expired',
    'payment_due',
    'payment_overdue'
  )),
  is_enabled boolean not null default true,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'sms')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  reminder_stage text not null check (reminder_stage in (
    'membership_expiry_7_days',
    'membership_expiry_1_day',
    'membership_expired',
    'payment_due',
    'payment_overdue'
  )),
  channel text not null check (channel in ('whatsapp', 'sms')),
  body text not null check (char_length(trim(body)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (reminder_stage, channel)
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null,
  membership_id uuid not null,
  template_id uuid references public.message_templates(id) on delete set null,
  reminder_stage text not null check (reminder_stage in (
    'membership_expiry_7_days',
    'membership_expiry_1_day',
    'membership_expired',
    'payment_due',
    'payment_overdue'
  )),
  channel text not null check (channel in ('whatsapp', 'sms')),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'delivered', 'failed', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reminders_member_membership_match
    foreign key (membership_id, member_id)
    references public.memberships(id, member_id)
    on delete restrict,
  constraint reminders_member_membership_stage_unique
    unique (member_id, membership_id, reminder_stage)
);

create table public.message_history (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid references public.reminders(id) on delete set null,
  member_id uuid not null,
  membership_id uuid not null,
  reminder_stage text not null check (reminder_stage in (
    'membership_expiry_7_days',
    'membership_expiry_1_day',
    'membership_expired',
    'payment_due',
    'payment_overdue'
  )),
  channel text not null check (channel in ('whatsapp', 'sms')),
  message text not null,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  status text not null check (status in ('scheduled', 'sent', 'delivered', 'failed', 'cancelled')),
  provider_message_id text unique,
  failure_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint message_history_member_membership_match
    foreign key (membership_id, member_id)
    references public.memberships(id, member_id)
    on delete restrict
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  previous_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index members_full_name_idx on public.members(full_name);
create index members_phone_idx on public.members(phone);
create index members_email_idx on public.members(email) where email is not null;
create index members_status_idx on public.members(status);
create index memberships_member_start_date_idx on public.memberships(member_id, start_date desc);
create index memberships_expiry_status_idx on public.memberships(expiry_date, status);
create index memberships_payment_due_date_idx on public.memberships(payment_due_date) where payment_due_date is not null;
create index payments_membership_payment_date_idx on public.payments(membership_id, payment_date desc);
create index payments_member_payment_date_idx on public.payments(member_id, payment_date desc);
create index payments_created_by_idx on public.payments(created_by) where created_by is not null;
create index reminders_scheduled_status_idx on public.reminders(scheduled_at, status);
create index message_history_member_created_at_idx on public.message_history(member_id, created_at desc);
create index message_history_reminder_idx on public.message_history(reminder_id) where reminder_id is not null;
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc) where actor_id is not null;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger members_set_updated_at before update on public.members
  for each row execute function public.set_updated_at();
create trigger membership_plans_set_updated_at before update on public.membership_plans
  for each row execute function public.set_updated_at();
create trigger memberships_set_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();
create trigger reminder_settings_set_updated_at before update on public.reminder_settings
  for each row execute function public.set_updated_at();
create trigger message_templates_set_updated_at before update on public.message_templates
  for each row execute function public.set_updated_at();
create trigger reminders_set_updated_at before update on public.reminders
  for each row execute function public.set_updated_at();

create or replace function public.prevent_history_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception '% records are immutable', tg_table_name;
end;
$$;

create trigger message_history_is_immutable
  before update or delete on public.message_history
  for each row execute function public.prevent_history_mutation();
create trigger audit_logs_are_immutable
  before update or delete on public.audit_logs
  for each row execute function public.prevent_history_mutation();

alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.payments enable row level security;
alter table public.reminder_settings enable row level security;
alter table public.message_templates enable row level security;
alter table public.reminders enable row level security;
alter table public.message_history enable row level security;
alter table public.audit_logs enable row level security;

-- No RLS policies are created in Part 2. This is intentionally deny-by-default
-- for anon/authenticated clients. The backend service role bypasses RLS and must
-- never be exposed to the browser. Part 3 will introduce authenticated policies.
