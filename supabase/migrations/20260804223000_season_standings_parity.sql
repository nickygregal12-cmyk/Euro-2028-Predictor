-- Contract 94: the season table, in SQL.
--
-- Counterpart to `computeSeasonStandings` in `src/domain/season/standings.ts`,
-- authority ADR 0012, held in step by
-- `tests/database-parity/seasonStandingsParity.test.ts`.
--
-- Contract 93 made a season have scores. This makes it have a TABLE. It is
-- deliberately the arithmetic only: no display name, no pagination, no access
-- boundary, no cursor. Those belong to the bounded read that consumes this, and
-- keeping them out means the ranking can be proven against the TypeScript
-- authority without a single row of profile data in the way.
--
-- ---------------------------------------------------------------------------
-- WHO IS IN THE TABLE, WHICH THE TYPESCRIPT DOES NOT DECIDE
-- ---------------------------------------------------------------------------
--
-- `computeSeasonStandings` takes a list of entries and ranks exactly those,
-- including any whose `matchweeks` array is empty. The list is the caller's
-- choice, so the SQL has to make it — and the two available answers differ:
--
--   read from `season_matchweek_scores` — a player who has banked no matchweek
--   is ABSENT from their own league's table;
--
--   read from `entries` and left join the scores — they appear on 0 points
--   from 0 matchweeks.
--
-- The second, because a league table shows a team that has played no games on
-- zero rather than omitting it, and because vanishing from a table you have
-- joined reads as a bug to the person it happens to. It also keeps this
-- function's row set stable across a matchweek settling, which the first would
-- not.
--
-- Note what this does NOT do: it does not put a player on zero for a matchweek
-- they missed. Absence from `season_matchweek_scores` still means "no
-- matchweek", per contract 90 — `matchweeksPlayed` counts rows, so a player on
-- 0 from 0 and a player on 0 from 12 are different rows saying different things.
--
-- ---------------------------------------------------------------------------
-- THE TIE-BREAK IS A COLLATION QUESTION, AND IT IS NOT COSMETIC
-- ---------------------------------------------------------------------------
--
-- Rank comes from points alone; equal points share a rank. But the ORDER of
-- rows within a tie is part of the returned array, and the TypeScript settles
-- it with `entryId.localeCompare`, which is ICU. PostgreSQL ordering a `uuid`
-- column is bytewise. Those are different algorithms, and for general strings
-- they disagree — ICU treats a hyphen as ignorable at the primary level, so
-- `'a-b'` and `'ab'` can order differently under the two.
--
-- They agree here for one structural reason: a UUID's hyphens sit at four
-- FIXED positions, so every comparison that reaches a hyphen has a hyphen on
-- both sides, and the ignorable-punctuation difference can never be reached.
-- That is a property of the id format, not of the two orderings, so the parity
-- test sweeps real UUIDs rather than taking the argument on trust — and says so
-- where a future non-UUID entry id would break it.

begin;

create or replace function predictor_internal.season_standings(
  p_tournament_id uuid
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with totals as (
    select
      entry.id as entry_id,
      -- `coalesce` over the sum, not over each row: an entry with no settled
      -- matchweek sums to NULL, and a NULL total would sort unpredictably and
      -- rank against nothing.
      coalesce(sum(score.points), 0)::integer as points,
      count(score.entry_id)::integer as matchweeks_played
    from public.entries entry
    -- LEFT, so a player who has banked no matchweek is on 0 from 0 rather than
    -- missing from their own league's table. See the header.
    left join public.season_matchweek_scores score
      on score.entry_id = entry.id
     -- Provably redundant, and kept: `season_matchweek_scores_entry_fkey` is
     -- composite against `entries(tournament_id, id)`, and `entries.id` is the
     -- primary key, so an entry id already determines its tournament. Removing
     -- this line changes no result, which mutation testing confirmed — it is an
     -- equivalent mutant, not a covered one. It stays because it states the
     -- scoping the composite key enforces, and because a future entry id that
     -- is not globally unique would make it load-bearing overnight.
     and score.tournament_id = entry.tournament_id
    where entry.tournament_id = p_tournament_id
    group by entry.id
  ),
  ranked as (
    select
      totals.*,
      -- `rank`, not `row_number` or `dense_rank`: standard competition ranking,
      -- where equal points share a rank and the next rank SKIPS. `dense_rank`
      -- would give 1, 2, 2, 3 where the authority gives 1, 2, 2, 4.
      rank() over (order by totals.points desc)::integer as standing_rank
    from totals
  )
  select coalesce(
    (select jsonb_agg(
       jsonb_build_object(
         'entryId', ranked.entry_id::text,
         'rank', ranked.standing_rank,
         'points', ranked.points,
         'matchweeksPlayed', ranked.matchweeks_played)
       -- Points first, then the entry id, mirroring the TypeScript sort. The
       -- id ordering is bytewise here and ICU there; see the header for why
       -- those agree on UUIDs and only on UUIDs.
       order by ranked.points desc, ranked.entry_id)
     from ranked),
    '[]'::jsonb)
  where exists (
    select 1 from public.tournaments t
     where t.id = p_tournament_id and t.kind = 'league_season'
  );
$$;

-- Returns NULL, not an empty array, for anything that is not a league season.
-- The `where exists` above does that: ADR 0011 forbids a combined
-- cross-competition standings path, and an empty array would read as "this
-- season has no players" rather than "this is not a season".
revoke all on function predictor_internal.season_standings(uuid)
  from public, anon, authenticated;

commit;
