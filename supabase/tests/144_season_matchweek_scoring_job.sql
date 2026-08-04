-- Contract 93: the season Main Predictor scoring job.
--
-- The first thing in this repository that writes a season points total. Its
-- rules are all borrowed — contract 70 says what a matchweek is worth, contract
-- 91 says whether it may be scored yet — so what is worth testing is the
-- JOINING, and specifically the three places where a defensible-looking choice
-- produces a leaderboard that is wrong in a way nobody reports as a bug:
--
--   1. WHO is scored. The season has rolling entry. Scoring every entry gives a
--      matchweek-20 joiner nineteen zero rows, and because `standings.ts`
--      counts rows as matchweeks played, they read as having played a full
--      season. Every points total stays correct while every average is wrong.
--
--   2. WHETHER a matchweek counts at all. An empty round and an all-void round
--      both "settle" trivially, with a denominator of zero. Writing rows for
--      them adds matchweeks-played that nobody played.
--
--   3. WHETHER the job runs backwards. Results get corrected, and a matchweek
--      that STOPS being settled has to lose its rows. A job that only ever adds
--      leaves a stale total standing, and standings would count a matchweek the
--      data no longer says was played.
--
-- The `fixtures_scored` assertion is the one to keep: it stores contract 91's
-- matches-played denominator, and that is equal to the count of scoreable
-- fixtures only as a CONSEQUENCE of the void-and-carried exclusion rule. The
-- assertions below pin the consequence, so a change to that rule fails here
-- instead of quietly reshaping every season table.

begin;
select plan(24);

-- ---------------------------------------------------------------------------
-- One season, three matchweeks, four clubs, two players.
-- ---------------------------------------------------------------------------

create temporary table job_probe as
select (select id from public.tournaments where kind = 'league_season' order by name limit 1) as season_id,
       (select id from public.tournaments where kind = 'tournament' order by name limit 1) as tournament_id;

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season_id, 'SJ' || n, 499 + n, 'league_matchweek', 'Scoring job ' || n
from job_probe, generate_series(1, 6) n;

insert into public.teams (tournament_id, name)
select season_id, 'Scoring Job FC ' || n from job_probe, generate_series(1, 6) n;

select set_config('test.c93_season', (select season_id::text from job_probe), true);
select set_config('test.c93_tournament', (select tournament_id::text from job_probe), true);
select set_config('test.c93_mw' || n,
  (select r.id::text from public.competition_rounds r join job_probe p on p.season_id = r.tournament_id
    where r.round_key = 'SJ' || n), true)
from generate_series(1, 6) n;
select set_config('test.c93_club' || n,
  (select t.id::text from public.teams t join job_probe p on p.season_id = t.tournament_id
    where t.name = 'Scoring Job FC ' || n), true)
from generate_series(1, 6) n;

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('c93-' || n)::uuid, 'c93-' || n || '@example.test',
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 4) n;
set local session_replication_role = origin;

insert into public.entries (tournament_id, user_id)
select season_id, md5('c93-' || n)::uuid from job_probe, generate_series(1, 4) n;

select set_config('test.c93_entry' || n,
  (select e.id::text from public.entries e join job_probe p on p.season_id = e.tournament_id
    where e.user_id = md5('c93-' || n)::uuid), true)
from generate_series(1, 4) n;

