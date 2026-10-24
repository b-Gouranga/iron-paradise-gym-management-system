-- Iron Paradise Gym Management System — Migration 008
-- Part 22: Reminder Concurrency Safety, Atomic Claims & Ambiguous Outcome Tracking
--
-- Adds support for:
--   1. 'processing' status on public.reminders (in-flight atomic claim)
--   2. claim_token (fencing token to prevent stale workers from overwriting newer state)
--   3. claim_expires_at (lease expiration for safe recovery of un-dispatched crashed claims)
--   4. failure_reason (direct tracking on reminders table, distinguishing ambiguous timeouts)
--
-- STRICTLY NON-DESTRUCTIVE:
--   Uses ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS, ADD CONSTRAINT.
--   Preserves all existing reminder data, foreign keys, and indexes.

-- 1. Add concurrency claim and diagnostic tracking columns to public.reminders
alter table public.reminders
  add column if not exists claim_token text,
  add column if not exists claim_expires_at timestamptz,
  add column if not exists failure_reason text;

comment on column public.reminders.claim_token is
  'Fencing token (UUID) generated on each claim. Prevents stale workers whose lease expired from overwriting newer worker state.';

comment on column public.reminders.claim_expires_at is
  'Lease expiration timestamp. Reminders claimed but never dispatched before this timestamp can be reclaimed.';

comment on column public.reminders.failure_reason is
  'Diagnostic error message or rejection reason. Used to classify definite rejections vs ambiguous network timeouts.';

-- 2. Update status check constraint to include 'processing'
alter table public.reminders
  drop constraint if exists reminders_status_check;

alter table public.reminders
  add constraint reminders_status_check
  check (status in ('scheduled', 'processing', 'sent', 'delivered', 'read', 'failed', 'cancelled'));

-- 3. Composite index for atomic claim queries and stale lease detection
create index if not exists reminders_concurrency_claim_idx
  on public.reminders(status, claim_expires_at, scheduled_at);
