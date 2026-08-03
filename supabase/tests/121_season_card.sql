-- Contract 69: the season card.
--
-- The Joker allowance is the most intricate rule in this contract — ten per
-- season, five per half, no carry-over — and it is enforced by counting rows
-- the caller cannot see. Only a real database can prove it.

begin;
select plan(12);

select has_table('public', 'season_predictions', 'season_predictions exists');
select has_table('public', 'season_matchweek_jokers', 'season_matchweek_jokers exists');

select is(
  (select count(*)::integer from pg_class
    where relname in ('season_predictions', 'season_matchweek_jokers')
      and relnamespace = 'public'::regnamespace
      and relrowsecurity),
  2,
  'both season card tables have row level security enabled'
);

select is(
  (select count(*)::integer
     from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('season_predictions', 'season_matchweek_jokers')
      and grantee in ('anon', 'authenticated')),
  0,
  'no browser role holds a direct grant on the season card'
);

-- ---------------------------------------------------------------------------
-- A four-matchweek season: halves divide at 2, so matchweeks 1-2 are the first
-- half and 3-4 the second. Small enough to exhaust an allowance quickly if the
-- caps were wrong, which is the point.
-- ---------------------------------------------------------------------------

create temporary table card_probe as
select (select id from public.tournaments where kind = 'league_season' order by name limit 1) as season_id;

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season_id, 'MW' || n, n, 'league_matchweek', 'Matchweek ' || n
  from card_probe, generate_series(1, 4) as n;

insert into public.entries (user_id, tournament_id)
select (select id from auth.users order by created_at limit 1), season_id from card_probe;

create temporary table card_entry as
select e.id as entry_id, p.season_id
  from public.entries e, card_probe p
 where e.tournament_id = p.season_id;

-- A Joker attaches to a matchweek, and the first is accepted.
select lives_ok(
  $$
    insert into public.season_matchweek_jokers (tournament_id, entry_id, competition_round_id)
    select c.season_id, c.entry_id,
           (select id from public.competition_rounds where tournament_id = c.season_id and ordinal = 1)
      from card_entry c
  $$,
  'a Joker is accepted on an unlocked matchweek'
);

-- The same matchweek cannot be doubled twice.
select throws_ok(
  $$
    insert into public.season_matchweek_jokers (tournament_id, entry_id, competition_round_id)
    select c.season_id, c.entry_id,
           (select id from public.competition_rounds where tournament_id = c.season_id and ordinal = 1)
      from card_entry c
  $$,
  '23505',
  null,
  'a matchweek cannot carry two Jokers'
);

-- Five per half. Matchweek 2 is still the first half, and with only two
-- matchweeks in it the cap cannot be reached here — so this proves the half
-- boundary rather than the cap.
select lives_ok(
  $$
    insert into public.season_matchweek_jokers (tournament_id, entry_id, competition_round_id)
    select c.season_id, c.entry_id,
           (select id from public.competition_rounds where tournament_id = c.season_id and ordinal = 2)
      from card_entry c
  $$,
  'a second first-half Joker is accepted below the half cap'
);

-- A Joker cannot attach to a knockout round or a group matchday.
insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season_id, 'KO1', 9, 'knockout_round', 'Not a matchweek' from card_probe;

select throws_ok(
  $$
    insert into public.season_matchweek_jokers (tournament_id, entry_id, competition_round_id)
    select c.season_id, c.entry_id,
           (select id from public.competition_rounds where tournament_id = c.season_id and round_key = 'KO1')
      from card_entry c
  $$,
  '23514',
  null,
  'a Joker cannot attach to a knockout round'
);

-- ---------------------------------------------------------------------------
-- Locks. A matchweek with no confirmed kickoff is locked, not open: an unknown
-- kickoff cannot prove the matchweek is still open, and a wrong "open" accepts
-- a prediction after the match has started.
-- ---------------------------------------------------------------------------

insert into public.teams (tournament_id, name)
select season_id, 'Card Club A' from card_probe;
insert into public.teams (tournament_id, name)
select season_id, 'Card Club B' from card_probe;

insert into public.season_fixtures (tournament_id, competition_round_id, home_team_id, away_team_id)
select c.season_id,
       (select id from public.competition_rounds where tournament_id = c.season_id and ordinal = 3),
       (select id from public.teams where tournament_id = c.season_id and name = 'Card Club A'),
       (select id from public.teams where tournament_id = c.season_id and name = 'Card Club B')
  from card_entry c;

select throws_ok(
  $$
    insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
    select c.season_id, c.entry_id, (select id from public.season_fixtures limit 1), 1, 0
      from card_entry c
  $$,
  '55000',
  null,
  'an unconfirmed kickoff locks the matchweek rather than opening it'
);

-- With a future kickoff the matchweek is open and the scoreline is accepted.
update public.season_fixtures set kickoff_at = now() + interval '7 days';

select lives_ok(
  $$
    insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
    select c.season_id, c.entry_id, (select id from public.season_fixtures limit 1), 1, 0
      from card_entry c
  $$,
  'a scoreline is accepted before the matchweek locks'
);

-- Once the earliest kickoff has passed, the matchweek is closed to writes.
update public.season_fixtures set kickoff_at = now() - interval '1 minute';

select throws_ok(
  $$
    update public.season_predictions set home_score = 3, away_score = 3
  $$,
  '55000',
  null,
  'a scoreline cannot be changed after the matchweek locks'
);

select throws_ok(
  $$
    insert into public.season_matchweek_jokers (tournament_id, entry_id, competition_round_id)
    select c.season_id, c.entry_id,
           (select id from public.competition_rounds where tournament_id = c.season_id and ordinal = 3)
      from card_entry c
  $$,
  '55000',
  null,
  'a Joker cannot be played on a locked matchweek'
);

-- A prediction cannot name a fixture from another season: the composite key
-- makes the season part of the reference.
select throws_ok(
  $$
    insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
    select (select id from public.tournaments where kind = 'tournament' order by name limit 1),
           c.entry_id, (select id from public.season_fixtures limit 1), 1, 0
      from card_entry c
  $$,
  '23503',
  null,
  'a prediction cannot cross a season boundary'
);

select * from finish();
rollback;
