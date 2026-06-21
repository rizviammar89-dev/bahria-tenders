-- Fix: the dual-role migration (20260620120000) added profiles.is_provider and granted UPDATE on it,
-- but NOT column-scoped SELECT. The client reads is_provider (auth role resolution, job feed, live
-- map), so without this grant those selects fail and the app can't tell a user has a profile.
grant select (is_provider) on public.profiles to authenticated;