-- Every fixture starts scheduled with a FUTURE kickoff, because a matchweek
-- whose kickoffs are unconfirmed is locked and refuses predictions. The results
-- are applied further down, after the cards are in — which is also the real
-- order of events.
insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, status, kickoff_at)
values
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_mw1')::uuid,
   current_setting('test.c93_club1')::uuid, current_setting('test.c93_club2')::uuid,
   'scheduled', now() + interval '30 days'),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_mw1')::uuid,
   current_setting('test.c93_club3')::uuid, current_setting('test.c93_club4')::uuid,
   'scheduled', now() + interval '30 days'),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_mw2')::uuid,
   current_setting('test.c93_club1')::uuid, current_setting('test.c93_club3')::uuid,
   'scheduled', now() + interval '37 days'),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_mw2')::uuid,
   current_setting('test.c93_club2')::uuid, current_setting('test.c93_club4')::uuid,
   'scheduled', now() + interval '37 days'),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_mw2')::uuid,
   current_setting('test.c93_club5')::uuid, current_setting('test.c93_club6')::uuid,
   'scheduled', now() + interval '37 days'),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_mw3')::uuid,
   current_setting('test.c93_club1')::uuid, current_setting('test.c93_club4')::uuid,
   'scheduled', now() + interval '44 days'),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_mw3')::uuid,
   current_setting('test.c93_club5')::uuid, current_setting('test.c93_club6')::uuid,
   'scheduled', now() + interval '44 days'),
  -- Matchweek 5: one result and one fixture that will be POSTPONED. Matchweek 4
  -- is left with no fixtures at all, deliberately.
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_mw5')::uuid,
   current_setting('test.c93_club1')::uuid, current_setting('test.c93_club2')::uuid,
   'scheduled', now() + interval '51 days'),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_mw5')::uuid,
   current_setting('test.c93_club3')::uuid, current_setting('test.c93_club4')::uuid,
   'scheduled', now() + interval '51 days'),
  -- Matchweek 6: every fixture will be voided.
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_mw6')::uuid,
   current_setting('test.c93_club1')::uuid, current_setting('test.c93_club3')::uuid,
   'scheduled', now() + interval '58 days'),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_mw6')::uuid,
   current_setting('test.c93_club2')::uuid, current_setting('test.c93_club4')::uuid,
   'scheduled', now() + interval '58 days');

select set_config('test.c93_f1',
  (select f.id::text from public.season_fixtures f
    where f.competition_round_id = current_setting('test.c93_mw1')::uuid
      and f.home_team_id = current_setting('test.c93_club1')::uuid), true);
select set_config('test.c93_f2',
  (select f.id::text from public.season_fixtures f
    where f.competition_round_id = current_setting('test.c93_mw1')::uuid
      and f.home_team_id = current_setting('test.c93_club3')::uuid), true);
select set_config('test.c93_f3',
  (select f.id::text from public.season_fixtures f
    where f.competition_round_id = current_setting('test.c93_mw2')::uuid
      and f.home_team_id = current_setting('test.c93_club1')::uuid), true);
select set_config('test.c93_f4',
  (select f.id::text from public.season_fixtures f
    where f.competition_round_id = current_setting('test.c93_mw2')::uuid
      and f.home_team_id = current_setting('test.c93_club2')::uuid), true);
select set_config('test.c93_f5',
  (select f.id::text from public.season_fixtures f
    where f.competition_round_id = current_setting('test.c93_mw2')::uuid
      and f.home_team_id = current_setting('test.c93_club5')::uuid), true);
select set_config('test.c93_replay',
  (select f.id::text from public.season_fixtures f
    where f.competition_round_id = current_setting('test.c93_mw3')::uuid
      and f.home_team_id = current_setting('test.c93_club5')::uuid), true);

-- Player 1: exact score on fixture 1 (5), correct result on fixture 2 (3) = 8.
-- Player 2: correct result on fixture 1 (3), nothing on fixture 2 = 3.
-- Player 3: predicts identically to player 1, but is NOT banked into matchweek
--           1 — the rolling-entry case.
insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
values
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry1')::uuid,
   current_setting('test.c93_f1')::uuid, 2, 1),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry1')::uuid,
   current_setting('test.c93_f2')::uuid, 1, 1),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry2')::uuid,
   current_setting('test.c93_f1')::uuid, 3, 1),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry3')::uuid,
   current_setting('test.c93_f1')::uuid, 2, 1),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry3')::uuid,
   current_setting('test.c93_f2')::uuid, 1, 1);

-- Matchweek 2: player 1 predicts the played fixture exactly, and jokers it.
insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
values
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry1')::uuid,
   current_setting('test.c93_f3')::uuid, 1, 0);
insert into public.season_matchweek_jokers (tournament_id, entry_id, competition_round_id)
values (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry1')::uuid,
        current_setting('test.c93_mw2')::uuid);

