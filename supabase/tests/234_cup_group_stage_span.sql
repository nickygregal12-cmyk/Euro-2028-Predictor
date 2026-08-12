-- Contract 186: a season Predictor Championship records where its group stage
-- ends.
--
-- THE ASSERTIONS THIS FILE EXISTS FOR are the three that decide whether the
-- record is worth having at all:
--
--   * the span the launcher stores equals the round count the format planned.
--     If those two can disagree the record is a second answer to a question the
--     format already answers, which is the drift contract 169 was written to
--     correct;
--   * appending a window PAST the group stage leaves the recorded span alone.
--     That is the whole point — `max(sequence)` stops being the group-stage span
--     the moment contract 124's split or CUP-002's knockout windows exist, and
--     a stored fact is the only thing that survives it;
--   * the record cannot be updated. Predictions are made against fixtures placed
--     inside this span, so a span that can be edited afterwards can
--     retrospectively move a fixture out of the group stage.

begin;

select plan(21);

-- ---------------------------------------------------------------------------
-- The relation itself
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'bonus_cup_launches'
      and grantee in ('PUBLIC', 'anon', 'authenticated')),
  0,
  'no browser role holds any grant on the launch record'
);

select is(
  (select relrowsecurity from pg_catalog.pg_class
    where oid = 'public.bonus_cup_launches'::regclass),
  true,
  'and row-level security is enabled on it'
);

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_schema = 'predictor_internal'
      and routine_name = 'cup_group_stage_last_sequence'
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')),
  0,
  'and nothing outside the server may ask where the group stage ends'
);

-- ---------------------------------------------------------------------------
-- A single-group launch — contract 111's shape
-- ---------------------------------------------------------------------------
--
-- Twelve entrants over twenty-four matchweeks, which is 162's fixture and its
-- reasoning: a twelve-entrant field needs eleven rounds per meeting and
-- `select_season_cup_format` returns `single_group` only when two meetings fit,
-- so twenty-two is the floor and the two spare matchweeks prove the calendar is
-- not simply consumed whole.

