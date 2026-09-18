-- Part 17: Reminder cost optimization
-- Adds two columns to reminder_settings:
--   auto_generate BOOLEAN: controls whether the engine auto-schedules this stage
--   max_retries   INTEGER: caps automatic retry attempts per reminder per day
--
-- Non-destructive: ADD COLUMN IF NOT EXISTS + UPDATE only. No drops, no deletes.

-- 1. Add auto_generate flag (default true = unchanged behaviour for all stages)
ALTER TABLE public.reminder_settings
  ADD COLUMN IF NOT EXISTS auto_generate BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.reminder_settings.auto_generate IS
  'When false the reminder engine will not auto-schedule this stage. '
  'Manual send via the UI and all historical records remain fully intact.';

-- 2. Add max_retries (default 1 = single automatic retry allowed per failed reminder)
ALTER TABLE public.reminder_settings
  ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 1
    CHECK (max_retries >= 0 AND max_retries <= 10);

COMMENT ON COLUMN public.reminder_settings.max_retries IS
  'Maximum number of automatic retries the engine will attempt for a '
  'failed reminder of this stage within a single day. 0 = no auto-retry.';

-- 3. Disable auto-generation for membership_expired and payment_due.
--    These stages are kept in the settings table and remain available for
--    manual send; the engine simply will not auto-schedule them.
UPDATE public.reminder_settings
  SET auto_generate = false
  WHERE reminder_stage IN ('membership_expired', 'payment_due');