-- The lock ledger. Players 1 and 2 banked matchweek 1; player 3 was UNBANKED,
-- which is what rolling entry looks like in this table. Player 1 banked
-- matchweek 2; player 2's card was REFUSED there.
insert into public.season_matchweek_submission_outcomes (
  tournament_id, entry_id, competition_round_id, locks_at, outcome, attempted_at, submitted_at, auto_completed)
values
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry1')::uuid,
   current_setting('test.c93_mw1')::uuid, '2026-08-01T12:00:00Z', 'submitted', now(), now(), false),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry2')::uuid,
   current_setting('test.c93_mw1')::uuid, '2026-08-01T12:00:00Z', 'submitted', now(), now(), false),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry1')::uuid,
   current_setting('test.c93_mw2')::uuid, '2026-08-08T12:00:00Z', 'submitted', now(), now(), false);
insert into public.season_matchweek_submission_outcomes (
  tournament_id, entry_id, competition_round_id, locks_at, outcome, attempted_at, refusal_reason)
values
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry3')::uuid,
   current_setting('test.c93_mw1')::uuid, '2026-08-01T12:00:00Z', 'unbanked', now(), null),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry2')::uuid,
   current_setting('test.c93_mw2')::uuid, '2026-08-08T12:00:00Z', 'refused', now(), 'invalid_input'),
  -- Player 4's matchweek 2 was rescheduled. The lock ledger is keyed by
  -- `locks_at` precisely because "a rescheduled matchweek is a different lock",
  -- so the LATER verdict is the one that stood: they were submitted under the
  -- original lock and unbanked under the one that actually happened.
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry4')::uuid,
   current_setting('test.c93_mw2')::uuid, '2026-08-09T12:00:00Z', 'unbanked', now(), null);
insert into public.season_matchweek_submission_outcomes (
  tournament_id, entry_id, competition_round_id, locks_at, outcome, attempted_at, submitted_at, auto_completed)
values
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry4')::uuid,
   current_setting('test.c93_mw2')::uuid, '2026-08-08T12:00:00Z', 'submitted', now(), now(), false),
  -- Banked into matchweeks 5 and 6 as well. Without these the "writes nothing"
  -- assertions for those rounds would pass because nobody was eligible, not
  -- because the round failed to settle — which is how the postponed mutant
  -- survived a first draft of this file.
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry1')::uuid,
   current_setting('test.c93_mw5')::uuid, '2026-08-15T12:00:00Z', 'submitted', now(), now(), false),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry1')::uuid,
   current_setting('test.c93_mw6')::uuid, '2026-08-22T12:00:00Z', 'submitted', now(), now(), false),
  (current_setting('test.c93_season')::uuid, current_setting('test.c93_entry1')::uuid,
   current_setting('test.c93_mw4')::uuid, '2026-08-29T12:00:00Z', 'submitted', now(), now(), false);

-- ---------------------------------------------------------------------------
-- The results arrive. Matchweek 1 is played out; matchweek 2 has one result,
-- one fixture voided and — through contract 92's link — one abandoned fixture
-- carried into matchweek 3, which is itself still awaiting a result.
-- ---------------------------------------------------------------------------

update public.season_fixtures set status = 'played', home_score = 2, away_score = 1
 where id = current_setting('test.c93_f1')::uuid;
update public.season_fixtures set status = 'played', home_score = 0, away_score = 0
 where id = current_setting('test.c93_f2')::uuid;
update public.season_fixtures set status = 'played', home_score = 1, away_score = 0
 where id = current_setting('test.c93_f3')::uuid;
update public.season_fixtures set status = 'void'
 where id = current_setting('test.c93_f4')::uuid;
-- Abandoned, and its slot handed to the matchweek-3 fixture through contract
-- 92's link. Matchweek 2 therefore has THREE fixtures and a denominator of one.
update public.season_fixtures
   set status = 'abandoned', replay_fixture_id = current_setting('test.c93_replay')::uuid
 where id = current_setting('test.c93_f5')::uuid;

