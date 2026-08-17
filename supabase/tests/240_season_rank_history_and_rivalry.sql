-- Contract 192: position over time, and one season-long rivalry.
--
-- THE ASSERTION THIS FILE EXISTS FOR is the DIFFERENTIAL. `season_rank_history`
-- and `season_standings` are two implementations of one ranking rule, and the
-- failure mode is silent: both look sorted, both return plausible integers, and
-- a `dense_rank` where the authority says `rank` gives 1, 2, 2, 3 where the
-- authority gives 1, 2, 2, 4. Nobody notices until a player compares the two
-- screens.
--
-- So the suite RUNS BOTH AUTHORITIES over the same rows and requires them to
-- agree, entry by entry, at the last settled matchweek — where the cumulative
-- total is by definition the season total. Comparing two `order by` clauses by
-- eye is not evidence that one was copied correctly.
--
-- The fixture is built to make that test capable of failing:
--
--   * HEAVY TIES, because a rank/dense_rank/row_number confusion is invisible
--     when every total is distinct. Measured on this exact fixture: 6 distinct
--     ranks across 12 players with a maximum rank of 12, and the two wrong
--     implementations disagree with the canonical standings on 10 rows
--     (`dense_rank`) and 6 rows (`row_number`). A first draft varied the score
--     with both entry and matchweek, produced twelve distinct totals and zero
--     ties, and the differential then passed against BOTH wrong
--     implementations — which is why the formula below looks the way it does.
--   * A LATE JOINER, because the head-to-head's easy wrong implementation
--     folds a missing score to zero and awards the matchweek.
--   * A MATCHWEEK THAT SETTLES OUT OF ORDER, because accumulating by
--     `settled_at` rather than by ordinal is the other plausible reading and
--     gives a different chart.
--
-- The other half is the reveal boundary. Neither read may return a prediction,
-- and neither may speak about a matchweek contract 129 would still hide.

begin;

select plan(18);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C192 Rivalry Probe', 2068, t.competition_id, 'rv-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.rv_season',
  (select id::text from public.tournaments where season_key = 'rv-probe'), true);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('rv-mp')::uuid, current_setting('test.rv_season')::uuid,
  'main_predictor', true, 'active', false, 'public', now() - interval '30 days');

-- Six matchweeks. Every one settles; matchweek 5 settles LAST.
insert into public.competition_rounds (id, tournament_id, round_key, ordinal, kind, label)
select md5('rv-r' || n)::uuid, current_setting('test.rv_season')::uuid,
       'rv-mw' || n, n, 'league_matchweek', 'Matchweek ' || n
from generate_series(1, 6) as n;

insert into public.teams (id, tournament_id, name) values
  (md5('rv-t1')::uuid, current_setting('test.rv_season')::uuid, 'Arsenal'),
  (md5('rv-t2')::uuid, current_setting('test.rv_season')::uuid, 'Chelsea FC');

-- One played fixture per matchweek, all in the past, so every matchweek is
-- settled AND past its own lock. `season_matchweek_lock_at` derives from the
-- fixture kickoffs, so these have to be real rather than implied.
set local session_replication_role = replica;
insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id,
  kickoff_at, status, home_score, away_score)
select md5('rv-f' || n)::uuid, current_setting('test.rv_season')::uuid,
       md5('rv-r' || n)::uuid, md5('rv-t1')::uuid, md5('rv-t2')::uuid,
       now() - (interval '1 day' * (40 - n)), 'played', 2, 1
