-- Contract 94: the season table.
--
-- The RANKING is proven elsewhere, by a differential sweep of 600 randomised
-- seasons against `computeSeasonStandings` — 339 of them containing a tie,
-- which is where the two languages could disagree. That sweep feeds both sides
-- the same totals and never touches a table.
--
-- This file covers what the sweep deliberately cannot: the READ. Which rows
-- become an entry in the table at all, which do not, and what happens at the
-- competition boundary. Those are decisions about the season's data rather than
-- about arithmetic, and every one of them is a way for a table to be quietly
-- wrong about who is in the league.
--
-- The one most worth protecting is the LEFT JOIN. `computeSeasonStandings`
-- ranks whatever list it is given, including entries with no settled matchweek;
-- the SQL has to choose that list, and reading straight from
-- `season_matchweek_scores` would make a player who has banked no matchweek
-- vanish from their own league's table. Not appear on zero — vanish. That looks
-- like a bug to the person it happens to and like nothing at all to everybody
-- else.

begin;
select plan(12);

-- ---------------------------------------------------------------------------
-- One season with four players, one tournament to prove the boundary.
-- ---------------------------------------------------------------------------

create temporary table standing_probe as
select (select id from public.tournaments where kind = 'league_season' order by name limit 1) as season_id,
       (select id from public.tournaments where kind = 'tournament' order by name limit 1) as tournament_id;

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season_id, 'ST' || n, 599 + n, 'league_matchweek', 'Standings probe ' || n
from standing_probe, generate_series(1, 3) n;

select set_config('test.c94_season', (select season_id::text from standing_probe), true);
select set_config('test.c94_tournament', (select tournament_id::text from standing_probe), true);
select set_config('test.c94_mw' || n,
  (select r.id::text from public.competition_rounds r join standing_probe p on p.season_id = r.tournament_id
    where r.round_key = 'ST' || n), true)
from generate_series(1, 3) n;

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('c94-' || n)::uuid, 'c94-' || n || '@example.test',
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 4) n;
set local session_replication_role = origin;

insert into public.entries (tournament_id, user_id)
select season_id, md5('c94-' || n)::uuid from standing_probe, generate_series(1, 4) n;

select set_config('test.c94_entry' || n,
  (select e.id::text from public.entries e join standing_probe p on p.season_id = e.tournament_id
    where e.user_id = md5('c94-' || n)::uuid), true)
from generate_series(1, 4) n;

-- Player 1: 10 + 8 = 18 from two matchweeks.
-- Player 2: 9 from one.
-- Player 3: 4 + 5 = 9 from two — TIED with player 2 on points, different
--           matchweeks played, which is the pairing ADR 0012 exists to show.
-- Player 4: nothing banked at all.
-- The two tied players' rows go in DESCENDING entry-id order, which is an
-- attempt to make the ordering assertion below able to fail. It does not
-- succeed, and that is worth stating plainly rather than leaving as an
-- apparently-strong test: removing the `order by ranked.entry_id` from the
-- migration does NOT fail this file. The `group by entry.id` in the function
-- plans as a GroupAggregate over a sort on `entry.id`, so the rows reach
-- `jsonb_agg` already in entry-id order and the tie-break is invisible through
-- this path however the rows were inserted.
--
-- The tie-break still has to be there. Nothing in the plan is promised — a
-- HashAggregate or a parallel scan at a real season's size need not preserve
-- that order — so the explicit sort is a guarantee the query shape currently
-- provides by accident. What actually kills its removal is the differential
-- sweep, on 239 of 600 cases, because the sweep's query has no group-by sort to
-- hide behind. This assertion pins the ORDER the caller renders; the sweep is
-- what proves the sort is load-bearing.
select set_config('test.c94_tie_high',
  greatest(current_setting('test.c94_entry2')::uuid, current_setting('test.c94_entry3')::uuid)::text, true);
select set_config('test.c94_tie_low',
  least(current_setting('test.c94_entry2')::uuid, current_setting('test.c94_entry3')::uuid)::text, true);

insert into public.season_matchweek_scores (
  tournament_id, entry_id, competition_round_id, points, joker_applied, fixtures_scored)
