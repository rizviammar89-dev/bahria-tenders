-- Quick-dev: structured posting address. Residents enter a villa/apartment number and a
-- street/building name alongside the precinct number, so the job can be located precisely.
-- Nullable so existing precinct-only jobs stay valid; the post form requires them for new jobs.
-- Table-level INSERT grant on public.jobs already covers these columns (no policy change needed).
alter table public.jobs
  add column address_unit   text,  -- Villa / Apartment number
  add column address_street text;  -- Street / Building name

comment on column public.jobs.address_unit is 'Villa/Apartment number — resident-entered address line';
comment on column public.jobs.address_street is 'Street/Building name — resident-entered address line';
