-- Iron Paradise Gym Management System
-- Part 3: Authentication and Owner/Trainer role RLS policies
--
-- Prerequisites: 001_initial_schema.sql must be applied first.
-- All tables already have RLS enabled (deny-by-default from Part 2).
-- This migration adds authenticated policies, role helper functions, and a
-- database-level one-owner guarantee enforced by a unique partial index.
-- The backend service-role key bypasses RLS; it must never be exposed to browsers.

-- ============================================================
-- ROLE HELPER FUNCTIONS
-- ============================================================

-- Returns the role of the currently authenticated user from the profiles table.
-- Returns NULL when there is no authenticated session.
-- set search_path prevents search-path injection attacks.
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and is_active = true
  limit 1;
$$;

-- Returns true when the calling user is an active owner.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_my_role() = 'owner', false);
$$;

-- Returns true when the calling user is an active trainer.
create or replace function public.is_trainer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_my_role() = 'trainer', false);
$$;

-- Returns true when the calling user is an active owner or trainer.
create or replace function public.is_authenticated_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_my_role() in ('owner', 'trainer'), false);
$$;

-- ============================================================
-- ONE-OWNER DATABASE GUARANTEE
-- ============================================================
-- This unique partial index ensures at the database level that at most one
-- profile row can have role = 'owner'. It is the final concurrency-safe
-- guarantee for the single-owner invariant.
--
-- Why a partial index and not a CHECK constraint or application-level check?
--   - A CHECK constraint on role validates that the value is either 'owner'
--     or 'trainer'; it does NOT prevent multiple rows from having role='owner'.
--   - An application-level check (COUNT query before INSERT) has a TOCTOU
--     (time-of-check/time-of-use) race window: two concurrent requests can
--     both pass the count check before either inserts.
--   - A UNIQUE partial index is enforced atomically by the database engine.
--     Two concurrent INSERT transactions cannot both commit if they would
--     produce a second owner row; one will receive a unique-violation error
--     (PostgreSQL error code 23505).
--
-- Safe failure mode: if multiple owner rows already exist when this migration
-- is applied, the index creation will fail with a duplicate-key error. This
-- is intentional — the migration refuses to apply rather than silently
-- accepting a corrupt state.
create unique index profiles_single_owner_idx
  on public.profiles (role)
  where role = 'owner';

-- ============================================================
-- PROFILES POLICIES
-- ============================================================
-- Profile INSERT and DELETE are server-side only (via service-role).
-- The browser client (anon key) cannot insert or delete profiles.

-- Owners can read all profiles; users can always read their own profile.
create policy "profiles_select"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_owner()
  );

-- Owners can update any profile.
-- Users can update their own profile but cannot change their own role
-- (role escalation requires owner privilege).
create policy "profiles_update_owner"
  on public.profiles
  for update
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy "profiles_update_self"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid() and not public.is_owner())
  with check (
    id = auth.uid()
    -- Prevent self-escalation: the new role value must equal the caller's
    -- current role. We use the SECURITY DEFINER helper get_my_role() rather
    -- than a direct subquery on public.profiles, because a direct subquery
    -- inside an RLS policy on the same table triggers recursive RLS evaluation.
    -- get_my_role() bypasses RLS (SECURITY DEFINER + fixed search_path) and is
    -- therefore safe to call here.
    and role = public.get_my_role()
  );

-- ============================================================
-- MEMBERS POLICIES
-- ============================================================

create policy "members_select"
  on public.members
  for select
  to authenticated
  using (public.is_authenticated_staff());

create policy "members_insert"
  on public.members
  for insert
  to authenticated
  with check (public.is_authenticated_staff());

create policy "members_update"
  on public.members
  for update
  to authenticated
  using (public.is_authenticated_staff())
  with check (public.is_authenticated_staff());

-- Only owners can delete member records.
create policy "members_delete"
  on public.members
  for delete
  to authenticated
  using (public.is_owner());

-- ============================================================
-- MEMBERSHIP PLANS POLICIES
-- ============================================================

create policy "membership_plans_select"
  on public.membership_plans
  for select
  to authenticated
  using (public.is_authenticated_staff());

-- Only owners can create or change plans (pricing controls).
create policy "membership_plans_insert"
  on public.membership_plans
  for insert
  to authenticated
  with check (public.is_owner());

create policy "membership_plans_update"
  on public.membership_plans
  for update
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy "membership_plans_delete"
  on public.membership_plans
  for delete
  to authenticated
  using (public.is_owner());

