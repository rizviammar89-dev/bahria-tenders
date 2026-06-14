-- Story 2.8: award + contact-sharing RPCs (FR-9/FR-10).
-- Both are SECURITY DEFINER (run as owner, bypass RLS) with `set search_path = public`
-- (prevents search-path hijacking) and execute granted ONLY to authenticated.

-- ============================================================
-- award_job — move an OPEN job to 'awarded' for a provider who bid.
-- Enforces the open→awarded transition + award-to-a-real-bidder, which plain RLS can't.
-- Still checks identity explicitly (caller must be the job's resident).
-- ============================================================
create or replace function public.award_job(p_job_id uuid, p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.jobs
    set status = 'awarded', awarded_provider_id = p_provider_id
    where id = p_job_id
      and resident_id = auth.uid()  -- caller must own the job
      and status = 'open'           -- only from open (one-way award)
      and exists (
        select 1 from public.bids b
        where b.job_id = p_job_id and b.provider_id = p_provider_id
      );
  if not found then
    raise exception 'Cannot award: the job is not open, not yours, or that provider did not bid.'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.award_job(uuid, uuid) from public, anon;
grant execute on function public.award_job(uuid, uuid) to authenticated;

-- ============================================================
-- get_job_contacts — reveal both parties' phones for an awarded/completed job,
-- ONLY to the resident or the awarded provider. Reads the phone column that client
-- grants withhold (Story 1.3) — the deliberate, audited FR-10 contact channel.
-- ============================================================
create or replace function public.get_job_contacts(p_job_id uuid)
returns table (resident_name text, resident_phone text, provider_name text, provider_phone text)
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
  if not (
    j.status in ('awarded', 'completed')
    and (auth.uid() = j.resident_id or auth.uid() = j.awarded_provider_id)
  ) then
    raise exception 'Not authorized to view these contacts.' using errcode = '42501';
  end if;
  return query
    select r.full_name, r.phone, p.full_name, p.phone
    from public.profiles r
    join public.profiles p on p.id = j.awarded_provider_id
    where r.id = j.resident_id;
end;
$$;

revoke all on function public.get_job_contacts(uuid) from public, anon;
grant execute on function public.get_job_contacts(uuid) to authenticated;
