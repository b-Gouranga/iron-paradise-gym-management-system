-- Iron Paradise Gym Management System — Migration 004
-- Part 12: Gym Settings and Operational Configuration

-- 1. Create gym_settings table
create table if not exists public.gym_settings (
  id uuid primary key default gen_random_uuid(),
  gym_name text not null default 'Iron Paradise Gym',
  contact_phone text default '+91 98765 43210',
  contact_email text default 'contact@ironparadisegym.com',
  address text default 'Main Road, Guwahati, Assam',
  currency_symbol text not null default '₹',
  currency_code text not null default 'INR',
  member_id_prefix text not null default 'IP-',
  payment_due_grace_days integer not null default 7 check (payment_due_grace_days >= 0),
  reminder_advance_days integer not null default 7 check (reminder_advance_days >= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 2. Guarantee at most one row exists in gym_settings
create unique index if not exists gym_settings_single_row_idx on public.gym_settings ((true));

-- 3. Trigger for updated_at
drop trigger if exists gym_settings_set_updated_at on public.gym_settings;
create trigger gym_settings_set_updated_at
  before update on public.gym_settings
  for each row execute function public.set_updated_at();

-- 4. Enable Row Level Security
alter table public.gym_settings enable row level security;

-- 5. RLS Policies
drop policy if exists "gym_settings_select" on public.gym_settings;
create policy "gym_settings_select"
  on public.gym_settings
  for select
  to authenticated
  using (public.is_authenticated_staff());

drop policy if exists "gym_settings_insert" on public.gym_settings;
create policy "gym_settings_insert"
  on public.gym_settings
  for insert
  to authenticated
  with check (public.is_owner());

drop policy if exists "gym_settings_update" on public.gym_settings;
create policy "gym_settings_update"
  on public.gym_settings
  for update
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- 6. Seed default initial row if not present
insert into public.gym_settings (
  gym_name,
  contact_phone,
  contact_email,
  address,
  currency_symbol,
  currency_code,
  member_id_prefix,
  payment_due_grace_days,
  reminder_advance_days
)
select
  'Iron Paradise Gym',
  '+91 98765 43210',
  'contact@ironparadisegym.com',
  'Main Road, Guwahati, Assam',
  '₹',
  'INR',
  'IP-',
  7,
  7
where not exists (select 1 from public.gym_settings);
