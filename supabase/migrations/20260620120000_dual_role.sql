-- Dual-role model: every account is a resident (can post jobs & hire); an `is_provider` capability
-- unlocks provider features (bidding, job feed, map presence, trades). One phone = one account that
-- can do BOTH, toggled by an in-app "mode" view preference. Replaces the fixed single-role gate.
--
-- OPEN model preserved: enabling provider mode auto-verifies the user (verified_by_admin), set
-- server-side so a client can never self-grant trust. To switch to PENDING-APPROVAL later, change
-- the two triggers below to set verified_by_admin := false and flip it manually in Studio.

-- 1. Capability flag. Default false → existing residents stay residents; backfill existing providers.
alter table public.profiles add column is_provider boolean not null default false;
update public.profiles set is_provider = true where role = 'provider';

-- 2. Let a user self-enable provider mode (open model). verified_by_admin stays OUT of the grant —
--    it's server-set by the triggers below. service_ids is already client-updatable (Story 1.3).
grant update (is_provider) on public.profiles to authenticated;

-- 3. Signup trigger: also derive is_provider from the declared role at insert (keeps a provider
--    signup auto-enabled without granting the client INSERT on is_provider).
create or replace function public.set_profile_trust_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.phone_verified_at := now();                    -- open model: vouched at signup
  new.is_provider := (new.role = 'provider');        -- declared-provider signups start enabled
  new.verified_by_admin := (new.role = 'provider');  -- OPEN: providers can bid immediately
  new.rating_sum := 0;                               -- reputation starts clean; only the 3.3 trigger moves it
  new.rating_count := 0;
  return new;
end;
$$;

-- 4. Update trigger: when a resident flips is_provider on, auto-verify them (open model).
--    Server-authoritative — the client can set is_provider but never verified_by_admin directly.
create or replace function public.set_provider_trust_on_enable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_provider and not old.is_provider then
    new.verified_by_admin := true;
  end if;
  return new;
end;
$$;

create trigger profiles_set_provider_trust
  before update on public.profiles
  for each row execute function public.set_provider_trust_on_enable();

-- 5. Repoint the provider gate on bidding from role → is_provider (verification + self-bid guard
--    unchanged). Drop & recreate the insert policy.
drop policy bids_insert_provider on public.bids;
create policy bids_insert_provider on public.bids
  for insert to authenticated
  with check (
    provider_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_provider and p.verified_by_admin
    )
    and exists (
      select 1 from public.jobs j
      where j.id = bids.job_id and j.status = 'open' and j.resident_id <> auth.uid()
    )
  );

-- 6. Repoint the broadcast matcher from role → is_provider (same verified + precinct + trade +
--    not-self filters).
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
