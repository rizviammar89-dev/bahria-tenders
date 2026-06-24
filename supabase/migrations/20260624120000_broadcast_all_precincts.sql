-- Broadcast new jobs to ALL matching providers regardless of precinct (drop the precinct filter).
-- Still scoped to providers who offer the job's trade, are verified, have active access, and aren't
-- the resident who posted it.
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
