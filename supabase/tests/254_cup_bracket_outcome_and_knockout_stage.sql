-- Contract 207: contract 193 states the caller's outcome, and means "knockout"
-- when it says so.
--
-- TWO DEFECTS, ONE READ, AND BOTH ARE ONLY VISIBLE IN A COMPETITION THAT HAS
-- SPLIT — which is why they survived contract 193's own suite.
--
-- 1. ELIMINATION WAS RETURNED BY NOTHING. `champion` was present and
--    `eliminated` was returned by no season Championship read a surface can
--    call. A page could say who WON and not who was OUT, and every available
--    inference — lost your only tie, hold no later fixture, hold no seed — is
--    conclusive-looking and wrong whenever a competition has not finished
--    eliminating.
--
-- 2. `stage <> 'group'` INCLUDED `split`. Contract 102 widened the stage domain
--    to `('group','split','playoff','knockout')` and its own commentary warned
--    that the broad form must not "let a split fixture enter the knockout
--    settler". A split fixture never settles, so `winner_user_id is null` does
--    not exclude it: a `single_group` Championship that reached its split was
--    offered a LEAGUE FIXTURE AS A KNOCKOUT TIE, and `qualification.drawn`
--    reported `true` with an empty bracket.
--
-- The fixture below is therefore a split-phase competition with NO knockout at
-- all. Under contract 193 as it stood, `my_tie` is that split fixture and
-- `drawn` is true. Under contract 207 there is no tie and nothing is drawn.

begin;

