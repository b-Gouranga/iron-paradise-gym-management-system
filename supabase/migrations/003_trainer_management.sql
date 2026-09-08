-- ============================================================
-- Iron Paradise Gym Management System — Migration 003
-- Part 11: Trainer Management + Permissions
-- ============================================================

-- 1. Add optional notes column to profiles table if not exists
alter table public.profiles
  add column if not exists notes text;

-- 2. Update profiles_select policy to allow authenticated staff to view trainer profiles
-- Owners can read all profiles; users can always read their own profile;
-- staff (trainers) can read active/inactive trainer directory profiles.
drop policy if exists "profiles_select" on public.profiles;

create policy "profiles_select"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_owner()
    or role = 'trainer'
  );
