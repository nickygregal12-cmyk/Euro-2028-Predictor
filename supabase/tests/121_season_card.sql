-- Contract 69: the season card.
--
-- The Joker allowance is the most intricate rule in this contract — ten per
-- season, five per half, no carry-over — and it is enforced by counting rows
-- the caller cannot see. Only a real database can prove it.

begin;
select plan(13);

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

-- The seed creates no auth.users, so a card needs one made here. Creating an
-- `entries` row fires C1b's prepare_entry_game_membership, which resolves the
-- canonical membership through the season's Main Predictor availability —
-- C1b already creates that for every league season, so nothing else is needed.
set local session_replication_role = replica;
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values (md5('season-card-user')::uuid,'season-card@example.test','authenticated','authenticated','{}','{}',now(),now());
set local session_replication_role = origin;

insert into public.entries (user_id, tournament_id)
select md5('season-card-user')::uuid, season_id from card_probe;

create temporary table card_entry as
select e.id as entry_id, p.season_id
  from public.entries e, card_probe p
 where e.tournament_id = p.season_id;

-- Clubs and fixtures. A matchweek with no fixtures at all is locked — there is
-- no kickoff to prove it open, and nothing to double — so every matchweek used
-- below is given a real fixture. Matchweek 4's kickoff is deliberately left
-- null to exercise the unconfirmed-kickoff path.
insert into public.teams (tournament_id, name)
select season_id, 'Card Club ' || c from card_probe, unnest(array['A','B','C','D','E','F','G','H']) as c;

insert into public.season_fixtures (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at)
select p.season_id,
       (select id from public.competition_rounds where tournament_id = p.season_id and ordinal = n),
       (select id from public.teams where tournament_id = p.season_id and name = 'Card Club ' || h),
       (select id from public.teams where tournament_id = p.season_id and name = 'Card Club ' || a),
       case when n = 4 then null else now() + interval '7 days' end
  from card_probe p,
       (values (1,'A','B'), (2,'C','D'), (3,'E','F'), (4,'G','H')) as f(n, h, a);

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

-- Matchweek 2 is still the first half of a four-matchweek season.
select lives_ok(
  $$
    insert into public.season_matchweek_jokers (tournament_id, entry_id, competition_round_id)
    select c.season_id, c.entry_id,
           (select id from public.competition_rounds where tournament_id = c.season_id and ordinal = 2)
      from card_entry c
  $$,
  'a second first-half Joker is accepted below the half cap'
);

-- A Joker cannot attach to a knockout round. The allowance trigger sorts before
-- the lock trigger, so this is refused for being the wrong round kind rather
-- than for having no fixtures.
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

-- A scoreline is accepted while its matchweek is open.
select lives_ok(
  $$
    insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
    select c.season_id, c.entry_id,
           (select fixture.id from public.season_fixtures fixture
             join public.competition_rounds round on round.id = fixture.competition_round_id
            where fixture.tournament_id = c.season_id and round.ordinal = 3),
           1, 0
      from card_entry c
  $$,
  'a scoreline is accepted before the matchweek locks'
);

-- The season is part of the reference: naming another season's id alongside
-- this season's fixture is refused by the composite key.
select throws_ok(
  $$
    insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
    select (select id from public.tournaments where kind = 'league_season' order by name limit 1 offset 1),
           c.entry_id,
           (select fixture.id from public.season_fixtures fixture
             join public.competition_rounds round on round.id = fixture.competition_round_id
            where fixture.tournament_id = c.season_id and round.ordinal = 1),
           1, 0
      from card_entry c
  $$,
  '23503',
  null,
  'a prediction cannot cross a season boundary'
);

-- Matchweek 4 has a fixture with no confirmed kickoff. An unknown kickoff
-- cannot prove the matchweek open, so it is locked rather than open.
select throws_ok(
  $$
    insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
    select c.season_id, c.entry_id,
           (select fixture.id from public.season_fixtures fixture
             join public.competition_rounds round on round.id = fixture.competition_round_id
            where fixture.tournament_id = c.season_id and round.ordinal = 4),
           1, 0
      from card_entry c
  $$,
  '55000',
  null,
  'an unconfirmed kickoff locks the matchweek rather than opening it'
);

-- Move matchweek 3 past its kickoff. The WHERE clause matters: without it this
-- would lock every matchweek and the assertions above would pass for the wrong
-- reason.
update public.season_fixtures fixture
   set kickoff_at = now() - interval '1 minute'
  from public.competition_rounds round
 where round.id = fixture.competition_round_id
   and round.ordinal = 3;

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

select * from finish();
rollback;
