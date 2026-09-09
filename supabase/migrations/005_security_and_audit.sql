-- Iron Paradise Gym Management System — Migration 005
-- Part 13: Security & Audit Logging Optimizations

-- 1. Create performance indexes for audit log queries and filters
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs(action, created_at desc);
create index if not exists audit_logs_entity_type_idx on public.audit_logs(entity_type, created_at desc);

-- 2. Ensure audit_logs immutability trigger is attached
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'audit_logs_are_immutable'
  ) then
    create trigger audit_logs_are_immutable
      before update or delete on public.audit_logs
      for each row execute function public.prevent_history_mutation();
  end if;
end $$;
