-- Provider subscription: a 2-month free trial when you become a provider, then Rs 2500/month.
-- Access is gated by profiles.provider_access_until — provider features lock once it passes.
-- Payments (via Safepay, in a later migration's Edge Function) extend provider_access_until.

-- 1. Access-expiry timestamp. NULL = never had provider access.
alter table public.profiles add column provider_access_until timestamptz;

-- Backfill existing providers with a fresh 2-month trial from now.
update public.profiles set provider_access_until = now() + interval '2 months' where is_provider;

-- Let the client read it (column-scoped SELECT) for the trial countdown / locked state.
grant select (provider_access_until) on public.profiles to authenticated;

-- 2. Start the trial when someone becomes a provider — at signup (insert as provider)...
create or replace function public.set_profile_trust_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.phone_verified_at := now();
  new.is_provider := (new.role = 'provider');
  new.verified_by_admin := (new.role = 'provider');
  if new.is_provider then
    new.provider_access_until := now() + interval '2 months'; -- free trial
  end if;
  new.rating_sum := 0;
  new.rating_count := 0;
  return new;
end;
$$;

-- ...or when a resident enables provider mode later.
create or replace function public.set_provider_trust_on_enable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_provider and not old.is_provider then
    new.verified_by_admin := true;
    if new.provider_access_until is null then
      new.provider_access_until := now() + interval '2 months'; -- trial on first enable
    end if;
  end if;
  return new;
end;
$$;

-- 3. Payments ledger. Written ONLY by the Safepay webhook (service_role); providers read their own.
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  provider_id     uuid not null references public.profiles (id) on delete cascade,
  amount_pkr      integer not null,
  period_months   integer not null default 1,
  status          text not null default 'pending'
                    check (status in ('pending', 'paid', 'failed', 'cancelled')),
  safepay_tracker text, -- Safepay tracker/order reference, for reconciliation + idempotency
  created_at      timestamptz not null default now(),
  paid_at         timestamptz
);

revoke all on public.payments from anon, authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
grant select on public.payments to authenticated;
create policy payments_select_own on public.payments
  for select to authenticated using (provider_id = auth.uid());
-- No client insert/update/delete: the webhook Edge Function (service_role) is the only writer.

-- 4. Enforcement: a provider can only bid while their access is current.
drop policy bids_insert_provider on public.bids;
create policy bids_insert_provider on public.bids
  for insert to authenticated
  with check (
    provider_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_provider
        and p.verified_by_admin
        and p.provider_access_until > now()
    )
    and exists (
      select 1 from public.jobs j
      where j.id = bids.job_id and j.status = 'open' and j.resident_id <> auth.uid()
    )
  );

-- Broadcast new jobs only to providers whose access is current.
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

  insert into public.notification_log (recipient_id, job_id, channel, idempotency_key)
  select pr.id, j.id, 'push', j.id::text || ':' || pr.id::text || ':push'
  from public.profiles pr
  where pr.is_provider
    and pr.verified_by_admin
    and pr.provider_access_until > now()
    and j.service_id = any(pr.service_ids)
    and pr.precinct = j.precinct
    and pr.id <> j.resident_id
  on conflict (idempotency_key) do nothing;

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
grant execute on function public.broadcast_job(uuid) to service_role;
