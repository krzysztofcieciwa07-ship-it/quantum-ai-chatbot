-- OAuth account-linking hardening.
-- Apply this migration to existing Supabase projects before deploying the OAuth code.

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
