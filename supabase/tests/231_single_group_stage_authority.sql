-- Contract 182: one season Championship group-stage authority (`CUP-005`).
--
-- THE ASSERTION THIS FILE EXISTS FOR is that the guard FIRES. A guard that has
-- never been shown to refuse anything is indistinguishable from one that
-- cannot, and it reports success for ever either way. So this suite installs a
-- function that reaches `settle_season_cup_tie` AND writes the group-stage
-- relations — exactly the second authority ADR 0028 § 7 forbids — and requires
-- `assert_single_group_stage_authority()` to raise on it. Everything is rolled
-- back.
--
-- The second is the POSITIVE control. Every "nothing names X" assertion here
-- would also pass if X had simply been renamed, so the suite requires contract
-- 169's dispatcher to still reach `cup_season_group_tables`. Without that pair,
-- a rename would turn this file green and silent.

begin;

select plan(9);

-- ---------------------------------------------------------------------------
-- The state contract 182 was installed into
-- ---------------------------------------------------------------------------

select lives_ok(
  'select predictor_internal.assert_single_group_stage_authority()',
  'the guard passes on the repository as it stands');

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'predictor_internal')
      and p.proname not in ('settle_season_cup_tie', 'assert_single_group_stage_authority')
      and p.prosrc like '%settle_season_cup_tie%'),
  0,
  'settle_season_cup_tie is reached by nothing, which is why the two cannot disagree today');

-- THE POSITIVE CONTROL. Without this, a rename makes every other assertion
-- pass by both sides being absent.
select ok(
  (select p.prosrc like '%cup_season_group_tables%'
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal' and p.proname = 'cup_initial_group_tables'),
  'contract 169''s dispatcher still reaches the authority ADR 0028 section 7 names');

select ok(
  (select obj_description(p.oid, 'pg_proc') like '%sole season%'
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal' and p.proname = 'cup_season_group_tables'),
  'and the authority says on itself that it is the only one');

select ok(
  (select obj_description(p.oid, 'pg_proc') like '%NOT the season group-stage authority%'
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal' and p.proname = 'settle_season_cup_tie'),
  'while the per-tie rule says on itself that it is not');

-- ---------------------------------------------------------------------------
-- THE MUTANT. This is the assertion the file exists for.
--
-- Installed in `public` rather than `predictor_internal`, for two reasons: it
-- is where a real offending driver would live (`admin_finalise_predictor_cup_groups`
-- is public), and `pgTapFunctionReferences` correctly refuses a suite that names
-- a `predictor_internal` function no migration defines.
-- ---------------------------------------------------------------------------

create function public.zz_c182_second_authority(p_competition_id uuid)
returns void
language plpgsql
as $mutant$
begin
  -- Reaches the per-tie rule AND writes the group stage: precisely the second
  -- expression of ADR 0014's group-stage rule that ADR 0028 section 7 forbids.
  perform predictor_internal.settle_season_cup_tie('{}'::jsonb, '{}'::jsonb, '{}'::jsonb);
  update public.bonus_cup_members
     set qualified_as = 'group_winner'
   where competition_id = p_competition_id;
end;
$mutant$;

select throws_ok(
  'select predictor_internal.assert_single_group_stage_authority()',
  '23514',
  null,
  'a driver that settles ties AND writes the group stage is refused -- the guard fires');

-- The message must NAME the offender. An operator told only that "a second
-- authority exists" has to search every migration by hand to find which one.
select throws_like(
  'select predictor_internal.assert_single_group_stage_authority()',
  '%zz_c182_second_authority%',
  'and the refusal names the offending function rather than failing anonymously');

drop function public.zz_c182_second_authority(uuid);

select lives_ok(
  'select predictor_internal.assert_single_group_stage_authority()',
  'and it passes again once the second authority is removed, so it tracks state rather than latching');

-- ---------------------------------------------------------------------------
-- The conjunction is deliberate
-- ---------------------------------------------------------------------------
--
-- The knockout driver CUP-002 will legitimately reach the tie rule. A guard
-- forbidding that outright would be deleted by whoever writes it, so the guard
-- refuses the CONJUNCTION and this proves the half it must tolerate.

create function public.zz_c182_knockout_shape(p_x jsonb)
returns jsonb
language sql
as $ko$
  select predictor_internal.settle_season_cup_tie(p_x, p_x, p_x);
$ko$;

select lives_ok(
  'select predictor_internal.assert_single_group_stage_authority()',
  'a caller that settles ties and writes NO group-stage row is permitted, which CUP-002 needs');

drop function public.zz_c182_knockout_shape(jsonb);

select * from finish();
rollback;