from generate_series(1, 6) as n;
set local session_replication_role = origin;

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('rv-user-' || n)::uuid, format('rv-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 12) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('rv-user-' || n)::uuid, 'Rival ' || n, now()
from generate_series(1, 12) as n;

insert into public.entries (id, user_id, tournament_id, game_competition_id)
select md5('rv-entry-' || n)::uuid, md5('rv-user-' || n)::uuid,
       current_setting('test.rv_season')::uuid, md5('rv-mp')::uuid
from generate_series(1, 12) as n;

-- Users 1 and 2 share a private league; the rest do not, so the rivalry read is
-- exercised at both `profile` and `compare` reach.
insert into public.leagues (id, tournament_id, owner_id, name, invite_code, game_competition_id)
values (md5('rv-league')::uuid, current_setting('test.rv_season')::uuid,
        md5('rv-user-1')::uuid, 'Rivalry Probe League', 'RV0001', md5('rv-mp')::uuid);

insert into public.league_members (league_id, user_id, role) values
  (md5('rv-league')::uuid, md5('rv-user-1')::uuid, 'owner'),
  (md5('rv-league')::uuid, md5('rv-user-2')::uuid, 'member')
on conflict do nothing;

-- Entries 1-10 play everything. Entry 11 JOINS LATE and banks only matchweeks
-- 5 and 6. Entry 12 never banks anything at all — it is in the field and on
-- zero, exactly as contract 94's LEFT join puts it there.
--
-- PAIRS OF ENTRIES SHARE A SCORING PATTERN, and that is the load-bearing part
-- of this fixture rather than an accident of arithmetic. `((e + 1) / 2)` is
-- integer division, so entries 1 and 2 score identically, 3 and 4 score
-- identically, and so on — their cumulative totals collide and the ranking has
-- to skip. Measured on this exact shape: 6 distinct ranks across 12 players
-- with a maximum rank of 12, and the two wrong implementations disagree with
-- the canonical standings on 10 rows (`dense_rank`) and 6 rows (`row_number`).
--
-- The obvious formula — points varying with both `e` and `r` — gives twelve
-- distinct totals, zero ties, and a differential that passes against
-- `dense_rank` and `row_number` alike. It was tried first and proved exactly
-- that, which is why this one is written the way it is.
insert into public.season_matchweek_scores
  (tournament_id, entry_id, competition_round_id, points, fixtures_scored, settled_at)
select current_setting('test.rv_season')::uuid, md5('rv-entry-' || e)::uuid,
       md5('rv-r' || r)::uuid, ((((e + 1) / 2) * 2 + r) % 9), 1,
       -- Matchweek 5 settles after matchweek 6. An implementation accumulating
       -- by settlement time rather than by matchweek number gets a different
       -- chart, and a postponed matchweek is exactly this shape.
       case when r = 5 then now() - interval '1 minute'
            else now() - (interval '1 day' * (20 - r)) end
from generate_series(1, 11) as e, generate_series(1, 6) as r
where e <= 10 or r >= 5;

-- ---------------------------------------------------------------------------
-- THE DIFFERENTIAL.
-- ---------------------------------------------------------------------------

select is(
  (with canonical as (
     select (row ->> 'entryId')::uuid as entry_id,
            (row ->> 'rank')::integer as rank,
            (row ->> 'points')::integer as points
       from jsonb_array_elements(
         predictor_internal.season_standings(current_setting('test.rv_season')::uuid)) row),
   final_mw as (
     select max(ordinal) as ordinal
       from predictor_internal.season_rank_history(current_setting('test.rv_season')::uuid)),
   history as (
     select h.entry_id, h.standing_rank, h.points
       from predictor_internal.season_rank_history(current_setting('test.rv_season')::uuid) h,
            final_mw
      where h.ordinal = final_mw.ordinal)
   select count(*)::integer
     from canonical c join history h using (entry_id)
    where c.rank is distinct from h.standing_rank
       or c.points is distinct from h.points),
  0,
  'the rank history agrees with the canonical standings at the last settled matchweek');

-- A differential that compares nothing proves nothing. Both sides must be
-- populated, and the ranking must actually have ties in it.
select is(
  (select count(*)::integer
     from jsonb_array_elements(
       predictor_internal.season_standings(current_setting('test.rv_season')::uuid)) row),
  12,
  'the canonical standings hold every entry, including the one that banked nothing');

-- A differential over a tie-free fixture passes against `dense_rank` and
-- `row_number` too. This assertion is what stops the one above becoming
-- decorative if somebody later "tidies" the scoring formula.
select cmp_ok(
  (select count(distinct standing_rank)::integer
     from predictor_internal.season_rank_history(current_setting('test.rv_season')::uuid)
    where ordinal = 6),
  '<',
  12,
  'the fixture really does contain ties, so a dense_rank/row_number defect could show');

select is(
  (select count(distinct entry_id)::integer
     from predictor_internal.season_rank_history(current_setting('test.rv_season')::uuid)
    where ordinal = 1),
  12,
  'the field is the whole season from the first matchweek, not just who had scored');

select is(
  (select field_size
     from predictor_internal.season_rank_history(current_setting('test.rv_season')::uuid)
    where ordinal = 1 limit 1),
  12,
  'and the reported field size says so');

-- The late joiner is on zero at matchweek 1 rather than absent, and the running
-- total carries forward through matchweeks it banked nothing for.
select is(
  (select points
     from predictor_internal.season_rank_history(current_setting('test.rv_season')::uuid)
    where ordinal = 1 and entry_id = md5('rv-entry-11')::uuid),
  0,
  'a player who joined late is in the table on zero rather than missing from it');

select cmp_ok(
  (select points
     from predictor_internal.season_rank_history(current_setting('test.rv_season')::uuid)
    where ordinal = 6 and entry_id = md5('rv-entry-11')::uuid),
  '>',
  0,
  'and their total starts moving from the matchweek they actually played');

-- Accumulation is by matchweek number. Matchweek 5 settled after matchweek 6,
-- so a settlement-ordered implementation would put matchweek 6's total lower.
select cmp_ok(
  (select points
     from predictor_internal.season_rank_history(current_setting('test.rv_season')::uuid)
    where ordinal = 6 and entry_id = md5('rv-entry-1')::uuid),
  '>=',
  (select points
     from predictor_internal.season_rank_history(current_setting('test.rv_season')::uuid)
    where ordinal = 5 and entry_id = md5('rv-entry-1')::uuid),
  'the running total never falls, even where a matchweek settled out of order');

-- ---------------------------------------------------------------------------
-- The reads, as a player.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('rv-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  jsonb_array_length(
    public.get_season_rank_history(current_setting('test.rv_season')::uuid) -> 'matchweeks'),
  6,
  'a player reads their own position at every settled matchweek without naming one');

