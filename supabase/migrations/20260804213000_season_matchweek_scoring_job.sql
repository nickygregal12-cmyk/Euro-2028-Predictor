-- Contract 93: the season Main Predictor scoring job.
--
-- The season has had scoring rules since contract 70 and, until contract 90, no
-- table to put an answer in. It has had a table since contract 90 and, until
-- now, nothing that writes to it. This is the caller: the thing that turns
-- "Main Predictor scoring has a PostgreSQL counterpart" from a true statement
-- about pure functions into a season that actually has a leaderboard.
--
-- It composes three earlier contracts and invents no rule of its own:
--
--   contract 70 — `season_matchweek_points`, what a matchweek is worth;
--   contract 91 — `resolve_matchweek_settlement`, whether it may be scored yet;
--   contract 92 — the replay link, without which the settlement resolver had
--                 one of its four dispositions permanently out of reach.
--
-- ---------------------------------------------------------------------------
-- DELETE AND REDERIVE, NEVER ACCUMULATE
-- ---------------------------------------------------------------------------
--
-- Results get corrected. A score that could only ever be added to would carry
-- the first version of a result forever, so every run recomputes each matchweek
-- from current fixtures and current predictions and replaces what it finds. The
-- consequence to keep in view is that this runs BACKWARDS as well as forwards:
-- a matchweek that stops being settled — a completed fixture reopened as
-- abandoned, a replay link removed — has its rows DELETED, and the players lose
-- a total they had already seen. That is correct. `standings.ts` counts rows as
-- matchweeks played, so leaving a stale row would report a matchweek as played
-- that the data no longer says was.
--
-- This is contract 85's replay-not-spend law applied to points instead of
-- lives, and for the same reason: survival and totals alike must be
-- re-derivable, because the inputs change after the fact.
--
-- ---------------------------------------------------------------------------
-- WHO IS SCORED FOR A MATCHWEEK
-- ---------------------------------------------------------------------------
--
-- Not every entry in the season — the season has rolling entry, and a player
-- who joined at matchweek 20 was never in matchweeks 1 to 19. Scoring all
-- entries would give them nineteen zero rows, and since `standings.ts` counts
-- ROWS as matchweeks played, they would appear to have played a full season and
-- their points-per-matchweek would be nineteen matchweeks too generous a
-- denominator. Every total would be arithmetically correct.
--
-- The gate is the contract 81 outcome ledger: an entry is scored for a
-- matchweek when the lock recorded `submitted` for it. That is the only record
-- which says the player's card was actually banked into that matchweek, and it
-- excludes the two states that must not score — `unbanked`, the player who
-- never engaged, and `refused`, a card the lock itself declined to accept.
-- Scoring a refused card would award points from data the lock rejected.
--
-- The ledger is keyed by `locks_at` on purpose ("a rescheduled matchweek is a
-- different lock"), so this reads the LATEST outcome per entry. An older lock's
-- verdict must not outvote the one that actually stood.
--
-- ---------------------------------------------------------------------------
-- WHAT `postponed` MAPS TO, WHICH IS THE ONE JUDGEMENT CALL HERE
-- ---------------------------------------------------------------------------
--
-- `season_fixtures.status` has five values and the settlement authority has
-- four states, because ADR 0012 treats postponed/rescheduled as movement
-- BETWEEN rounds — `fixtureReassignment.ts` decides it, and a fixture that has
-- moved is simply ABSENT from this card rather than present in some state.
--
-- A row still carrying this round's id while marked `postponed` is therefore a
-- fixture whose move has not happened yet. It maps to `scheduled`: still
-- awaited, so the matchweek does not settle. The tempting alternative is to
-- treat it as `void`, which would let the matchweek settle immediately — and
-- would drop the fixture from the matches-played denominator with nothing
-- taking its slot, which is precisely the corruption contract 92 exists to
-- prevent, arriving by a different door.

begin;

-- ---------------------------------------------------------------------------
-- A round's fixtures, in the shape the settlement resolver reads.
--
-- Ordered by id so the card is deterministic. Order is not merely cosmetic
-- here: contract 91's refusal contract says the FIRST offending fixture in
-- caller order decides the reason, so an unordered card could report two
-- different reasons for the same data on two runs.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_matchweek_card(
  p_competition_round_id uuid
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', fixture.id::text,
        'state', case fixture.status
                   when 'played' then 'completed'
                   when 'abandoned' then 'abandoned'
                   when 'void' then 'void'
                   -- 'scheduled' and 'postponed'. See the header: a postponed
                   -- fixture that has not yet moved is still awaited.
                   else 'scheduled'
                 end,
        'score', case
                   when fixture.status = 'played'
                   then jsonb_build_object(
                     'home', fixture.home_score,
                     'away', fixture.away_score)
                   else null
                 end,
        'replayFixtureId', fixture.replay_fixture_id::text)
      order by fixture.id),
    '[]'::jsonb)
  from public.season_fixtures fixture
  where fixture.competition_round_id = p_competition_round_id;
