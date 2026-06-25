-- Hunt visibility follows the provider's active mode: in Work mode they appear on the Hunt map; in
-- Hire mode they're hidden. The client sets in_hire_mode when toggling. Default false = visible
-- (providers default to Work view).
alter table public.profiles add column in_hire_mode boolean not null default false;

grant update (in_hire_mode) on public.profiles to authenticated; -- client toggles its own
grant select (in_hire_mode) on public.profiles to authenticated; -- Hunt filters on it
