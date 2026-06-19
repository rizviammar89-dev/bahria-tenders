-- Story 6.4: stream provider position changes to the resident live map via Supabase Realtime.
-- Add provider_locations to the realtime publication (idempotent). RLS still applies to the
-- stream — provider_locations_select_all already lets residents read all rows.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'provider_locations'
  ) then
    alter publication supabase_realtime add table public.provider_locations;
  end if;
end $$;
