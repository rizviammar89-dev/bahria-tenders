-- In-app chat: a per-(job, provider) thread between the job's resident and that provider. Each
-- message is text and/or a voice note (audio file in the public chat-audio bucket). Realtime-streamed.
-- A thread is valid only when the provider has a relationship to the job (placed a bid OR was awarded).

create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs (id) on delete cascade,
  provider_id  uuid not null references public.profiles (id), -- the provider party of the thread
  sender_id    uuid not null references public.profiles (id),
  recipient_id uuid not null references public.profiles (id),
  body         text,
  audio_path   text, -- chat-audio object path for a voice message
  created_at   timestamptz not null default now(),
  constraint messages_text_or_audio_chk check (body is not null or audio_path is not null)
);
create index messages_thread_idx on public.messages (job_id, provider_id, created_at);

alter table public.messages enable row level security;
grant select, insert on public.messages to authenticated;

-- Is `p_uid` allowed in the (job, provider) thread? Either party, and the provider must have a
-- bid on the job or be the awarded provider. SECURITY DEFINER so the policy can see bids/jobs.
create or replace function public.is_chat_party(p_job_id uuid, p_provider_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.jobs j
    where j.id = p_job_id
      and (p_uid = j.resident_id or p_uid = p_provider_id)
      and (
        exists (select 1 from public.bids b where b.job_id = j.id and b.provider_id = p_provider_id)
        or j.awarded_provider_id = p_provider_id
      )
  );
$$;
revoke all on function public.is_chat_party(uuid, uuid, uuid) from public, anon;
grant execute on function public.is_chat_party(uuid, uuid, uuid) to authenticated;

create policy messages_select_party on public.messages
  for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy messages_insert_party on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and recipient_id <> auth.uid()
    and public.is_chat_party(job_id, provider_id, auth.uid())
    -- the two parties must be exactly the job's resident and provider_id
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and (
          (sender_id = j.resident_id and recipient_id = provider_id)
          or (sender_id = provider_id and recipient_id = j.resident_id)
        )
    )
  );

-- Stream new messages to open chats.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- Voice-note storage (public read; writes locked to the owner's folder).
insert into storage.buckets (id, name, public)
values ('chat-audio', 'chat-audio', true)
on conflict (id) do nothing;

create policy chat_audio_read on storage.objects
  for select to public using (bucket_id = 'chat-audio');

create policy chat_audio_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-audio' and (storage.foldername(name))[1] = auth.uid()::text);
