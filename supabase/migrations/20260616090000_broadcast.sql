-- Story 2.5: broadcast & provider notifications backend (FR-20, push-only).
-- (1) push_tokens — persists each user's Expo push token (1.1 only displayed it).
-- (2) broadcast_job() — SECURITY DEFINER matcher: writes idempotent notification_log rows
--     for matching verified providers and returns the unsent rows that have a token, for the
--     broadcast-job Edge Function (service_role) to send via Expo and then mark sent.

-- ============================================================
-- push_tokens — owner-managed; the dispatcher reads all via service_role.
-- ============================================================
create table public.push_tokens (
  user_id          uuid primary key references public.profiles (id) on delete cascade,
  expo_push_token  text not null,
  updated_at       timestamptz not null default now()
);

revoke all on public.push_tokens from anon, authenticated;
grant all on public.push_tokens to service_role;
alter table public.push_tokens enable row level security;

-- Column-scoped client access: a user upserts/reads ONLY their own token row.
grant select, insert on public.push_tokens to authenticated;
grant update (expo_push_token, updated_at) on public.push_tokens to authenticated;

create policy push_tokens_select_own on public.push_tokens
  for select to authenticated using (user_id = auth.uid());
create policy push_tokens_insert_own on public.push_tokens
  for insert to authenticated with check (user_id = auth.uid());
create policy push_tokens_update_own on public.push_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- No client DELETE policy. service_role (the dispatcher) bypasses RLS to read all tokens.

-- ============================================================
-- broadcast_job — match verified providers (trade ∈ service_ids AND same precinct, excluding the
-- resident), log one idempotent push row each, and return the unsent rows that have a token.
-- SECURITY DEFINER: reads tokens + writes notification_log, which clients cannot. Called ONLY by
-- the service_role Edge Function (revoked from all client roles).
-- ============================================================
create or replace function public.broadcast_job(p_job_id uuid)
returns table (notification_id uuid, recipient_id uuid, expo_push_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.jobs;
begin
  select * into j from public.jobs where id = p_job_id;
  if not found then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  -- One idempotent push row per matching verified provider (re-runs insert nothing new).
  insert into public.notification_log (recipient_id, job_id, channel, idempotency_key)
  select pr.id, j.id, 'push', j.id::text || ':' || pr.id::text || ':push'
  from public.profiles pr
  where pr.role = 'provider'
    and pr.verified_by_admin
    and j.service_id = any(pr.service_ids)
    and pr.precinct = j.precinct
    and pr.id <> j.resident_id
  on conflict (idempotency_key) do nothing;

  -- Return the rows still needing a send that have a token (matcher is idempotent; this is retry-safe).
  return query
    select nl.id, nl.recipient_id, t.expo_push_token
    from public.notification_log nl
    join public.push_tokens t on t.user_id = nl.recipient_id
    where nl.job_id = p_job_id
      and nl.channel = 'push'
      and nl.sent_at is null;
end;
$$;

revoke all on function public.broadcast_job(uuid) from public, anon, authenticated;
-- The broadcast-job Edge Function runs as service_role; PUBLIC's default execute was just revoked,
-- so grant it back explicitly to service_role (and nobody else).
grant execute on function public.broadcast_job(uuid) to service_role;