-- Matchweek 5: one played, one POSTPONED. ADR 0012 puts postponement between
-- rounds, so a fixture still carrying this round's id has not moved yet and is
-- still awaited — the matchweek must NOT settle.
update public.season_fixtures set status = 'played', home_score = 1, away_score = 1
 where competition_round_id = current_setting('test.c93_mw5')::uuid
   and home_team_id = current_setting('test.c93_club1')::uuid;
update public.season_fixtures set status = 'postponed'
 where competition_round_id = current_setting('test.c93_mw5')::uuid
   and home_team_id = current_setting('test.c93_club3')::uuid;

-- Matchweek 6: voided outright. It SETTLES — nothing is awaited — but its
-- matches-played denominator is zero, so no matchweek was played.
update public.season_fixtures set status = 'void'
 where competition_round_id = current_setting('test.c93_mw6')::uuid;

-- ---------------------------------------------------------------------------
-- The run.
-- ---------------------------------------------------------------------------

select set_config('test.c93_run',
  predictor_internal.settle_season_matchweek_scores(current_setting('test.c93_season')::uuid)::text,
  true);

select is(
  (current_setting('test.c93_run')::jsonb)->>'outcome',
  'settled',
  'the job runs and reports what it did'
);

select is(
  (select count(*)::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw1')::uuid),
  '2',
  'a settled matchweek writes one row per BANKED entry — the unbanked player gets none, because rolling entry means they were never in it'
);

select is(
  (select points::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw1')::uuid
      and entry_id = current_setting('test.c93_entry1')::uuid),
  '8',
  'and the total is contract 70''s: an exact score (5) plus a correct result (3)'
);

select is(
  (select points::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw1')::uuid
      and entry_id = current_setting('test.c93_entry2')::uuid),
  '3',
  'a correct result alone is 3, and an unpredicted fixture is a zero rather than an absence'
);

select is(
  (select count(*)::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw1')::uuid
      and entry_id = current_setting('test.c93_entry3')::uuid),
  '0',
  'the unbanked player has NO ROW, not a zero — absence is no matchweek, and standings counts rows as matchweeks played'
);

-- ---------------------------------------------------------------------------
-- The denominator, which is why contracts 91 and 92 came first.
-- ---------------------------------------------------------------------------

select is(
  (select fixtures_scored::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw1')::uuid
      and entry_id = current_setting('test.c93_entry1')::uuid),
  '2',
  'a matchweek of two played fixtures counts two towards matches played'
);

select is(
  (select fixtures_scored::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw2')::uuid
      and entry_id = current_setting('test.c93_entry1')::uuid),
  '1',
  'but void AND carried-to-replay both leave the denominator — matchweek 2 has three fixtures and counts one'
);

select is(
  (select count(*)::text from public.season_fixtures
    where competition_round_id = current_setting('test.c93_mw2')::uuid),
  '3',
  'and matchweek 2 really does hold three fixtures, so the figure above is an exclusion rather than a coincidence'
);

select is(
  (select points::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw2')::uuid
      and entry_id = current_setting('test.c93_entry1')::uuid),
  '10',
  'and the Joker doubles the matchweek total, once at the end — an exact 5 becomes 10'
);

select is(
  (select joker_applied::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw2')::uuid
      and entry_id = current_setting('test.c93_entry1')::uuid),
  'true',
  'and says so, so the doubling is explicable rather than an unexplained even number'
);

select is(
  (select count(*)::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw2')::uuid
      and entry_id = current_setting('test.c93_entry2')::uuid),
  '0',
  'a REFUSED card scores nothing — the lock declined to accept it, so its predictions are not points'
);

-- The stored denominator IS contract 91's matches-played figure, which equals
-- the scoreable count only because void and carried are both excluded. Pinned
-- so a change to that rule fails here rather than quietly reshaping the table.
select is(
  (select fixtures_scored::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw2')::uuid
      and entry_id = current_setting('test.c93_entry1')::uuid),
  (predictor_internal.resolve_matchweek_settlement(
     predictor_internal.season_matchweek_card(current_setting('test.c93_mw2')::uuid))
   -> 'settlement' ->> 'matchesPlayedDenominator'),
  'fixtures_scored is the settlement denominator itself, not a count of fixtures on the card'
);

-- ---------------------------------------------------------------------------
-- An unsettled matchweek, and the backwards direction.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw3')::uuid),
  '0',
  'a matchweek still awaiting a result writes nothing'
);

