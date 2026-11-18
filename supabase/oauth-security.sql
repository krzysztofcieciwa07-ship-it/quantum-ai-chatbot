-- OAuth account-linking hardening.
-- Apply this migration to existing Supabase projects before deploying the OAuth code.
-- Supabase Cron (pg_cron) is required for scheduled expired-state cleanup.
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.oauth_states (
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  connector_provider text not null check (connector_provider in (
    'gmail', 'google_drive', 'google_docs', 'google_sheets', 'google_calendar',
    'outlook', 'excel'
  )),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (
    (provider = 'google' and connector_provider in
      ('gmail', 'google_drive', 'google_docs', 'google_sheets', 'google_calendar'))
    or
    (provider = 'microsoft' and connector_provider in ('outlook', 'excel'))
  )
);

create index if not exists oauth_states_expires_at_idx
  on public.oauth_states (expires_at);

alter table public.oauth_states enable row level security;
revoke all privileges on table public.oauth_states from PUBLIC, anon, authenticated;
grant all privileges on table public.oauth_states to service_role;

-- RLS limits visible rows; it does not hide sensitive columns.
revoke all privileges on table public.connectors from PUBLIC, anon, authenticated;
revoke select (access_token, refresh_token, token_expires_at)
  on table public.connectors from PUBLIC, anon, authenticated;
grant select (id, user_id, provider, account_email, scopes, status, created_at, updated_at)
  on table public.connectors to authenticated;
grant delete on table public.connectors to authenticated;
grant all privileges on table public.connectors to service_role;

-- Bounded cleanup: delete at most 1,000 expired state rows per invocation.
-- The SECURITY DEFINER function is callable only by service_role and the
-- postgres-owned scheduled job; browser roles receive no direct table access.
create or replace function public.cleanup_expired_oauth_states(
  p_now timestamptz default clock_timestamp()
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  deleted_count bigint;
begin
  with expired as (
    select state_hash
    from public.oauth_states
    where expires_at <= p_now
    order by expires_at
    limit 1000
    for update skip locked
  )
  delete from public.oauth_states as states
  using expired
  where states.state_hash = expired.state_hash;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

revoke all on function public.cleanup_expired_oauth_states(timestamptz)
  from PUBLIC, anon, authenticated;
grant execute on function public.cleanup_expired_oauth_states(timestamptz)
  to service_role;

-- Supabase Cron upserts a job with the same name, so reapplying this migration
-- updates the schedule rather than creating duplicates.
select cron.schedule(
  'cleanup-expired-oauth-states',
  '*/15 * * * *',
  'select public.cleanup_expired_oauth_states(clock_timestamp())'
);
