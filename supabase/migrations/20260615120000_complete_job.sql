-- Story 2.9: mark-an-awarded-job-completed RPC (FR-11/FR-12).
-- Mirrors award_job (20260614082522): SECURITY DEFINER (runs as owner, bypasses RLS)
-- with `set search_path = public`, revoked from public/anon, execute granted ONLY to authenticated.

-- ============================================================
-- complete_job — move an AWARDED job to 'completed'.
-- Enforces the awarded→completed transition + ownership, which plain RLS can't
-- (RLS grants the resident the status-column write but cannot constrain WHICH transition).
-- Null auth.uid() is safe: the identity check lives in the WHERE clause → null yields
-- 0 rows → `if not found` raises (same safe pattern as award_job).
-- Offline completion (FR-11): NO payment — this is purely the status flip that unlocks rating.
-- ============================================================
create or replace function public.complete_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.jobs
    set status = 'completed'
    where id = p_job_id
      and resident_id = auth.uid()  -- caller must own the job
      and status = 'awarded';       -- only from awarded (one-way completion)
  if not found then
    raise exception 'Cannot complete: the job is not awarded or not yours.'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.complete_job(uuid) from public, anon;
grant execute on function public.complete_job(uuid) to authenticated;
