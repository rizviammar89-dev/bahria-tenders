-- Add Aluminium / Glass work as a trade (service).
insert into public.services (slug, display_en, display_ur)
select 'aluminium_glass', 'Aluminium / Glass', 'ایلومینیم / شیشہ'
where not exists (select 1 from public.services where slug = 'aluminium_glass');
