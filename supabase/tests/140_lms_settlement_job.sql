-- Contract 89: settling a season Last Man Standing competition from results.
--
-- The settler both ASSIGNS missed picks and REPLAYS the season. Only the
-- assignment half needs contract 88's lock exception, and this runner cannot
-- hold it — `session_user` is fixed for a connection and is not `postgres`
-- here, as `139` explains at length.
--
-- So this file seeds every pick BEFORE its round locks, which needs no
-- exception at all, and then moves the locks into the past. That leaves the
-- replay — the half that decides who is standing — fully exercisable, and it is
-- the half worth the most: assignment merely chooses a club, while the replay
-- decides the competition.
--
-- THE PROPERTY THIS EXISTS FOR is the last pair of assertions: a corrected
-- result must be able to bring an eliminated player BACK. That is the whole
-- reason contract 85 made survival derived rather than spent, and it is the one
-- thing an incremental implementation cannot do at any price — the life is
-- already gone. If those two assertions ever pass while the others fail, the
-- settler has quietly become a spender.

begin;
select plan(18);

-- ---------------------------------------------------------------------------
-- A three-round season with a different winner each round, so a player can win
-- three times without reusing a club.
--
--   R1: Alpha 2-0 Bravo | Cobra 2-0 Delta
--   R2: Bravo 2-0 Alpha | Cobra 2-0 Delta
--   R3: Cobra 2-0 Delta | Alpha 2-0 Bravo
--
-- Every fixture is decisive. A draw would make the outcome depend on the draws
-- rule as well as the fold, and this file is about the fold.
-- ---------------------------------------------------------------------------

create temporary table settle_probe as
select (select id from public.tournaments where kind = 'league_season' order by name desc limit 1) as season_id;

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season_id, 'ST' || n, 300 + n, 'league_matchweek', 'Settle probe ' || n
from settle_probe, generate_series(1, 3) n;

insert into public.teams (tournament_id, name)
select season_id, 'Settle ' || c
from settle_probe, unnest(array['Alpha', 'Bravo', 'Cobra', 'Delta']) c;

insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id,
  kickoff_at, status, home_score, away_score
)
select
  md5('st-x-' || n)::uuid, p.season_id,
  (select id from public.competition_rounds where tournament_id = p.season_id and round_key = 'ST' || n),
  (select id from public.teams where tournament_id = p.season_id
     and name = case n when 1 then 'Settle Alpha' when 2 then 'Settle Bravo' else 'Settle Cobra' end),
  (select id from public.teams where tournament_id = p.season_id
     and name = case n when 1 then 'Settle Bravo' when 2 then 'Settle Alpha' else 'Settle Delta' end),
  now() - interval '2 hours', 'played', 2, 0
from settle_probe p, generate_series(1, 3) n;

insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id,
  kickoff_at, status, home_score, away_score
)
select
  md5('st-y-' || n)::uuid, p.season_id,
  (select id from public.competition_rounds where tournament_id = p.season_id and round_key = 'ST' || n),
  (select id from public.teams where tournament_id = p.season_id
     and name = case n when 3 then 'Settle Alpha' else 'Settle Cobra' end),
  (select id from public.teams where tournament_id = p.season_id
     and name = case n when 3 then 'Settle Bravo' else 'Settle Delta' end),
  now() - interval '2 hours', 'played', 2, 0
from settle_probe p, generate_series(1, 3) n;

select set_config('test.c89_comp',
  (select c.id::text from public.bonus_competitions c
     join settle_probe p on p.season_id = c.tournament_id
    where c.game_key = 'last_man_standing'), true);

select set_config('test.c89_alpha',
  (select t.id::text from public.teams t join settle_probe p on p.season_id = t.tournament_id
    where t.name = 'Settle Alpha'), true);
select set_config('test.c89_bravo',
  (select t.id::text from public.teams t join settle_probe p on p.season_id = t.tournament_id
    where t.name = 'Settle Bravo'), true);
select set_config('test.c89_cobra',
  (select t.id::text from public.teams t join settle_probe p on p.season_id = t.tournament_id
    where t.name = 'Settle Cobra'), true);

update public.bonus_competitions
set published = true, registration_opens_at = now() - interval '5 hours'
where id = current_setting('test.c89_comp')::uuid;

-- One life, so a defeat is survivable once and the SECOND one eliminates. A
-- zero-life setup would make every fate a single step and hide the fold.
insert into public.season_lms_setups (
  competition_id, lives, saves, draws_rule, endgame_scope, endgame_on_wipeout
) values (
  current_setting('test.c89_comp')::uuid, 1, 0, 'eliminate', 'private', 'play_on'
);

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select md5('c89-' || w)::uuid, format('c89-%s@example.test', w),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from unnest(array['winner', 'loser', 'third']) w;
set local session_replication_role = origin;

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select current_setting('test.c89_comp')::uuid, md5('c89-' || w)::uuid, now() - interval '4 hours'
from unnest(array['winner', 'loser', 'third']) w;