select set_config('test.gs_pl',
  (select t.id::text from public.tournaments t where t.name = 'Premier League 2026/27'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.gs_pl')::uuid, 'Span Rovers'),
  (current_setting('test.gs_pl')::uuid, 'Span United');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select current_setting('test.gs_pl')::uuid, format('gs-mw%s', n), n,
       'league_matchweek', format('Matchweek %s', n)
from generate_series(1, 24) as n;

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status
)
select round.tournament_id, round.id,
  (select team.id from public.teams team
    where team.tournament_id = round.tournament_id and team.name = 'Span Rovers'),
  (select team.id from public.teams team
    where team.tournament_id = round.tournament_id and team.name = 'Span United'),
  now() + (round.ordinal * interval '7 days'), 'scheduled'
from public.competition_rounds round
where round.tournament_id = current_setting('test.gs_pl')::uuid
  and round.kind = 'league_matchweek';

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select md5('gs-user-' || n)::uuid, format('gs-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 12) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('gs-user-' || n)::uuid, format('Gs Player %s', n), now()
from generate_series(1, 12) as n;

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at,
  name, owner_id, invite_code
) values (
  md5('gs-private')::uuid, current_setting('test.gs_pl')::uuid,
  'predictor_cup', true, 'active', true, 'private', now() - interval '2 days',
  'Span Private Twelve', md5('gs-user-1')::uuid, 'GSPRIV'
);

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select md5('gs-private')::uuid, md5('gs-user-' || n)::uuid, now() - interval '1 day'
from generate_series(1, 12) as n;

select is(
  predictor_internal.cup_group_stage_last_sequence(md5('gs-private')::uuid),
  null,
  'before the launch the span is null rather than zero, so a caller must refuse rather than arithmetic with it'
);

select set_config('test.gs_result',
  predictor_internal.launch_season_cup(md5('gs-private')::uuid)::text, true);

select is(
  current_setting('test.gs_result')::jsonb ->> 'outcome', 'launched',
  'the private twelve-entrant Championship launches'
);

-- THE FIRST ASSERTION THIS FILE EXISTS FOR.
select is(
  predictor_internal.cup_group_stage_last_sequence(md5('gs-private')::uuid),
  (current_setting('test.gs_result')::jsonb ->> 'leagueRounds')::integer,
  'the recorded span equals the round count the format planned — two answers that could disagree would be worse than none'
);

select is(
  predictor_internal.cup_group_stage_last_sequence(md5('gs-private')::uuid),
  22,
  'and that is twenty-two, a twelve-entrant round-robin played twice'
);

select is(
  (select format_kind from public.bonus_cup_launches
    where competition_id = md5('gs-private')::uuid),
  'single_group',
  'the shape is recorded beside the span, because a single-group competition finishes with contract 124''s split and must never be bracketed'
);

-- The span is measured from the windows, so it must agree with them at launch.
select is(
  predictor_internal.cup_group_stage_last_sequence(md5('gs-private')::uuid),
  (select max(sequence)::integer from public.bonus_competition_windows
    where competition_id = md5('gs-private')::uuid),
  'and it agrees with the last window that actually exists'
);

-- THE SECOND ASSERTION THIS FILE EXISTS FOR.
--
-- A window past the group stage stands for both of the things that break the
-- derivation: contract 124's split appends windows and further `stage = 'group'`
-- fixtures, and CUP-002 will append knockout windows. Either makes
-- `max(sequence)` the wrong answer, and the stored span is what survives.
insert into public.bonus_competition_windows (
  competition_id, sequence, label, opens_at, locks_at
) values (
  md5('gs-private')::uuid, 23, 'Beyond the group stage',
  now() + interval '200 days', now() + interval '201 days'
);

select is(
  (select max(sequence)::integer from public.bonus_competition_windows
    where competition_id = md5('gs-private')::uuid),
  23,
  'a window appended past the group stage moves max(sequence)'
);

select is(
  predictor_internal.cup_group_stage_last_sequence(md5('gs-private')::uuid),
  22,
  'and leaves the recorded span exactly where it was — which is the only reason this table exists'
);

-- THE THIRD ASSERTION THIS FILE EXISTS FOR.
select throws_ok(
  format($$update public.bonus_cup_launches set group_stage_last_sequence = 23
             where competition_id = %L::uuid$$, md5('gs-private')::uuid),
  '23514',
  null,
  'the record is immutable: a span edited after fixtures were placed inside it would move a fixture out of the group stage retrospectively'
);

select is(
  predictor_internal.cup_group_stage_last_sequence(md5('gs-private')::uuid),
  22,
  'and the refused update changed nothing'
);

-- A relaunch is already refused; the record must not gain a second row either.
select is(
  predictor_internal.launch_season_cup(md5('gs-private')::uuid) ->> 'outcome',
  'already_launched',
  'a second launch refuses'
);

select is(
  (select count(*)::integer from public.bonus_cup_launches
    where competition_id = md5('gs-private')::uuid),
  1,
  'and leaves exactly one launch record'
);

-- The property the backfill rests on: what the launcher stores and what the
-- audit recorded are the same number. The backfill reads the audit for
-- competitions launched before this contract, so if these two could drift the
-- backfilled competitions would carry a different span from the new ones.
select is(
  predictor_internal.cup_group_stage_last_sequence(md5('gs-private')::uuid),
  (select (audit.detail ->> 'leagueRounds')::integer
     from public.bonus_competition_audit audit
    where audit.competition_id = md5('gs-private')::uuid
      and audit.action = 'championship_launched'),
  'the stored span and the audit the backfill reads carry the same number'
);

-- ---------------------------------------------------------------------------
-- A multi-group launch — contract 166's shape, and the other spelling
-- ---------------------------------------------------------------------------
--
-- The two launchers record their plan under DIFFERENT audit keys —
-- `leagueRounds` and `roundsNeeded` — which is the reason the span needed one
-- typed home rather than a reader that knows both spellings.

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C185 Multi Group', 2052, t.competition_id, 'span-multi-group', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.gs_mg',
  (select id::text from public.tournaments where season_key = 'span-multi-group'), true);

