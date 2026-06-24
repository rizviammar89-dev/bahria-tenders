-- Hunt page: residents can call a provider directly from the map. Phone is otherwise private
-- (revealed post-award via get_job_contacts), so expose ONLY a provider's number, via a
-- SECURITY DEFINER function, to authenticated users. (Deliberate: "show number in Hunt".)
create or replace function public.get_provider_phone(p_provider_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select phone from public.profiles where id = p_provider_id and is_provider = true;
$$;

revoke all on function public.get_provider_phone(uuid) from public, anon;
grant execute on function public.get_provider_phone(uuid) to authenticated;
