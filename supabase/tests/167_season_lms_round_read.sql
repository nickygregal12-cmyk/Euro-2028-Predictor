-- Contract 116: the season Last Man Standing round reaches the browser.
--
-- The assertion this file exists for is the one that measures BOTH functions
-- against the same seeded season round: `get_my_lms` returns that round with an
-- empty fixture array, because it resolves fixtures through
-- `bonus_window_fixtures -> public.matches`, and `get_season_lms_round` returns
-- the same round with its fixtures, because it reads
-- `season_cup_window_fixtures -> season_fixtures`. Asserting the old function's
-- emptiness alongside the new function's contents is what makes this a proven
-- gap rather than a claimed one — and it will fail loudly if `get_my_lms` is
-- ever widened, at which point this contract's reason for existing has changed
-- and someone should be told.
--
-- The survival verdict is the other thing worth defending. It is not derived
-- here and must never be derived in a browser: it comes from
-- `predictor_internal.season_lms_pick_outcome`, the same function the
-- settlement replay folds over, so the surface and the ledger cannot disagree.

begin;

select plan(23);

-- ---------------------------------------------------------------------------
-- Grants: one function, exactly to authenticated, and no new table reach.
-- ---------------------------------------------------------------------------

select is(
  has_function_privilege('authenticated', 'public.get_season_lms_round(uuid)', 'execute'),
  true, 'authenticated may read their season LMS round');
select is(
  has_function_privilege('anon', 'public.get_season_lms_round(uuid)', 'execute'),
  false, 'anonymous may not read the round');
select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_name in (
      'season_cup_window_fixtures', 'bonus_lms_selections',
      'bonus_competition_windows', 'bonus_competition_entrants'
    )
      and grantee in ('anon', 'authenticated')),
  0,
  'the read added no direct table grant');

-- ---------------------------------------------------------------------------
-- Setup: a league season with a published LMS competition, two windows (one
-- still open, one already locked), a played fixture in each, one entrant and
-- one non-entrant.
-- ---------------------------------------------------------------------------

-- A season of this suite's OWN, rather than the shared seeded one.
--
-- The first version of this file inserted a Last Man Standing competition on
-- the seeded league season and CI refused it: that season already has a live
-- public LMS competition, and contract 103's partial unique index
-- `bonus_competitions_live_public_game_key` allows exactly one per season game.
-- The index was right and the seed was wrong. Reusing the existing competition
-- instead would have made the assertions non-deterministic — its windows decide
-- which round "the earliest still open to a pick" resolves to — so the probe
-- gets a season nobody else is using. The competition_id is borrowed from the
-- seeded season because `tournaments` is unique on (competition_id, season_key)
-- and a fresh season_key is all that is needed to sit beside it.
insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C116 LMS Probe Season', 2028, t.competition_id, 'c116-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

create temporary table lms_probe as
select (select id from public.tournaments where season_key = 'c116-probe') as season_id;

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season_id, 'C116-R' || n, 900 + n, 'league_matchweek', 'LMS probe R' || n
from lms_probe, generate_series(1, 2) n;

insert into public.teams (tournament_id, name)
select season_id, name from lms_probe,
  (values ('C116 Alpha'), ('C116 Beta'), ('C116 Gamma'), ('C116 Delta')) clubs(name);

select set_config('test.c116_alpha', (select id::text from public.teams where name = 'C116 Alpha'), true);
select set_config('test.c116_beta', (select id::text from public.teams where name = 'C116 Beta'), true);
select set_config('test.c116_gamma', (select id::text from public.teams where name = 'C116 Gamma'), true);
select set_config('test.c116_delta', (select id::text from public.teams where name = 'C116 Delta'), true);

-- The competition. `visibility_kind` defaults to 'public' and `completed_at`
-- stays null, which is exactly what `live_competition_id` selects on.
insert into public.bonus_competitions (tournament_id, game_key, published)
select season_id, 'last_man_standing', true from lms_probe;

