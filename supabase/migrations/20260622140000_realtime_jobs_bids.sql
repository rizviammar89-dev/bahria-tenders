-- Live updates: stream jobs + bids changes via Supabase Realtime so the provider feed shows new
-- open jobs instantly and the resident's My Jobs shows new bids instantly (no manual refresh). RLS
-- still applies to the stream (jobs_select_visible: open jobs visible to all; bids_select_party:
-- bids visible to the job's resident + the bidding provider). Idempotent.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobs'
  ) then
    alter publication supabase_realtime add table public.jobs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bids'
  ) then
    alter publication supabase_realtime add table public.bids;
  end if;
end $$;
