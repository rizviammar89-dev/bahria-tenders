-- Add Fumigation as a trade (service).
insert into public.services (slug, display_en, display_ur)
select 'fumigation', 'Fumigation', 'فیومیگیشن'
where not exists (select 1 from public.services where slug = 'fumigation');