values
  (current_setting('test.c94_season')::uuid, current_setting('test.c94_entry1')::uuid,
   current_setting('test.c94_mw1')::uuid, 10, false, 5),
  (current_setting('test.c94_season')::uuid, current_setting('test.c94_entry1')::uuid,
   current_setting('test.c94_mw2')::uuid, 8, false, 5),
  (current_setting('test.c94_season')::uuid, current_setting('test.c94_tie_high')::uuid,
   current_setting('test.c94_mw1')::uuid, 9, false, 5),
  (current_setting('test.c94_season')::uuid, current_setting('test.c94_tie_low')::uuid,
   current_setting('test.c94_mw1')::uuid, 4, false, 5),
  (current_setting('test.c94_season')::uuid, current_setting('test.c94_tie_low')::uuid,
   current_setting('test.c94_mw2')::uuid, 5, false, 5);

select set_config('test.c94_table',
  predictor_internal.season_standings(current_setting('test.c94_season')::uuid)::text, true);

-- ---------------------------------------------------------------------------
-- Who is in the table.
-- ---------------------------------------------------------------------------

select is(
  jsonb_array_length(current_setting('test.c94_table')::jsonb)::text,
  '4',
  'every entry in the season is in the table, including the player who has banked nothing'
);

select is(
  (select row->>'points' from jsonb_array_elements(current_setting('test.c94_table')::jsonb) row
    where row->>'entryId' = current_setting('test.c94_entry4')),
  '0',
  'a player with no settled matchweek is on ZERO — vanishing from your own league''s table reads as a bug to the one person it happens to'
);

select is(
  (select row->>'matchweeksPlayed' from jsonb_array_elements(current_setting('test.c94_table')::jsonb) row
    where row->>'entryId' = current_setting('test.c94_entry4')),
  '0',
  'and on zero matchweeks played, which is what distinguishes them from a player who played twelve and scored nothing'
);

-- ---------------------------------------------------------------------------
-- The totals and the pairing ADR 0012 asks for.
-- ---------------------------------------------------------------------------

select is(
  (select row->>'points' from jsonb_array_elements(current_setting('test.c94_table')::jsonb) row
    where row->>'entryId' = current_setting('test.c94_entry1')),
  '18',
  'a player''s points are the sum of their settled matchweek totals'
);

select is(
  (select row->>'matchweeksPlayed' from jsonb_array_elements(current_setting('test.c94_table')::jsonb) row
    where row->>'entryId' = current_setting('test.c94_entry1')),
  '2',
  'and matches played counts their settled matchweeks, shown beside points as a league table shows games in hand'
);

select is(
  (select count(distinct row->>'matchweeksPlayed')::text
     from jsonb_array_elements(current_setting('test.c94_table')::jsonb) row
    where row->>'points' = '9'),
  '2',
  'two players tied on 9 points have DIFFERENT matchweeks played — the case where points alone would mislead'
);

-- ---------------------------------------------------------------------------
-- Standard competition ranking: equal points share a rank, the next SKIPS.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::text from jsonb_array_elements(current_setting('test.c94_table')::jsonb) row
    where row->>'rank' = '2'),
  '2',
  'the two players on 9 points share rank 2'
);

select is(
  (select row->>'rank' from jsonb_array_elements(current_setting('test.c94_table')::jsonb) row
    where row->>'entryId' = current_setting('test.c94_entry4')),
  '4',
  'and the next rank is 4, not 3 — standard competition ranking, which dense_rank would get wrong'
);

select is(
  (select row->>'rank' from jsonb_array_elements(current_setting('test.c94_table')::jsonb) row
    where row->>'entryId' = current_setting('test.c94_entry1')),
  '1',
  'the highest total is rank 1'
);

-- Array order within a tie is part of the contract, because the caller renders
-- in array order. Points first, then entry id — see the migration header for
-- why bytewise ordering here agrees with the TypeScript's ICU `localeCompare`
-- on UUIDs, and only on UUIDs.
select is(
  (select (row->>'entryId')::uuid
     from jsonb_array_elements(current_setting('test.c94_table')::jsonb) with ordinality as t(row, position)
    where row->>'points' = '9' order by t.position limit 1),
  current_setting('test.c94_tie_low')::uuid,
  'tied rows come back in entry-id order, so the array a caller renders is deterministic rather than whatever the plan produced (see above: the sweep, not this assertion, is what kills the removal of that sort)'
);

-- ---------------------------------------------------------------------------
-- The competition boundary.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.season_standings(current_setting('test.c94_tournament')::uuid),
  null,
  'a tournament returns NULL, not an empty table — ADR 0011 forbids a combined standings path, and [] would read as "this season has no players"'
);

select is(
  has_function_privilege('authenticated',
    'predictor_internal.season_standings(uuid)', 'execute'),
  false,
  'and the table is not directly callable from a browser role — it arrives through a bounded read'
);

select * from finish();
rollback;