insert into public.teams (id, tournament_id, name) values
  (md5('gs-mg-t1')::uuid, current_setting('test.gs_mg')::uuid, 'Span MG Rovers'),
  (md5('gs-mg-t2')::uuid, current_setting('test.gs_mg')::uuid, 'Span MG United');

insert into public.competition_rounds (id, tournament_id, round_key, ordinal, kind, label)
select md5('gs-mg-r' || n)::uuid, current_setting('test.gs_mg')::uuid,
       'gs-mg-mw' || n, n, 'league_matchweek', 'Matchweek ' || n
  from generate_series(1, 40) as n;

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.gs_mg')::uuid, md5('gs-mg-r' || n)::uuid,
       md5('gs-mg-t1')::uuid, md5('gs-mg-t2')::uuid,
       now() + (n || ' days')::interval, 'scheduled'
  from generate_series(1, 40) as n;

insert into public.bonus_competitions (
  id, tournament_id, game_key, name, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
values (md5('gs-mg-cup')::uuid, current_setting('test.gs_mg')::uuid, 'predictor_cup',
        null, true, 'active', true, 'public', now() - interval '30 days');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('gs-mg-u' || n)::uuid, format('gs-mg-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from generate_series(1, 25) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('gs-mg-u' || n)::uuid, 'Span MG Player ' || n, now() from generate_series(1, 25) as n;

insert into public.bonus_competition_entrants (competition_id, user_id)
select md5('gs-mg-cup')::uuid, md5('gs-mg-u' || n)::uuid from generate_series(1, 25) as n;

select set_config('test.gs_mg_result',
  predictor_internal.launch_season_cup_groups(md5('gs-mg-cup')::uuid)::text, true);

select is(
  current_setting('test.gs_mg_result')::jsonb ->> 'outcome', 'launched',
  'the twenty-five entrant field is drawn into groups'
);

select is(
  predictor_internal.cup_group_stage_last_sequence(md5('gs-mg-cup')::uuid),
  (current_setting('test.gs_mg_result')::jsonb ->> 'roundsNeeded')::integer,
  'and the multi-group launcher records the span its OWN audit key names, which is not the single-group launcher''s key'
);

select is(
  predictor_internal.cup_group_stage_last_sequence(md5('gs-mg-cup')::uuid),
  13,
  'thirteen rounds, which is what the largest of the two groups needs'
);

select is(
  (select format_kind from public.bonus_cup_launches
    where competition_id = md5('gs-mg-cup')::uuid),
  'groups',
  'recorded as the bracketing shape rather than the splitting one'
);

-- ---------------------------------------------------------------------------
-- One reader, and one only
-- ---------------------------------------------------------------------------
--
-- This assertion originally required the qualification gate to still carry
-- `sequence between 1 and 3`, which was contract 186's own "I am the
-- prerequisite and not CUP-002" property. Contract 187 legitimately removes that
-- expression, so the assertion is REPLACED rather than deleted: the migration's
-- own `do` block still made that check at apply time, which is where a
-- point-in-time claim belongs, and a suite runs against the head schema where it
-- can no longer be true.
--
-- What survives at head, and is the property worth guarding, is that
-- `bonus_cup_launches` has exactly one reader. Two functions reading the launch
-- record separately is how the span comes to be spelled two ways, which is the
-- whole reason it stopped being read out of the audit log's two jsonb keys.

select is(
  (select pg_catalog.string_agg(space.nspname || '.' || proc.proname, ', '
            order by proc.proname)
     from pg_catalog.pg_proc proc
     join pg_catalog.pg_namespace space on space.oid = proc.pronamespace
    where space.nspname in ('public', 'predictor_internal')
      and proc.prosrc like '%bonus_cup_launches%'
      and proc.proname <> 'cup_group_stage_last_sequence'),
  'predictor_internal.launch_season_cup, predictor_internal.launch_season_cup_groups',
  'the launch record has exactly one reader and exactly two writers, and they are the two launchers'
);

select finish();

rollback;
