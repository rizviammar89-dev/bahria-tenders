-- Favorites / re-hire: a resident saves providers they trust, to find and re-hire them quickly.
-- Resident-owned; each resident sees and manages only their own list.
create table public.favorites (
  resident_id uuid not null references public.profiles (id) on delete cascade,
  provider_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (resident_id, provider_id)
);

alter table public.favorites enable row level security;
grant select, insert, delete on public.favorites to authenticated;

create policy favorites_select_own on public.favorites
  for select to authenticated using (resident_id = auth.uid());
create policy favorites_insert_own on public.favorites
  for insert to authenticated with check (resident_id = auth.uid());
create policy favorites_delete_own on public.favorites
  for delete to authenticated using (resident_id = auth.uid());
