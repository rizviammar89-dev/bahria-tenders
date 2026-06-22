-- Temporary diagnostic table: capture every incoming Safepay webhook (headers + raw body) so we can
-- read the exact payload via SQL during sandbox bring-up. Remove once verification is locked down.
create table public.webhook_debug (
  id          uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  headers     jsonb,
  body        text
);

revoke all on public.webhook_debug from anon, authenticated;
grant all on public.webhook_debug to service_role;
alter table public.webhook_debug enable row level security;
-- No client policies: only service_role (the webhook) writes; you read it via the SQL editor.