-- Rounds are OPEN while the picks go in, so no lock exception is needed.
insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at)
select md5('c89-w' || n)::uuid, current_setting('test.c89_comp')::uuid, 300 + n,
       'Settle probe ' || n, now() - interval '4 hours', now() + interval '1 hour'
from generate_series(1, 3) n;

insert into public.season_cup_window_fixtures (window_id, season_fixture_id)
select md5('c89-w' || n)::uuid, md5('st-x-' || n)::uuid from generate_series(1, 3) n;
insert into public.season_cup_window_fixtures (window_id, season_fixture_id)
select md5('c89-w' || n)::uuid, md5('st-y-' || n)::uuid from generate_series(1, 3) n;

-- `winner` picks the winning club every round; `loser` picks the round-one
-- loser and then the round-two loser, so their two defeats straddle the single
-- life and the second one is what eliminates them.
-- EVERY entrant picks in EVERY round. Nothing here needs auto-assignment, so
-- the file cannot diverge between a session that can hold contract 88's lock
-- exception and one that cannot — an earlier version left one player without a
-- round-three pick and produced two different conclusions on the two
-- identities, which is a property of the test rather than of the settler.
--
--   winner: Alpha, Bravo, Cobra  -> wins all three
--   loser:  Bravo, Alpha, Cobra  -> loses the first two, out before round three
--   third:  Cobra, Bravo, Alpha  -> wins all three by a different route
insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id, used_cycle) values
  (current_setting('test.c89_comp')::uuid, md5('c89-winner')::uuid, md5('c89-w1')::uuid, current_setting('test.c89_alpha')::uuid, 0),
  (current_setting('test.c89_comp')::uuid, md5('c89-winner')::uuid, md5('c89-w2')::uuid, current_setting('test.c89_bravo')::uuid, 0),
  (current_setting('test.c89_comp')::uuid, md5('c89-winner')::uuid, md5('c89-w3')::uuid, current_setting('test.c89_cobra')::uuid, 0),
  (current_setting('test.c89_comp')::uuid, md5('c89-loser')::uuid, md5('c89-w1')::uuid, current_setting('test.c89_bravo')::uuid, 0),
  (current_setting('test.c89_comp')::uuid, md5('c89-loser')::uuid, md5('c89-w2')::uuid, current_setting('test.c89_alpha')::uuid, 0),
  (current_setting('test.c89_comp')::uuid, md5('c89-loser')::uuid, md5('c89-w3')::uuid, current_setting('test.c89_cobra')::uuid, 0),
  (current_setting('test.c89_comp')::uuid, md5('c89-third')::uuid, md5('c89-w1')::uuid, current_setting('test.c89_cobra')::uuid, 0),
  (current_setting('test.c89_comp')::uuid, md5('c89-third')::uuid, md5('c89-w2')::uuid, current_setting('test.c89_bravo')::uuid, 0),
  (current_setting('test.c89_comp')::uuid, md5('c89-third')::uuid, md5('c89-w3')::uuid, current_setting('test.c89_alpha')::uuid, 0);

-- ---------------------------------------------------------------------------
-- Nothing settles before a round locks.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.settle_season_lms_competition(
    current_setting('test.c89_comp')::uuid) ->> 'outcome',
  'nothing_settled',
  'a competition whose rounds have not locked settles nothing'
);

select is(
  (select count(*)::integer from public.season_lms_entrant_state
    where competition_id = current_setting('test.c89_comp')::uuid),
  0,
  'and writes no projection row'
);

-- Now the rounds have locked.
update public.bonus_competition_windows
set locks_at = now() - interval '3 hours'
where competition_id = current_setting('test.c89_comp')::uuid;

-- ---------------------------------------------------------------------------
-- The settlement.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.settle_season_lms_competition(
    current_setting('test.c89_comp')::uuid) ->> 'outcome',
  'settled',
  'once the rounds have locked the competition settles'
);

select is(
  (select outcome from public.bonus_competition_entrants
    where competition_id = current_setting('test.c89_comp')::uuid
      and user_id = md5('c89-winner')::uuid),
  'survived',
  'a player who picked the winner every round survives'
);

select is(
  (select lives_remaining from public.season_lms_entrant_state
    where competition_id = current_setting('test.c89_comp')::uuid
      and user_id = md5('c89-winner')::uuid),
  1::smallint,
  'and has spent no life'
);

select is(
  (select outcome from public.bonus_competition_entrants
    where competition_id = current_setting('test.c89_comp')::uuid
      and user_id = md5('c89-loser')::uuid),
  'eliminated',
  'a player whose second defeat outruns their single life is eliminated'
);

