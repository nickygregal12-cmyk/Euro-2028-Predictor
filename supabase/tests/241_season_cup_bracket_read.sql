-- Contract 193 / `CUP-003`: a season Championship entrant's own tie.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that the OPPONENT'S PENALTY NUMBER
-- never appears. It is the one secret in the Championship, and the failure is
-- invisible on screen: a payload carrying an extra integer looks exactly like
-- one that does not, and the surface that leaked it would still render
-- correctly.
--
-- So the suite seeds a live semi-final in which BOTH players have submitted,
-- with deliberately distinctive values, and asserts against the WHOLE
-- serialised payload rather than against the field the read is supposed to put
-- them in. An implementation that added the opponent's value anywhere — a
-- debugging key, a bracket annotation, a "they have locked in" flag carrying
-- the number — fails here and passes a field-level check.
--
-- The second assertion is that a non-entrant learns nothing, including whether
-- the competition exists. Contract 133 established that a private UUID is not
-- an existence oracle, and this read must not become one.

begin;

select plan(19);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C193 Bracket Probe', 2069, t.competition_id, 'cup-bracket', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.cb_season',
  (select id::text from public.tournaments where season_key = 'cup-bracket'), true);

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('cb-user-' || n)::uuid, format('cb-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 5) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('cb-user-' || n)::uuid, 'Bracket ' || n, now()
from generate_series(1, 5) as n;

-- A PRIVATE Championship, because that is the shape `CUP-003` matters most for
-- and the one a stranger must not be able to probe. `bonus_competitions_private_identity`
-- (contract 152) requires a private competition to carry a name, an owner and
-- an invite code, and to carry NONE of them when it is public — so all three
-- are supplied here rather than the competition being quietly made public to
-- get the insert through.
insert into public.bonus_competitions (
  id, tournament_id, game_key, name, owner_id, invite_code, published,
  availability_status, draw_required, visibility_kind,
  registration_opens_at, draw_completed_at
) values (
  md5('cb-cup')::uuid, current_setting('test.cb_season')::uuid,
  'predictor_cup', 'Bracket Probe Championship', md5('cb-user-1')::uuid,
  'CBBRACKETCODE1', true, 'active', true, 'private',
  now() - interval '60 days', now() - interval '55 days');

-- Four entrants qualify; user 5 is a stranger and enters nothing.
insert into public.bonus_competition_entrants (competition_id, user_id)
select md5('cb-cup')::uuid, md5('cb-user-' || n)::uuid from generate_series(1, 4) as n;

insert into public.bonus_cup_launches (competition_id, format_kind, group_stage_last_sequence)
values (md5('cb-cup')::uuid, 'groups', 20);

-- `size` rather than a label: the table carries a size check of 3 or 4, and
-- `tournament_id` is left to the backfill trigger the C1 foundation installed,
-- which is how every other Cup suite here seeds these rows.
insert into public.bonus_cup_groups (id, competition_id, ordinal, size)
values (md5('cb-grp')::uuid, md5('cb-cup')::uuid, 1, 4);

insert into public.bonus_cup_members (competition_id, group_id, user_id, draw_number, seed)
select md5('cb-cup')::uuid, md5('cb-grp')::uuid, md5('cb-user-' || n)::uuid, n, n
from generate_series(1, 4) as n;

insert into public.bonus_competition_windows (id, competition_id, sequence, label)
values (md5('cb-w-sf')::uuid, md5('cb-cup')::uuid, 21, 'Semi-finals');

-- A LIVE semi-final: user 1 (home, ODD lane) against user 2.
insert into public.bonus_cup_fixtures (
  id, competition_id, window_id, stage, round_size, bracket_slot,
  home_user_id, away_user_id)
values (md5('cb-f-sf')::uuid, md5('cb-cup')::uuid, md5('cb-w-sf')::uuid,
        'knockout', 4, 1, md5('cb-user-1')::uuid, md5('cb-user-2')::uuid);

-- BOTH have submitted. The values are distinctive so a text search over the
-- whole payload cannot match them by accident.
insert into public.bonus_cup_penalty_numbers (competition_id, window_id, user_id, value, version)
values (md5('cb-cup')::uuid, md5('cb-w-sf')::uuid, md5('cb-user-1')::uuid, 37, 0),
       (md5('cb-cup')::uuid, md5('cb-w-sf')::uuid, md5('cb-user-2')::uuid, 84, 0);

-- ---------------------------------------------------------------------------
-- The entrant's own view.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('cb-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.cb_seen',
  public.get_season_cup_bracket(md5('cb-cup')::uuid)::text, true);

select is(
  (current_setting('test.cb_seen')::jsonb ->> 'entered')::boolean,
  true,
  'an entrant reads their own Championship');

select is(
  current_setting('test.cb_seen')::jsonb #>> '{format,kind}',
  'groups',
  'the format comes from the launch record rather than being inferred');

