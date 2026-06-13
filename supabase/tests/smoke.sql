-- Story 1.1 AC-3: prove the pgTAP harness works before any real tests exist.
begin;
select plan(1);

select ok(true, 'pgTAP harness runs');

select * from finish();
rollback;