select is(
  (select lives_remaining from public.season_lms_entrant_state
    where competition_id = current_setting('test.c89_comp')::uuid
      and user_id = md5('c89-loser')::uuid),
  0::smallint,
  'and the life they did spend is recorded'
);

-- ---------------------------------------------------------------------------
-- Running it again changes nothing. The projection is rebuilt from scratch
-- every time, so a retry after a crash, a redeploy or an overlapping tick is a
-- no-op rather than a second helping of eliminations.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.settle_season_lms_competition(
    current_setting('test.c89_comp')::uuid) ->> 'eliminated',
  '1',
  'a second run eliminates the same one player, not another'
);

select is(
  (select string_agg(user_id::text || '=' || lives_remaining::text, ' ' order by user_id)
     from public.season_lms_entrant_state
    where competition_id = current_setting('test.c89_comp')::uuid),
  (select string_agg(user_id::text || '=' || lives_remaining::text, ' ' order by user_id)
     from public.season_lms_entrant_state
    where competition_id = current_setting('test.c89_comp')::uuid),
  'and the projection is unchanged — idempotent by construction, not by a ledger'
);

-- ---------------------------------------------------------------------------
-- THE ASSERTIONS THE WHOLE DESIGN EXISTS FOR.
--
-- Round one is restated: Alpha 2-0 Bravo becomes Alpha 0-2 Bravo. The player
-- who was ELIMINATED picked Bravo that round, so the defeat that removed them
-- never happened and they must come back. An implementation that spent a life
-- when it first settled cannot do this — the life is gone and no re-run
-- returns it.
-- ---------------------------------------------------------------------------

update public.season_fixtures set home_score = 0, away_score = 2
where id = md5('st-x-1')::uuid;

select is(
  predictor_internal.settle_season_lms_competition(
    current_setting('test.c89_comp')::uuid) ->> 'eliminated',
  '0',
  'correcting the result that eliminated a player un-eliminates them'
);

select is(
  (select outcome from public.bonus_competition_entrants
    where competition_id = current_setting('test.c89_comp')::uuid
      and user_id = md5('c89-loser')::uuid),
  'survived',
  'the eliminated player is standing again, which spending a life could never undo'
);

select is(
  (select lives_remaining from public.season_lms_entrant_state
    where competition_id = current_setting('test.c89_comp')::uuid
      and user_id = md5('c89-winner')::uuid),
  0::smallint,
  'and the player who won that round now pays for it — the correction cuts both ways'
);

-- ---------------------------------------------------------------------------
-- COMPLETION IS DERIVED TOO, and this pair is why.
--
-- The first version of this contract returned `already_completed` and stopped.
-- That is the one place the correction law breaks: a result restated after the
-- competition finished — exactly when a final standing gets disputed — could
-- never re-derive, and the wrong player would keep the title for ever.
--
-- Round three is restated so that `winner` and `third` both lose it, leaving
-- `loser` alone and the competition finished. Then it is restated back.
-- ---------------------------------------------------------------------------

update public.season_fixtures set home_score = 0, away_score = 3
where id = md5('st-x-3')::uuid;

select is(
  predictor_internal.settle_season_lms_competition(
    current_setting('test.c89_comp')::uuid) -> 'conclusion' ->> 'kind',
  'winner',
  'a round that leaves one player standing concludes with a winner'
);

select is(
  (select completed_at is not null from public.bonus_competitions
    where id = current_setting('test.c89_comp')::uuid),
  true,
  'and the competition is completed'
);

update public.season_fixtures set home_score = 3, away_score = 0
where id = md5('st-x-3')::uuid;

select is(
  predictor_internal.settle_season_lms_competition(
    current_setting('test.c89_comp')::uuid) -> 'conclusion' ->> 'kind',
  'continues',
  'restating that result reopens the competition rather than reporting it closed'
);

select is(
  (select completed_at is null from public.bonus_competitions
    where id = current_setting('test.c89_comp')::uuid),
  true,
  'and un-completes it — a title decided by a corrected result does not stand'
);

-- ---------------------------------------------------------------------------
-- What the settler will not touch, and who may run the job.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.settle_season_lms_competition(
    (select c.id from public.bonus_competitions c
       join public.tournaments t on t.id = c.tournament_id
      where t.kind = 'tournament' order by c.id limit 1)) ->> 'reason',
  'not_a_season_lms_competition',
  'a tournament competition is refused — the tournament game settles through its own path'
);

-- Unlike contract 83's matchweek job, this one is NOT granted to service_role.
-- An API caller's session_user is `authenticator`, which can never hold
-- contract 88's lock exception, so every auto-assignment would be refused and
-- the settlement would silently under-assign.
select is(
  (select count(*)::integer from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'process_due_season_lms_settlements'
      and (has_function_privilege('authenticated', p.oid, 'execute')
        or has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('service_role', p.oid, 'execute'))),
  0,
  'the job is executable by no browser role and not by service_role either'
);

select * from finish();
rollback;