select is(
  (current_setting('test.cb_seen')::jsonb #>> '{format,produces_knockout}')::boolean,
  true,
  'and it states whether a knockout is coming at all');

select is(
  (current_setting('test.cb_seen')::jsonb #>> '{qualification,drawn}')::boolean,
  true,
  'qualification reports the bracket as drawn once knockout fixtures exist');

select is(
  (current_setting('test.cb_seen')::jsonb #>> '{qualification,your_seed}')::integer,
  1,
  'and names the caller''s own seed');

select is(
  current_setting('test.cb_seen')::jsonb #>> '{my_tie,opponent,display_name}',
  'Bracket 2',
  'the caller''s live tie names their opponent');

select is(
  current_setting('test.cb_seen')::jsonb #>> '{my_tie,window_label}',
  'Semi-finals',
  'and the round it belongs to, read from the window');

select is(
  current_setting('test.cb_seen')::jsonb #>> '{penalty_number,lane}',
  'odd',
  'the home side holds the ODD lane, which is section 8.3''s rule read rather than re-derived');

select is(
  (current_setting('test.cb_seen')::jsonb #>> '{penalty_number,submitted}')::boolean,
  true,
  'the caller''s own submission is reported');

select is(
  (current_setting('test.cb_seen')::jsonb #>> '{penalty_number,value}')::integer,
  37,
  'with the caller''s own value');

-- THE ASSERTION THIS FILE IS FOR. Against the WHOLE payload, not the field.
-- `'%: 84%'` rather than `'%84%'`. A UUID is hexadecimal, so a bare two-digit
-- search matches one by accident roughly half the time and the assertion would
-- fail against a correct implementation. `jsonb::text` renders a NUMBER as
-- `"key": 84` and every uuid and timestamp as a QUOTED string, so the colon,
-- space and unquoted digits together match a real value and nothing else. No
-- legitimate number in this payload is 84: the seeds are 1-4, the round size 4,
-- the slot 1, the window sequence 21 and the span 20.
select ok(
  current_setting('test.cb_seen') not like '%: 84%',
  'the opponent''s Penalty Number appears NOWHERE in the payload');

-- And nothing about whether they submitted, which is a signal the tournament
-- read does not give either.
select ok(
  current_setting('test.cb_seen') not like '%opponent_submitted%'
    and current_setting('test.cb_seen') not like '%their_penalty%',
  'and neither does the fact of their submission');

select is(
  jsonb_array_length(current_setting('test.cb_seen')::jsonb -> 'bracket'),
  1,
  'the bracket is visible to an entrant');

select is(
  jsonb_array_length(current_setting('test.cb_seen')::jsonb -> 'my_ties'),
  1,
  'and the caller''s own progression is listed');

-- ---------------------------------------------------------------------------
-- The other side of the same tie sees their own number and not the first's.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('cb-user-2')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select ok(
  (public.get_season_cup_bracket(md5('cb-cup')::uuid) #>> '{penalty_number,value}')::integer = 84
    and public.get_season_cup_bracket(md5('cb-cup')::uuid)::text not like '%: 37%',
  'the away side sees their own value and not the home side''s');

-- ---------------------------------------------------------------------------
-- CONTRACT 205: the read survives a split.
--
-- Contract 102 keyed `bonus_cup_members` `(competition_id, user_id,
-- phase_kind)` so ONE ENTRANT MAY HOLD TWO ROWS, and contract 124's split
-- transition inserts the second without deleting the first. Contract 193's
-- `your_seed` was a SCALAR subquery filtered by competition and user only, so
-- from that moment it matched two rows and raised
--
--     more than one row returned by a subquery used as an expression
--
-- which failed the WHOLE read — format, qualification, my_tie, penalty_number,
-- my_ties, bracket and champion — for every entrant in the competition.
--
-- So the seeding below is the defect's own precondition: user 1 keeps the
-- `initial` row asserted above and gains the `split` row a real split would
-- give them. Before contract 205 the next three assertions do not fail, they
-- ERROR.
--
-- Note the split row carries no seed, no group_position and no qualified_as:
-- `bonus_cup_members_split_metadata_empty` forbids all three, which is exactly
-- why `initial` is the phase the lookup must name rather than merely a
-- convenient tie-break.
-- ---------------------------------------------------------------------------

reset role;

-- `ordinal` 2 because the original `unique (competition_id, ordinal)` survives
-- contract 102 untouched, and `parent_group_id` because
-- `bonus_cup_groups_parent_shape` requires a split group to name the initial
-- group whose table it divided.
insert into public.bonus_cup_groups
  (id, competition_id, ordinal, size, phase_kind, parent_group_id)
values (md5('cb-grp-split')::uuid, md5('cb-cup')::uuid, 2, 4, 'split',
        md5('cb-grp')::uuid);

insert into public.bonus_cup_members
  (competition_id, group_id, user_id, draw_number, phase_kind)
select md5('cb-cup')::uuid, md5('cb-grp-split')::uuid, md5('cb-user-' || n)::uuid, n, 'split'
from generate_series(1, 4) as n;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('cb-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.cb_split',
  public.get_season_cup_bracket(md5('cb-cup')::uuid)::text, true);

select is(
  (current_setting('test.cb_split')::jsonb #>> '{qualification,your_seed}')::integer,
  1,
  'a split entrant still reads the seed from their INITIAL membership');

select is(
  (current_setting('test.cb_split')::jsonb #>> '{qualification,you_qualified}')::boolean,
  true,
  'and still reads as qualified, because a split row carries no seed to confuse it');

-- The read as a whole survives, which is the part that was actually broken:
-- the exception took every other field with it.
select is(
  current_setting('test.cb_split')::jsonb #>> '{my_tie,opponent,display_name}',
  'Bracket 2',
  'and the rest of the payload is unharmed by the second membership row');

reset role;

-- ---------------------------------------------------------------------------
-- A stranger learns nothing, including whether the competition exists.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('cb-user-5')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  public.get_season_cup_bracket(md5('cb-cup')::uuid)
    - 'competition_id',
  jsonb_build_object('entered', false),
  'a non-entrant is told only that they are not in it, exactly as an unknown id is');

reset role;

select * from finish();

rollback;
