-- Provider "not interested": let a provider hide a job from their Jobs feed. Provider-scoped and
-- soft — it does not touch the job itself or affect other providers/the resident.
create table public.job_dismissals (
  provider_id uuid not null references public.profiles(id) on delete cascade,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (provider_id, job_id)
);

alter table public.job_dismissals enable row level security;

-- A provider manages only their own dismissals.
create policy job_dismissals_select_own on public.job_dismissals
  for select to authenticated using (provider_id = auth.uid());
create policy job_dismissals_insert_own on public.job_dismissals
  for insert to authenticated with check (provider_id = auth.uid());
create policy job_dismissals_delete_own on public.job_dismissals
  for delete to authenticated using (provider_id = auth.uid());

grant select, insert, delete on public.job_dismissals to authenticated;
