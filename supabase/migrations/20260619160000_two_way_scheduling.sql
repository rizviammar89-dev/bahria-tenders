-- Two-way scheduling: after award, the resident and the awarded provider negotiate a concrete
-- appointment (date + time-of-day). One party proposes; the OTHER confirms. Reuses the day/slot
-- model. Writes go through SECURITY DEFINER RPCs (only the two parties; provider can't otherwise
-- write the job row). jobs already has a table-level SELECT grant, so the new columns are readable.

alter table public.jobs
  add column scheduled_date        date,
  add column scheduled_slot        text
    check (scheduled_slot is null or scheduled_slot in ('morning', 'afternoon', 'evening')),
  add column schedule_proposed_by  uuid references public.profiles (id),
  add column schedule_confirmed    boolean not null default false;

-- Propose (or re-propose) an appointment. Resets confirmation — the other party must accept again.
create or replace function public.propose_schedule(p_job_id uuid, p_date date, p_slot text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.jobs;
begin
  select * into j from public.jobs where id = p_job_id;
  if not found then raise exception 'Job not found.' using errcode = 'P0002'; end if;
  if auth.uid() is null or auth.uid() not in (j.resident_id, j.awarded_provider_id) then
    raise exception 'Not authorized to schedule this job.' using errcode = '42501';
  end if;
  if j.status <> 'awarded' then
    raise exception 'Only an awarded job can be scheduled.' using errcode = '22023';
  end if;
  if p_slot is not null and p_slot not in ('morning', 'afternoon', 'evening') then
    raise exception 'Invalid time slot.' using errcode = '22023';
  end if;
  update public.jobs
    set scheduled_date = p_date,
        scheduled_slot = p_slot,
        schedule_proposed_by = auth.uid(),
        schedule_confirmed = false
    where id = p_job_id;
end;
$$;
revoke all on function public.propose_schedule(uuid, date, text) from public, anon;
grant execute on function public.propose_schedule(uuid, date, text) to authenticated;

-- Accept the standing proposal. Only the party who did NOT propose it can confirm.
create or replace function public.accept_schedule(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.jobs;
begin
  select * into j from public.jobs where id = p_job_id;
  if not found then raise exception 'Job not found.' using errcode = 'P0002'; end if;
  if auth.uid() is null or auth.uid() not in (j.resident_id, j.awarded_provider_id) then
    raise exception 'Not authorized to schedule this job.' using errcode = '42501';
  end if;
  if j.scheduled_date is null or j.schedule_proposed_by is null then
    raise exception 'There is no proposed time to accept.' using errcode = '22023';
  end if;
  if j.schedule_proposed_by = auth.uid() then
    raise exception 'The other party must accept your proposed time.' using errcode = '22023';
  end if;
  update public.jobs set schedule_confirmed = true where id = p_job_id;
end;
$$;
revoke all on function public.accept_schedule(uuid) from public, anon;
grant execute on function public.accept_schedule(uuid) to authenticated;
