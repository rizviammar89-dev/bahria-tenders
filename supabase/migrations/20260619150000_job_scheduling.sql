-- Scheduling: the resident says WHEN they need the job done. preferred_date null = "as soon as
-- possible"; preferred_slot is a coarse time-of-day window (or null/anytime). Nullable so legacy
-- jobs and "ASAP" requests are valid. Providers see this to plan and bid.
alter table public.jobs
  add column preferred_date date,
  add column preferred_slot text
    check (preferred_slot is null or preferred_slot in ('morning', 'afternoon', 'evening'));

comment on column public.jobs.preferred_date is 'Resident''s preferred day; null = as soon as possible';
comment on column public.jobs.preferred_slot is 'Preferred time-of-day window: morning/afternoon/evening; null = anytime';
