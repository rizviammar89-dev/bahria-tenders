-- Self-service signup (OPEN model). A new user creates their own auth account on the client
-- (supabase.auth.signUp with the synthetic phone-email) and then inserts their OWN profile row.
-- RLS lets them insert only their own row and only safe columns; a trigger sets the trust/identity
-- fields server-side so the client can never self-grant verification or reputation.
--
-- OPEN model: providers are auto-verified (verified_by_admin = true) so they can bid immediately.
-- To switch to PENDING-APPROVAL later: set verified_by_admin := false in the trigger below and flip
-- it manually (Supabase Studio) once you've vetted each provider.

-- Client may insert ONLY these columns of its own profile. Deliberately excludes verified_by_admin,
-- rating_sum, rating_count, phone_verified_at — those are server-set by the trigger.
grant insert (id, role, full_name, phone, precinct, service_ids) on public.profiles to authenticated;

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- Server-authoritative trust fields on every profile insert (ignores whatever the client sent).
create or replace function public.set_profile_trust_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.phone_verified_at := now();                    -- open model: vouched at signup
  new.verified_by_admin := (new.role = 'provider');  -- OPEN: providers can bid immediately
  new.rating_sum := 0;                               -- reputation starts clean; only the 3.3 trigger moves it
  new.rating_count := 0;
  return new;
end;
$$;

create trigger profiles_set_trust
  before insert on public.profiles
  for each row execute function public.set_profile_trust_fields();