select is(
  (select count(*)::integer
     from jsonb_array_elements(
       public.get_season_rank_history(current_setting('test.rv_season')::uuid) -> 'matchweeks') row
    where row -> 'rank' is null or row -> 'fieldSize' is null),
  0,
  'and rank never travels without its field');

-- A rival who shares no private league. Contract 129's rule already permits the
-- comparison; contract 191 made them addressable.
select is(
  public.get_season_rivalry(
    current_setting('test.rv_season')::uuid, md5('rv-entry-3')::uuid) -> 'opponent' ->> 'reach',
  'compare',
  'a same-season entrant with no shared league is comparable');

select is(
  public.get_season_rivalry(
    current_setting('test.rv_season')::uuid, md5('rv-entry-3')::uuid)
      -> 'opponent' -> 'playerId',
  'null'::jsonb,
  'and comparing them still discloses no authentication identifier');

select is(
  public.get_season_rivalry(
    current_setting('test.rv_season')::uuid, md5('rv-entry-2')::uuid)
      -> 'opponent' ->> 'reach',
  'profile',
  'while a private-league co-member is profile-reachable');

-- THE LATE-JOINER ASSERTION. Entry 11 banked only matchweeks 5 and 6, so the
-- rivalry is two matchweeks long — not six with four walkovers.
select is(
  (public.get_season_rivalry(
    current_setting('test.rv_season')::uuid, md5('rv-entry-11')::uuid)
      ->> 'matchweeksCompared')::integer,
  2,
  'a matchweek the opponent could not play is not part of the record');

select is(
  (with record as (
     select public.get_season_rivalry(
       current_setting('test.rv_season')::uuid, md5('rv-entry-11')::uuid) -> 'record' as r)
   select ((r ->> 'yourWins')::integer + (r ->> 'theirWins')::integer
           + (r ->> 'draws')::integer) from record),
  2,
  'and the record adds up to exactly the matchweeks compared');

-- A rival who has banked nothing at all: an honest empty comparison, not an
-- error and not a clean sweep.
select is(
  (public.get_season_rivalry(
    current_setting('test.rv_season')::uuid, md5('rv-entry-12')::uuid)
      ->> 'matchweeksCompared')::integer,
  0,
  'a rival with no settled matchweek yields an empty comparison rather than a whitewash');

-- The gap is signed and stated in one direction.
select cmp_ok(
  (public.get_season_rivalry(
    current_setting('test.rv_season')::uuid, md5('rv-entry-12')::uuid)
      ->> 'pointsGap')::integer,
  '<',
  0,
  'the points gap is negative when the caller is ahead');

-- ---------------------------------------------------------------------------
-- What must never come back.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from jsonb_each(public.get_season_rivalry(
       current_setting('test.rv_season')::uuid, md5('rv-entry-3')::uuid)) each
    where each.key in ('fixtures', 'predictions')),
  0,
  'a season-long comparison returns no prediction and no fixture list');

reset role;

select * from finish();

rollback;