select set_config('test.c116_competition',
  (select c.id::text from public.bonus_competitions c join lms_probe p on p.season_id = c.tournament_id
    where c.game_key = 'last_man_standing'), true);

-- Window 1 has locked; window 2 is still open. The open one is the round the
-- player can act on, so it is the one the read must choose.
insert into public.bonus_competition_windows (competition_id, sequence, label, opens_at, locks_at, settles_at)
values
  (current_setting('test.c116_competition')::uuid, 1, 'Round 1',
   now() - interval '8 days', now() - interval '7 days', now() - interval '6 days'),
  (current_setting('test.c116_competition')::uuid, 2, 'Round 2',
   now() - interval '1 day', now() + interval '2 days', now() + interval '3 days');

select set_config('test.c116_w1',
  (select id::text from public.bonus_competition_windows
    where competition_id = current_setting('test.c116_competition')::uuid and sequence = 1), true);
select set_config('test.c116_w2',
  (select id::text from public.bonus_competition_windows
    where competition_id = current_setting('test.c116_competition')::uuid and sequence = 2), true);

-- Round 1: Alpha beat Beta (a settled, played result).
insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status, home_score, away_score)
select p.season_id,
       (select id from public.competition_rounds r where r.tournament_id = p.season_id and r.round_key = 'C116-R1'),
       current_setting('test.c116_alpha')::uuid, current_setting('test.c116_beta')::uuid,
       now() - interval '7 days', 'played', 2::smallint, 0::smallint
  from lms_probe p;

-- Round 2: Gamma v Delta, still to be played.
insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at)
select p.season_id,
       (select id from public.competition_rounds r where r.tournament_id = p.season_id and r.round_key = 'C116-R2'),
       current_setting('test.c116_gamma')::uuid, current_setting('test.c116_delta')::uuid,
       now() + interval '2 days'
  from lms_probe p;

insert into public.season_cup_window_fixtures (window_id, season_fixture_id)
select current_setting('test.c116_w1')::uuid, f.id
  from public.season_fixtures f
 where f.competition_round_id =
   (select id from public.competition_rounds r join lms_probe p on p.season_id = r.tournament_id
     where r.round_key = 'C116-R1');

insert into public.season_cup_window_fixtures (window_id, season_fixture_id)
select current_setting('test.c116_w2')::uuid, f.id
  from public.season_fixtures f
 where f.competition_round_id =
   (select id from public.competition_rounds r join lms_probe p on p.season_id = r.tournament_id
     where r.round_key = 'C116-R2');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (md5('c116-player')::uuid, 'c116-player@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  (md5('c116-outsider')::uuid, 'c116-outsider@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.bonus_competition_entrants (competition_id, user_id)
values (current_setting('test.c116_competition')::uuid, md5('c116-player')::uuid);

-- ---------------------------------------------------------------------------
-- The outermost gates.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.get_season_lms_round((select season_id from lms_probe))$$,
  '42501', null, 'an unauthenticated read refuses');

select set_config('request.jwt.claim.sub', md5('c116-player')::uuid::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.get_season_lms_round(null)$$,
  '22023', null, 'a null season refuses');

-- ---------------------------------------------------------------------------
-- The round the player is shown, and the defect this contract fixes.
-- ---------------------------------------------------------------------------

select is(
  (public.get_season_lms_round((select season_id from lms_probe)) ->> 'available')::boolean,
  true, 'a published competition is available');

select is(
  (public.get_season_lms_round((select season_id from lms_probe)) ->> 'entered')::boolean,
  true, 'the entrant is entered');

select is(
  public.get_season_lms_round((select season_id from lms_probe)) #>> '{window,label}',
  'Round 2',
  'the round shown is the earliest still open to a pick, not the settled one');

