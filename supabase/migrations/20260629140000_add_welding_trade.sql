-- Add Welding / Grills / Fabrication as a trade (service).
insert into public.services (slug, display_en, display_ur)
select 'welding', 'Welding / Grills', 'ویلڈنگ / گرل'
where not exists (select 1 from public.services where slug = 'welding');