select plan(11);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C208 Outcome Probe', 2072, t.competition_id, 'cup-outcome', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.co_season',
  (select id::text from public.tournaments where season_key = 'cup-outcome'), true);

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('co-user-' || n)::uuid, format('co-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 5) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('co-user-' || n)::uuid, 'Outcome ' || n, now()
from generate_series(1, 5) as n;

insert into public.bonus_competitions (
  id, tournament_id, game_key, name, owner_id, invite_code, published,
  availability_status, draw_required, visibility_kind,
  registration_opens_at, draw_completed_at
) values (
  md5('co-cup')::uuid, current_setting('test.co_season')::uuid,
  'predictor_cup', 'Outcome Probe Championship', md5('co-user-1')::uuid,
  'COOUTCOMECODE1', true, 'active', true, 'private',
  now() - interval '60 days', now() - interval '55 days');

-- FOUR ENTRANTS WITH FOUR DIFFERENT OUTCOMES, because a read that returned the
-- caller's row by accident — or everyone's — passes a one-outcome fixture.
insert into public.bonus_competition_entrants (competition_id, user_id, outcome) values
  (md5('co-cup')::uuid, md5('co-user-1')::uuid, 'eliminated'),
  (md5('co-cup')::uuid, md5('co-user-2')::uuid, 'active'),
  (md5('co-cup')::uuid, md5('co-user-3')::uuid, 'champion'),
  (md5('co-cup')::uuid, md5('co-user-4')::uuid, 'qualified');

-- `single_group`: the format that splits rather than producing a knockout, and
-- therefore the one the broad stage predicate is wrong for.
insert into public.bonus_cup_launches (competition_id, format_kind, group_stage_last_sequence)
values (md5('co-cup')::uuid, 'single_group', 20);

insert into public.bonus_cup_groups (id, competition_id, ordinal, size)
values (md5('co-grp')::uuid, md5('co-cup')::uuid, 1, 4);

insert into public.bonus_cup_members (competition_id, group_id, user_id, draw_number, seed)
select md5('co-cup')::uuid, md5('co-grp')::uuid, md5('co-user-' || n)::uuid, n, n
from generate_series(1, 4) as n;

-- THE SPLIT. A split group, a split membership and a split FIXTURE — which is
-- a group-shaped row: no round_size, no bracket_slot, and it can never settle
-- (`bonus_cup_fixtures_group_never_settles`).
insert into public.bonus_cup_groups
  (id, competition_id, ordinal, size, phase_kind, parent_group_id)
values (md5('co-grp-split')::uuid, md5('co-cup')::uuid, 2, 4, 'split', md5('co-grp')::uuid);

insert into public.bonus_cup_members
  (competition_id, group_id, user_id, draw_number, phase_kind)
select md5('co-cup')::uuid, md5('co-grp-split')::uuid, md5('co-user-' || n)::uuid, n, 'split'
from generate_series(1, 4) as n;

insert into public.bonus_competition_windows (id, competition_id, sequence, label)
values (md5('co-w-split')::uuid, md5('co-cup')::uuid, 21, 'Split matchday 1');

insert into public.bonus_cup_fixtures (
  id, competition_id, window_id, stage, group_id, matchday,
  home_user_id, away_user_id)
values (md5('co-f-split')::uuid, md5('co-cup')::uuid, md5('co-w-split')::uuid,
        'split', md5('co-grp-split')::uuid, 1,
        md5('co-user-1')::uuid, md5('co-user-2')::uuid);

-- ---------------------------------------------------------------------------
-- The eliminated reader.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('co-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.co_seen',
  public.get_season_cup_bracket(md5('co-cup')::uuid)::text, true);

-- THE ELIMINATION GAP, CLOSED. Before contract 207 this key does not exist.
select is(
  current_setting('test.co_seen')::jsonb ->> 'your_outcome',
  'eliminated',
  'the caller''s canonical outcome is stated by the settlement authority');

select is(
  (current_setting('test.co_seen')::jsonb ->> 'entered')::boolean,
  true,
  'and the entrancy gate still answers, having read the row rather than counted it');

-- THE STAGE DEFECT, CLOSED. A split fixture is a group-phase table row.
select is(
  current_setting('test.co_seen')::jsonb -> 'my_tie',
  'null'::jsonb,
  'a split fixture is NOT offered as the caller''s live knockout tie');

select is(
  (current_setting('test.co_seen')::jsonb #>> '{qualification,drawn}')::boolean,
  false,
  'and a competition with split fixtures and no knockout is not reported as drawn');

select is(
  jsonb_array_length(current_setting('test.co_seen')::jsonb -> 'bracket'),
  0,
  'the bracket is empty, which is what "not drawn" has to agree with');

select is(
  jsonb_array_length(current_setting('test.co_seen')::jsonb -> 'my_ties'),
  0,
  'and the caller''s progression lists no split fixture as a tie either');

-- A tie that was never offered cannot carry a Penalty Number lane, which is
-- the concrete harm: `submit_cup_penalty_number` refuses a fixture that has no
-- round, so the control would have been an offer the write declines.
select is(
  current_setting('test.co_seen')::jsonb -> 'penalty_number',
  'null'::jsonb,
  'so no Penalty Number lane is offered for a fixture that has none');

-- Contract 205's pin still holds through the split.
select is(
  (current_setting('test.co_seen')::jsonb #>> '{qualification,your_seed}')::integer,
  1,
  'contract 205''s initial-phase seed pin is unchanged by this contract');

reset role;

-- ---------------------------------------------------------------------------
-- IT IS THE CALLER'S OWN OUTCOME. Two more readers, two more answers, and the
-- payload never carries anybody else's.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('co-user-3')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  public.get_season_cup_bracket(md5('co-cup')::uuid) ->> 'your_outcome',
  'champion',
  'a different entrant reads their OWN outcome, not the first caller''s');

-- Against the WHOLE payload, the way contract 193 guards the Penalty Number:
-- an implementation that annotated each bracket seat with its entrant's
-- standing passes a field-level check and fails this one.
-- THE QUOTED FORMS, AND ONLY TWO OF THE FOUR OUTCOMES.
--
-- `qualification.you_qualified` and `qualification.qualifiers` contain the
-- letters of an outcome and are legitimate keys, so the delimiters matter:
-- `"qualified"` with both quotes can only be a VALUE.
--
-- `"active"` is deliberately NOT asserted on, and the reason is a real near
-- miss rather than caution — `availability_status` is legitimately `active` in
-- this payload, so an assertion against that literal would fail a correct
-- implementation. `"eliminated"` and `"qualified"` collide with nothing here
-- and are held by two of the other three entrants, which is what the assertion
-- needs.
--
-- `"champion"` is not asserted on either: it is the READER's own outcome here
-- AND a payload key, so it cannot distinguish a leak from the correct answer.
select ok(
  public.get_season_cup_bracket(md5('co-cup')::uuid)::text not like '%"eliminated"%'
    and public.get_season_cup_bracket(md5('co-cup')::uuid)::text not like '%"qualified"%',
  'and nobody else''s outcome appears anywhere in the payload');

reset role;

-- ---------------------------------------------------------------------------
-- A non-entrant still learns nothing, including whether the competition exists.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('co-user-5')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  public.get_season_cup_bracket(md5('co-cup')::uuid),
  jsonb_build_object('entered', false, 'competition_id', md5('co-cup')::uuid),
  'a non-entrant is told only that they are not in it, with no outcome key at all');

reset role;

select * from finish();

rollback;
