-- Contract 206: `get_season_cup_phase` answers about a DETERMINATE membership.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that a split entrant is answered about
-- their SPLIT group, and that the answer is not a matter of which row the
-- planner happened to reach first.
--
-- Contract 102 keyed `bonus_cup_members` `(competition_id, user_id,
-- phase_kind)` so one entrant may hold two rows, and contract 124's split
-- transition inserts the second without deleting the first. Contract 120's
-- lookup named neither phase:
--
--     select member.group_id, member.phase_kind into v_group_id, v_phase_kind
--       from public.bonus_cup_members member
--      where member.competition_id = p_competition_id and member.user_id = v_uid;
--
-- Contract 193's equivalent was a SCALAR subquery, so it raised `21000` and was
-- found (contract 205). This one is a `select ... into`, which takes one row of
-- two and raises nothing — so the failure is a wrong answer rather than an
-- error, and it reaches the production Football Hub through
-- `src/services/supabase/seasonCup.ts`.
--
-- WHY THE SUITE ASSERTS ON `phase_kind`, `table_source` AND `group.id` RATHER
-- THAN ON THE TABLE'S ROWS. The three name the AUTHORITY the answer came from,
-- which is the thing the defect corrupted: a split entrant was handed the
-- initial group's identity and the initial table's authority. Asserting on the
-- rows would make this suite depend on contract 169's split-table arithmetic,
-- which is not what is under test here and has its own coverage.
--
-- The unsplit entrant and the non-entrant are asserted too, because a pin that
-- fixed the split case by changing either of them would be a regression that a
-- split-only suite would pass.

begin;

select plan(9);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C207 Phase Probe', 2071, t.competition_id, 'cup-phase-pin', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.cp_season',
  (select id::text from public.tournaments where season_key = 'cup-phase-pin'), true);

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('cp-user-' || n)::uuid, format('cp-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 5) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('cp-user-' || n)::uuid, 'Phase ' || n, now()
from generate_series(1, 5) as n;

insert into public.bonus_competitions (
  id, tournament_id, game_key, name, owner_id, invite_code, published,
  availability_status, draw_required, visibility_kind,
  registration_opens_at, draw_completed_at
) values (
  md5('cp-cup')::uuid, current_setting('test.cp_season')::uuid,
  'predictor_cup', 'Phase Pin Championship', md5('cp-user-1')::uuid,
  'CPPHASEPINCODE', true, 'active', true, 'private',
  now() - interval '60 days', now() - interval '55 days');

insert into public.bonus_competition_entrants (competition_id, user_id)
select md5('cp-cup')::uuid, md5('cp-user-' || n)::uuid from generate_series(1, 4) as n;

insert into public.bonus_cup_launches (competition_id, format_kind, group_stage_last_sequence)
values (md5('cp-cup')::uuid, 'single_group', 20);

insert into public.bonus_cup_groups (id, competition_id, ordinal, size)
values (md5('cp-grp')::uuid, md5('cp-cup')::uuid, 1, 4);

insert into public.bonus_cup_members (competition_id, group_id, user_id, draw_number, seed)
select md5('cp-cup')::uuid, md5('cp-grp')::uuid, md5('cp-user-' || n)::uuid, n, n
from generate_series(1, 4) as n;

-- ---------------------------------------------------------------------------
-- BEFORE THE SPLIT. Every entrant holds one row, and this is the answer the
-- pin must not disturb — it is the shape of every competition that never
-- splits at all.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('cp-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.cp_initial',
  public.get_season_cup_phase(md5('cp-cup')::uuid)::text, true);

select is(
  current_setting('test.cp_initial')::jsonb ->> 'phase_kind',
  'initial',
  'an entrant with one membership reads their initial phase');

select is(
  current_setting('test.cp_initial')::jsonb #>> '{group,id}',
  md5('cp-grp')::uuid::text,
  'and their initial group');

select is(
  current_setting('test.cp_initial')::jsonb ->> 'table_source',
  'season_initial',
  'from the season table, which is contract 169''s dispatch for a league season');

reset role;

-- ---------------------------------------------------------------------------
-- THE SPLIT. Contract 124 adds a second membership and keeps the first.
--
-- The split rows carry no seed, no group_position and no qualified_as, because
-- `bonus_cup_members_split_metadata_empty` forbids all three. That constraint
-- is the reason contract 205 pinned the SEED lookup to `initial` and this
-- contract pins the PHASE lookup to `split`: the two functions are asking
-- different questions of the same two rows, and each names the row that can
-- answer its own.
-- ---------------------------------------------------------------------------

insert into public.bonus_cup_groups
  (id, competition_id, ordinal, size, phase_kind, parent_group_id)
values (md5('cp-grp-split')::uuid, md5('cp-cup')::uuid, 2, 4, 'split',
        md5('cp-grp')::uuid);

insert into public.bonus_cup_members
  (competition_id, group_id, user_id, draw_number, phase_kind)
select md5('cp-cup')::uuid, md5('cp-grp-split')::uuid, md5('cp-user-' || n)::uuid, n, 'split'
from generate_series(1, 4) as n;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('cp-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.cp_split',
  public.get_season_cup_phase(md5('cp-cup')::uuid)::text, true);

-- THE DEFECT, DIRECTLY. Before contract 206 this returns `initial`.
select is(
  current_setting('test.cp_split')::jsonb ->> 'phase_kind',
  'split',
  'an entrant holding BOTH memberships is answered about their split phase');

select is(
  current_setting('test.cp_split')::jsonb #>> '{group,id}',
  md5('cp-grp-split')::uuid::text,
  'and about their split group, not the pre-split one they also still belong to');

select is(
  current_setting('test.cp_split')::jsonb ->> 'table_source',
  'split',
  'so the table is attributed to the authority that owns the split phase');

select is(
  current_setting('test.cp_split')::jsonb #>> '{group,parent_group_id}',
  md5('cp-grp')::uuid::text,
  'and the initial group is still reachable, as the split group''s parent');

-- The answer must not depend on the plan. Repeating the call after disabling
-- the sequential scan the seed data would otherwise favour exercises the
-- primary-key index path, where `initial` sorts before `split` and an
-- unpinned lookup would prefer the wrong row for the opposite reason.
set local enable_seqscan = off;
select is(
  public.get_season_cup_phase(md5('cp-cup')::uuid) ->> 'phase_kind',
  'split',
  'and the same row is chosen under an index plan, so determinacy is the key''s and not the planner''s');
set local enable_seqscan = on;

reset role;

-- ---------------------------------------------------------------------------
-- A non-entrant still learns only that they are not in it.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('cp-user-5')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  public.get_season_cup_phase(md5('cp-cup')::uuid),
  jsonb_build_object('competition_id', md5('cp-cup')::uuid, 'entered', false),
  'a non-entrant is told only that they are not in it, and the pin did not change that');

reset role;

select * from finish();

rollback;