select is(
  jsonb_array_length(
    public.get_season_lms_round((select season_id from lms_probe)) #> '{window,fixtures}'),
  1,
  'the open round carries its season fixture');

select is(
  public.get_season_lms_round((select season_id from lms_probe)) #>> '{window,fixtures,0,home,name}',
  'C116 Gamma',
  'the fixture names its home club from public.teams');

select is(
  public.get_season_lms_round((select season_id from lms_probe)) #>> '{window,fixtures,0,status}',
  'scheduled',
  'an unplayed fixture reports its scheduled status');

-- THE CONTRAST. Same season, same competition, same window — the tournament
-- read cannot see the fixtures. If this ever stops being empty, `get_my_lms`
-- has been widened and this contract's justification needs revisiting.
select is(
  jsonb_array_length(
    (select w -> 'fixtures'
       from jsonb_array_elements(
         public.get_my_lms((select season_id from lms_probe)) #> '{windows}') as t(w)
      where w ->> 'label' = 'Round 2')),
  0,
  'get_my_lms returns the same round with no fixtures — the gap this read fills');

-- ---------------------------------------------------------------------------
-- A pick, its version echo, and the server's survival verdict.
-- ---------------------------------------------------------------------------

select is(
  public.get_season_lms_round((select season_id from lms_probe)) #> '{window,selection}',
  'null'::jsonb,
  'no pick yet reads as no selection');

insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id)
values (current_setting('test.c116_competition')::uuid, md5('c116-player')::uuid,
        current_setting('test.c116_w2')::uuid, current_setting('test.c116_gamma')::uuid);

select is(
  public.get_season_lms_round((select season_id from lms_probe)) #>> '{window,selection,team_id}',
  current_setting('test.c116_gamma'),
  'the pick comes back');

select is(
  (public.get_season_lms_round((select season_id from lms_probe)) #>> '{window,selection,version}')::integer,
  0,
  'the pick carries the version the client must echo');

select is(
  public.get_season_lms_round((select season_id from lms_probe)) #>> '{window,pick_outcome}',
  'postponed',
  'an unplayed round is postponed, never an elimination — absent information never eliminates');

select is(
  jsonb_array_length(
    public.get_season_lms_round((select season_id from lms_probe)) -> 'used_team_ids'),
  1,
  'the pick consumes a club in the current cycle');

-- The outcome authority is exercised DIRECTLY, with no selection row seeded for
-- the locked window. An earlier version inserted one, which contract 63's
-- `assert_bonus_lms_selection_shape` would have refused outright: window 1
-- locked seven days ago and the trigger requires an open window. Silencing the
-- trigger to seed it would have proven nothing here — the function takes a team
-- id, not a selection — so the row is simply not needed.
select is(
  predictor_internal.season_lms_pick_outcome(
    (select season_id from lms_probe),
    current_setting('test.c116_w1')::uuid,
    current_setting('test.c116_alpha')::uuid),
  'won',
  'the settlement authority reads the played result — and the read uses this same function');

select is(
  predictor_internal.season_lms_pick_outcome(
    (select season_id from lms_probe),
    current_setting('test.c116_w1')::uuid,
    current_setting('test.c116_beta')::uuid),
  'lost',
  'the losing club loses by the same authority');

-- ---------------------------------------------------------------------------
-- A caller with no entry, and the absence of anyone else's data.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', md5('c116-outsider')::uuid::text, true);

select is(
  (public.get_season_lms_round((select season_id from lms_probe)) ->> 'entered')::boolean,
  false, 'a non-entrant is not entered');

select is(
  public.get_season_lms_round((select season_id from lms_probe)) #> '{window,selection}',
  'null'::jsonb,
  'a non-entrant sees no selection — least of all the entrant''s');

select is(
  jsonb_array_length(
    public.get_season_lms_round((select season_id from lms_probe)) -> 'used_team_ids'),
  0,
  'a non-entrant has consumed no clubs');

select is(
  jsonb_array_length(
    public.get_season_lms_round((select season_id from lms_probe)) #> '{window,fixtures}'),
  1,
  'a non-entrant still sees the fixtures — deciding whether to join needs them, and they are nobody''s private data');

select finish();
rollback;
