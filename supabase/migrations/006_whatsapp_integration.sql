-- Iron Paradise Gym Management System — Migration 006
-- Part 16: WhatsApp Integration & Opt-In Support

-- 1. Add whatsapp_opt_in column to members table (defaulting to false to protect consent)
alter table public.members
  add column if not exists whatsapp_opt_in boolean not null default false;

-- 2. Update status check constraint on reminders table to allow 'read' status from Meta Webhooks
alter table public.reminders
  drop constraint if exists reminders_status_check;

alter table public.reminders
  add constraint reminders_status_check
  check (status in ('scheduled', 'sent', 'delivered', 'read', 'failed', 'cancelled'));

-- 3. Update status check constraint on message_history table to allow 'read' status from Meta Webhooks
alter table public.message_history
  drop constraint if exists message_history_status_check;

alter table public.message_history
  add constraint message_history_status_check
  check (status in ('scheduled', 'sent', 'delivered', 'read', 'failed', 'cancelled'));

-- 4. Index for opt-in queries
create index if not exists members_whatsapp_opt_in_idx on public.members(whatsapp_opt_in);