$$;

revoke all on function predictor_internal.season_matchweek_card(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Settle one season's matchweeks.
--
-- NO `p_now`. Contract 89's settler takes one because a Last Man Standing round
-- concludes against a lock instant; a matchweek settles when its FIXTURES are
-- resolved, and nothing here reads a clock. A parameter that no branch consults
-- would be a lie about what the function depends on.
--
-- The advisory lock is TRANSACTION-scoped and keyed by the season, so two
-- overlapping runs cannot both delete-and-rederive the same matchweek and
-- interleave their inserts. A session-scoped lock would leak past commit into
-- whatever the connection did next.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.settle_season_matchweek_scores(
  p_tournament_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_round record;
  v_card jsonb;
  v_resolved jsonb;
  v_settlement jsonb;
  v_denominator integer;
  v_scored integer;
  v_written integer := 0;
  v_cleared integer := 0;
  v_settled_rounds integer := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  if p_tournament_id is null then
    raise exception 'A season is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.tournaments t
     where t.id = p_tournament_id and t.kind = 'league_season'
  ) then
    -- ADR 0011: no combined cross-competition scoring path. A tournament has
    -- `score_events` and a different scoring model entirely.
    return jsonb_build_object('outcome', 'refused', 'reason', 'not_a_league_season');
  end if;

  if not pg_try_advisory_xact_lock(hashtextextended(p_tournament_id::text, 0)) then
    return jsonb_build_object('outcome', 'busy');
  end if;

  for v_round in
    select round.id, round.round_key
      from public.competition_rounds round
     where round.tournament_id = p_tournament_id
       and round.kind = 'league_matchweek'
     order by round.ordinal
  loop
    v_card := predictor_internal.season_matchweek_card(v_round.id);

    -- A matchweek with no fixtures is not a matchweek that happened. The
    -- resolver would call an empty card settled with a denominator of zero,
    -- which is true and useless: writing rows for it would tell `standings.ts`
    -- that every player played a matchweek in which nothing was scheduled.
    -- `resolveCardAtLock` refuses an empty matchweek for the same reason.
    if jsonb_array_length(v_card) = 0 then
      delete from public.season_matchweek_scores
       where competition_round_id = v_round.id;
      get diagnostics v_scored = row_count;
      v_cleared := v_cleared + v_scored;
      v_skipped := v_skipped || jsonb_build_object(
        'round', v_round.round_key, 'reason', 'no_fixtures');
      continue;
    end if;

    v_resolved := predictor_internal.resolve_matchweek_settlement(v_card);

    -- Unreachable from this table, and deliberately still handled. Every one of
    -- the resolver's six refusals is made unconstructible by a constraint:
    -- `season_fixtures_scores_match_status` for the two score contradictions,
    -- contract 92's two replay CHECKs for the replay pair, the primary key for
    -- a duplicate, and the status CHECK for invalid input. Should any of those
    -- ever be relaxed, this reports a stuck matchweek rather than settling
    -- around data it cannot read — and it does NOT delete the stored rows,
    -- because a card that cannot be read is not evidence that a previously
    -- settled total was wrong.
    if not coalesce((v_resolved->>'ok')::boolean, false) then
      v_skipped := v_skipped || jsonb_build_object(
        'round', v_round.round_key,
        'reason', 'contradictory_card',
        'detail', v_resolved->>'reason');
      continue;
    end if;

    v_settlement := v_resolved->'settlement';
    v_denominator := (v_settlement->>'matchesPlayedDenominator')::integer;

    -- Not settled, or settled with nothing actually played — an all-void
    -- matchweek, whose denominator is zero by contract 91's own rule. Either
    -- way there is no matchweek to count, so any stored rows go: this is the
    -- backwards direction described in the header.
    if not coalesce((v_settlement->>'settled')::boolean, false) then
      delete from public.season_matchweek_scores
       where competition_round_id = v_round.id;
      get diagnostics v_scored = row_count;
      v_cleared := v_cleared + v_scored;
      v_skipped := v_skipped || jsonb_build_object(
        'round', v_round.round_key, 'reason', 'not_settled');
      continue;
    end if;

    if v_denominator = 0 then
      delete from public.season_matchweek_scores
       where competition_round_id = v_round.id;
      get diagnostics v_scored = row_count;
      v_cleared := v_cleared + v_scored;
      v_skipped := v_skipped || jsonb_build_object(
        'round', v_round.round_key, 'reason', 'nothing_played');
      continue;
    end if;

    delete from public.season_matchweek_scores
     where competition_round_id = v_round.id;

    -- `fixtures_scored` takes the matches-played DENOMINATOR, not a count of
    -- fixtures on the card. On a settled card the two are equal — the only
    -- dispositions left are scoreable, void and carried, and the denominator
    -- excludes exactly the latter two — but they are equal as a consequence of
    -- contract 91's rule rather than by definition, so the denominator is what
    -- is stored and `144_season_matchweek_scoring_job.sql` asserts the equality
    -- holds rather than assuming it.
    insert into public.season_matchweek_scores (
      tournament_id, entry_id, competition_round_id,
      points, joker_applied, fixtures_scored
    )
    select
      p_tournament_id,
      banked.entry_id,
      v_round.id,
      predictor_internal.season_matchweek_points(banked.entry_id, v_round.id),
      exists (
        select 1 from public.season_matchweek_jokers joker
         where joker.entry_id = banked.entry_id
           and joker.competition_round_id = v_round.id
      ),
      v_denominator
    from (
      -- The LATEST outcome per entry: a rescheduled matchweek is a different
      -- lock, and the lock that stood is the one that counts.
      select distinct on (outcome_row.entry_id)
             outcome_row.entry_id,
             outcome_row.outcome
        from public.season_matchweek_submission_outcomes outcome_row
       where outcome_row.competition_round_id = v_round.id
       order by outcome_row.entry_id, outcome_row.locks_at desc
    ) banked
    where banked.outcome = 'submitted';

    get diagnostics v_scored = row_count;
    v_written := v_written + v_scored;
    v_settled_rounds := v_settled_rounds + 1;
  end loop;

  return jsonb_build_object(
    'outcome', 'settled',
    'settledRounds', v_settled_rounds,
    'scoresWritten', v_written,
    'scoresCleared', v_cleared,
    'skipped', v_skipped);
end;
$$;

revoke all on function predictor_internal.settle_season_matchweek_scores(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The tick.
--
-- Per-season exception handling, so one season's contradiction cannot stop
-- every other season scoring — the same isolation contract 89's driver applies
-- per competition.
-- ---------------------------------------------------------------------------

create or replace function public.process_due_season_matchweek_scores()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season record;
  v_result jsonb;
  v_attempted integer := 0;
  v_settled integer := 0;
  v_busy integer := 0;
  v_failed integer := 0;
  v_written integer := 0;
  v_cleared integer := 0;
begin
  -- Every league season, every run, with no "already scored" filter. That is
  -- the same decision contract 89 made and for the same reason: a filter on
  -- prior completion would make the job unable to reach the matchweek a
  -- correction has just changed. Full rederivation is what makes corrections
  -- work at all, and it is cheap — one settled matchweek is one integer per
  -- banked entry.
  for v_season in
    select t.id from public.tournaments t
     where t.kind = 'league_season'
     order by t.id
  loop
    v_attempted := v_attempted + 1;

    begin
      v_result := predictor_internal.settle_season_matchweek_scores(v_season.id);

      if v_result->>'outcome' = 'settled' then
        v_settled := v_settled + 1;
        v_written := v_written + coalesce((v_result->>'scoresWritten')::integer, 0);
        v_cleared := v_cleared + coalesce((v_result->>'scoresCleared')::integer, 0);
      elsif v_result->>'outcome' = 'busy' then
        v_busy := v_busy + 1;
      end if;
    exception when others then
      v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object(
    'attempted', v_attempted,
    'settled', v_settled,
    'busy', v_busy,
    'failed', v_failed,
    'scoresWritten', v_written,
    'scoresCleared', v_cleared);
end;
$$;

-- Revoked from `service_role` as well as the browser roles. Not because this
-- job needs a privileged session identity — unlike contract 89's, it does not —
-- but because nothing yet defines what an operator-triggered recompute means
-- for a player watching a total change under them. An admin path is its own
-- decision with its own authority, not a grant added because it would work.
revoke all on function public.process_due_season_matchweek_scores()
  from public, anon, authenticated, service_role;

-- Hourly at :30, deliberately offset from the LMS settlement at :00. The two
-- take different advisory locks and could not deadlock, but they read
-- overlapping tables and there is no reason to have them contend every hour on
-- the same minute.
select cron.schedule(
  'season-settle-due-matchweek-scores',
  '30 * * * *',
  'select public.process_due_season_matchweek_scores();'
);

commit;
