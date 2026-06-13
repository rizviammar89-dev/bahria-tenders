-- Story 1.2: POC core data model (7 tables) for the Bahria Town home-services marketplace.
-- Scope: schema + enums + constraints + the 6 PRD trades seed. NO RLS/grants (Story 1.3),
-- NO auth wiring (Story 1.4), NO reputation triggers (Story 3.3).

-- ============================================================
-- Enums (locked slugs — architecture.md "Locked enums")
-- ============================================================
create type public.user_role as enum ('resident', 'provider');
create type public.job_status as enum ('open', 'awarded', 'completed', 'cancelled');
create type public.dispute_status as enum ('pending_review', 'legit_remedied', 'legit_unresolved', 'not_upheld');
create type public.notification_channel as enum ('push', 'whatsapp_manual', 'sms');

-- ============================================================
-- services (the PRD "Trade" — reference data)
-- ============================================================
create table public.services (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  display_en  text not null,
  display_ur  text not null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- profiles (identity — phone-keyed; shares auth.users id)
-- ============================================================
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  role              public.user_role not null,
  full_name         text not null,
  phone             text not null unique,
  phone_verified_at timestamptz,
  precinct          text not null,
  verified_by_admin boolean not null default false,
  service_ids       uuid[] not null default '{}',   -- provider trades; post-POC: provider_services join table
  rating_sum        integer not null default 0,     -- raw reputation component (Story 3.3 writes these)
  rating_count      integer not null default 0,
  created_at        timestamptz not null default now(),
  -- Pakistani E.164 mobile: +92 + 3 (mobile prefix) + 9 digits
  constraint profiles_phone_e164_chk check (phone ~ '^\+923[0-9]{9}$')
);

-- ============================================================
-- jobs
-- ============================================================
create table public.jobs (
  id                  uuid primary key default gen_random_uuid(),
  resident_id         uuid not null references public.profiles (id),
  service_id          uuid not null references public.services (id),
  description         text not null,
  precinct            text not null,
  status              public.job_status not null default 'open',
  awarded_provider_id uuid references public.profiles (id),
  created_at          timestamptz not null default now(),
  cancelled_at        timestamptz,
  -- Single-row consistency: status cannot contradict the award/cancel fields.
  constraint jobs_cancel_consistency_chk
    check ((cancelled_at is not null) = (status = 'cancelled')),
  constraint jobs_awarded_requires_provider_chk
    check (status not in ('awarded', 'completed') or awarded_provider_id is not null)
);

-- ============================================================
-- bids (one active bid per provider per job)
-- ============================================================
create table public.bids (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  provider_id uuid not null references public.profiles (id),
  price_pkr   integer not null check (price_pkr > 0),  -- whole rupees (Rs 1,500)
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint bids_one_per_provider_per_job unique (job_id, provider_id)
);

-- The awarded provider must be someone who actually bid on THIS job.
-- Composite FK targets the bids unique key; awarded_provider_id is nullable, so
-- MATCH SIMPLE skips the check while a job is still open/unawarded.
alter table public.jobs
  add constraint jobs_awarded_provider_bid_fk
  foreign key (id, awarded_provider_id)
  references public.bids (job_id, provider_id);

-- ============================================================
-- ratings (one per job; write-once enforced by RLS in Story 1.3)
-- ============================================================
create table public.ratings (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id),
  provider_id uuid not null references public.profiles (id),
  resident_id uuid not null references public.profiles (id),
  stars       smallint not null check (stars between 1 and 5),
  review      text,
  created_at  timestamptz not null default now(),
  constraint ratings_one_per_job unique (job_id)
);

-- ============================================================
-- notification_log (idempotent, channel-tagged dispatch log)
-- ============================================================
create table public.notification_log (
  id              uuid primary key default gen_random_uuid(),
  recipient_id    uuid not null references public.profiles (id),
  job_id          uuid references public.jobs (id),
  channel         public.notification_channel not null,
  idempotency_key text not null unique,
  sent_at         timestamptz,
  opened_at       timestamptz,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- disputes (founder-only; RLS in Story 1.3)
-- ============================================================
create table public.disputes (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references public.jobs (id),
  raised_by         uuid not null references public.profiles (id),
  reason            text not null,
  status            public.dispute_status not null default 'pending_review',
  provider_response text,
  admin_notes       text,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

-- ============================================================
-- Indexes (job-feed + reputation query paths)
-- ============================================================
create index jobs_status_idx on public.jobs (status);
create index jobs_service_id_idx on public.jobs (service_id);
create index bids_job_id_idx on public.bids (job_id);
create index ratings_provider_id_idx on public.ratings (provider_id);

-- ============================================================
-- Seed: the 6 locked PRD v1 trades (idempotent → deploys to hosted too)
-- ============================================================
insert into public.services (slug, display_en, display_ur) values
  ('ac_technician', 'A/C Technician', 'اے سی ٹیکنیشن'),
  ('plumber',       'Plumber',        'پلمبر'),
  ('carpenter',     'Carpenter',      'کارپینٹر'),
  ('electrician',   'Electrician',    'الیکٹریشن'),
  ('mason',         'Mason',          'مستری'),
  ('painter',       'Painter',        'پینٹر')
on conflict (slug) do nothing;
