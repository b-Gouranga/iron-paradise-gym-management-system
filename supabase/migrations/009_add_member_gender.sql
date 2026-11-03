-- Iron Paradise Gym Management System — Migration 009
-- Add gender column to members table

-- 1. Add gender column with check constraint allowing 'Male' or 'Female'
alter table public.members
  add column if not exists gender text check (gender in ('Male', 'Female'));

-- 2. Backfill existing records to 'Male'
update public.members
set gender = 'Male'
where gender is null;

-- 3. Enforce not null and set default to 'Male'
alter table public.members
  alter column gender set default 'Male',
  alter column gender set not null;