-- ============================================================
-- MEMBERSHIPS POLICIES
-- ============================================================

create policy "memberships_select"
  on public.memberships
  for select
  to authenticated
  using (public.is_authenticated_staff());

create policy "memberships_insert"
  on public.memberships
  for insert
  to authenticated
  with check (public.is_authenticated_staff());

-- Part 3 architectural decision: memberships UPDATE is permitted for all
-- authenticated staff (owners and trainers) at the RLS layer.
--
-- Memberships contain financial/business fields (actual_fee, start_date,
-- expiry_date, payment_due_date, status). In the full architecture, all
-- mutation operations go through protected backend API endpoints, not directly
-- through the browser Supabase client. Those endpoints will enforce field-level
-- and business-logic constraints (e.g., only the owner may change actual_fee,
-- expiry_date calculations are server-controlled, etc.).
--
-- Restricting individual columns at RLS level in Part 3 would require column-
-- level security or splitting policies on not-yet-defined field boundaries,
-- which is premature before the membership management module (Part 7) is
-- specified and built. The backend API layer is the authoritative enforcer of
-- these rules; RLS is a defence-in-depth backstop.
--
-- This decision will be reviewed and tightened when Part 7 (Membership and
-- Renewal System) is implemented.
create policy "memberships_update"
  on public.memberships
  for update
  to authenticated
  using (public.is_authenticated_staff())
  with check (public.is_authenticated_staff());

-- Cancellation/deletion: owner only.
create policy "memberships_delete"
  on public.memberships
  for delete
  to authenticated
  using (public.is_owner());

-- ============================================================
-- PAYMENTS POLICIES
-- ============================================================
-- Both owners and trainers can record and view payments.
-- Deletion of financial records is restricted to owners.

create policy "payments_select"
  on public.payments
  for select
  to authenticated
  using (public.is_authenticated_staff());

create policy "payments_insert"
  on public.payments
  for insert
  to authenticated
  with check (public.is_authenticated_staff());

-- Owners only: update payment records (e.g., corrections).
create policy "payments_update"
  on public.payments
  for update
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- Financial records must not be casually deleted; owner only.
create policy "payments_delete"
  on public.payments
  for delete
  to authenticated
  using (public.is_owner());

-- ============================================================
-- REMINDER SETTINGS POLICIES
-- ============================================================

create policy "reminder_settings_select"
  on public.reminder_settings
  for select
  to authenticated
  using (public.is_authenticated_staff());

-- Only owners can change reminder settings.
create policy "reminder_settings_insert"
  on public.reminder_settings
  for insert
  to authenticated
  with check (public.is_owner());

create policy "reminder_settings_update"
  on public.reminder_settings
  for update
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy "reminder_settings_delete"
  on public.reminder_settings
  for delete
  to authenticated
  using (public.is_owner());

-- ============================================================
-- MESSAGE TEMPLATES POLICIES
-- ============================================================

create policy "message_templates_select"
  on public.message_templates
  for select
  to authenticated
  using (public.is_authenticated_staff());

create policy "message_templates_insert"
  on public.message_templates
  for insert
  to authenticated
  with check (public.is_owner());

create policy "message_templates_update"
  on public.message_templates
  for update
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy "message_templates_delete"
  on public.message_templates
  for delete
  to authenticated
  using (public.is_owner());

-- ============================================================
-- REMINDERS POLICIES
-- ============================================================

create policy "reminders_select"
  on public.reminders
  for select
  to authenticated
  using (public.is_authenticated_staff());

-- Reminder records are created by the backend scheduler (service-role).
-- The browser client should not be inserting reminders directly.
-- We allow authenticated staff to read; writes come via service-role.

-- ============================================================
-- MESSAGE HISTORY POLICIES
-- ============================================================
-- message_history rows are immutable (trigger prevents UPDATE/DELETE).
-- Only service-role inserts them; authenticated staff can read.

create policy "message_history_select"
  on public.message_history
  for select
  to authenticated
  using (public.is_authenticated_staff());

-- ============================================================
-- AUDIT LOGS POLICIES
-- ============================================================
-- audit_logs rows are immutable (trigger prevents UPDATE/DELETE).
-- Only owners can read audit logs. Inserts come via service-role.

create policy "audit_logs_select"
  on public.audit_logs
  for select
  to authenticated
  using (public.is_owner());