select is(
  (select count(*)::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw4')::uuid),
  '0',
  'and a matchweek with no fixtures at all writes nothing — an empty round settles trivially, and counting it would add a matchweek nobody played'
);

-- A result is corrected: matchweek 1's first fixture becomes 3-1, so player 1's
-- exact score becomes a correct result and player 2's 3-1 becomes exact.
update public.season_fixtures set home_score = 3, away_score = 1
 where id = current_setting('test.c93_f1')::uuid;

select set_config('test.c93_rerun',
  predictor_internal.settle_season_matchweek_scores(current_setting('test.c93_season')::uuid)::text,
  true);

select is(
  (select points::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw1')::uuid
      and entry_id = current_setting('test.c93_entry2')::uuid),
  '5',
  'a corrected result rederives the total — player 2''s 3-1 is now exact, and the old 3 is gone rather than added to'
);

-- Matchweek 1 stops being settled: one fixture is reopened as abandoned with no
-- replay. Its rows must GO. A job that only ever adds would leave standings
-- counting a matchweek the data no longer says was played.
update public.season_fixtures
   set status = 'abandoned', home_score = null, away_score = null
 where id = current_setting('test.c93_f2')::uuid;

select set_config('test.c93_unsettle',
  predictor_internal.settle_season_matchweek_scores(current_setting('test.c93_season')::uuid)::text,
  true);

select is(
  (select count(*)::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw1')::uuid),
  '0',
  'a matchweek that STOPS being settled loses its rows — the job runs backwards, because a stale total would be counted as a matchweek played'
);

select is(
  ((current_setting('test.c93_unsettle')::jsonb)->>'scoresCleared')::integer > 0,
  true,
  'and it says how many it cleared, so a total disappearing from a leaderboard is explicable'
);

select is(
  (select count(*)::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw5')::uuid),
  '0',
  'a matchweek holding a POSTPONED fixture does not settle — the move between rounds has not happened yet, so the fixture is still awaited rather than gone'
);

select is(
  (select count(*)::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw6')::uuid),
  '0',
  'and a matchweek voided outright writes nothing — it settles, but its matches-played denominator is zero, so no matchweek was played'
);

select is(
  (select count(*)::text from public.season_matchweek_scores
    where competition_round_id = current_setting('test.c93_mw2')::uuid),
  '1',
  'the LATEST lock verdict decides: player 4 was submitted under the original lock and unbanked under the rescheduled one, and only the second stands'
);

-- The two zero-denominator cases report DIFFERENT reasons, because they are
-- different operational facts: a round with nothing scheduled is a scheduling
-- fault, a round voided outright is something that happened.
select is(
  (select entry->>'reason' from jsonb_array_elements(
     (current_setting('test.c93_run')::jsonb)->'skipped') entry
    where entry->>'round' = 'SJ4'),
  'no_fixtures',
  'a matchweek with nothing scheduled is reported as no_fixtures'
);

select is(
  (select entry->>'reason' from jsonb_array_elements(
     (current_setting('test.c93_run')::jsonb)->'skipped') entry
    where entry->>'round' = 'SJ6'),
  'nothing_played',
  'and a matchweek voided outright is reported as nothing_played, not confused with an empty one'
);

-- ---------------------------------------------------------------------------
-- Boundaries.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.settle_season_matchweek_scores(
    current_setting('test.c93_tournament')::uuid)->>'reason',
  'not_a_league_season',
  'a tournament is refused outright — ADR 0011 forbids a combined cross-competition scoring path'
);

select is(
  (select count(*)::text from information_schema.role_routine_grants
    where routine_name in ('process_due_season_matchweek_scores')
      and grantee in ('anon', 'authenticated', 'service_role')),
  '0',
  'the tick is reachable only from cron — an operator-triggered recompute is its own decision, not a grant added because it would work'
);

select * from finish();
rollback;
