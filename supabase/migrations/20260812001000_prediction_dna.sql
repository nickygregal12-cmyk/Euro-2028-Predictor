-- ---------------------------------------------------------------------------
-- Contract 176 — INNOV-002: how a player predicts, computed once and in one
-- place.
--
-- Promoted from the Innovation Lab register by the owner authorisation of
-- 12 August 2026 and recorded in ADR 0027.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS A SERVER CONTRACT AND NOT A BROWSER DERIVATION
-- ---------------------------------------------------------------------------
--
-- Every metric below is derivable in a browser from rows a player may already
-- read. That is exactly the problem: derived in three places it becomes three
-- numbers, and a player told their exact-score rate is 12% on one route and 14%
-- on another has no way to know which is wrong. The denominators are the whole
-- feature, so they are defined once, here, and returned WITH every rate.
--
-- ---------------------------------------------------------------------------
-- THE DISCLOSURE BOUNDARY IS CONTRACT 151'S, UNCHANGED
-- ---------------------------------------------------------------------------
--
-- Self, always. Otherwise a shared PRIVATE LEAGUE on this season and nothing
-- weaker: sharing a competition is not consent to be profiled by fifty thousand
-- strangers, whereas joining someone's private league is a mutual act. There is
-- no player directory here either — it answers about one named player and
-- cannot enumerate, search or rank the population.
--
-- ---------------------------------------------------------------------------
-- THE WINDOW, AND WHY IT IS THE LOCK RATHER THAN THE RESULT
-- ---------------------------------------------------------------------------
--
-- Tendency metrics — how often this player backs a home win, what they think a
-- normal scoreline looks like — are facts about PREDICTIONS and do not need a
-- result. But a prediction in an unlocked matchweek is hidden competitive
-- information, and an average is a leak with extra steps: a player who has
-- predicted one fixture of an open matchweek would have that prediction
-- reconstructable from a mean.
--
-- So the window is every matchweek whose OWN lock has passed, for a rival and
-- for the caller alike. Uniform rather than generous-to-self on purpose: two
-- windows would make the caller's own figure disagree with the figure their
-- league-mates see of them, and "why is my exact-score rate different on their
-- screen" is a worse question than "why does this week not count yet".
--
-- Accuracy metrics narrow further to fixtures that have actually been PLAYED,
-- because a locked fixture with no result cannot be right or wrong yet.
--
-- Counting is not scoring. No point value appears anywhere in this function:
-- how often a prediction matched a result is a fact about predictions, and the
-- authority for what a matchweek was WORTH remains `season_matchweek_scores`.
--
-- ---------------------------------------------------------------------------
-- CONSENSUS AGREEMENT, AND THE COHORT THAT PROTECTS IT
-- ---------------------------------------------------------------------------
--
-- "Favourite-backing" has no authority in this repository — there are no odds,
-- and deriving a favourite from a league table as it stood at kickoff would
-- need a history nothing stores. What the platform does own is what everybody
-- else predicted, so the metric is stated as what it actually measures:
-- agreement with the field, and success when disagreeing with it.
--
-- A fixture contributes only when at least ten entries predicted it — contract
-- 61's cohort, reused rather than re-chosen — and only when one outcome is
-- strictly the most predicted. A tie between outcomes is not a consensus, and
-- is excluded rather than resolved, so "contrarian" never means "disagreed with
-- a coin toss". Fixtures below the cohort are reported as excluded rather than
-- silently dropped.
--
-- ---------------------------------------------------------------------------
-- SAMPLE SIZE IS RETURNED, NOT ASSUMED
-- ---------------------------------------------------------------------------
--
-- Every block carries its own denominator and a `sufficient` flag against the
-- same minimum of ten. A player three matchweeks into their first season gets
-- honest small numbers and a false flag, never a confident-looking rate over
-- four predictions.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- The window, as one authority.
--
-- A set-returning function rather than a temporary table: this read is
-- `stable`, and a function that creates a relation cannot be run inside a
-- read-only transaction, which is where a bounded analytical read most belongs.
-- Every block below reads from here, so "counted" has one definition.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_dna_window(
  p_entry_id uuid,
  p_tournament_id uuid
)
returns table (
  season_fixture_id uuid,
  home_team_id uuid,
  away_team_id uuid,
  predicted_home smallint,
  predicted_away smallint,
  result_home smallint,
  result_away smallint,
  played boolean
)
language sql
stable
set search_path = ''
as $window$
  select
    fixture.id,
    fixture.home_team_id,
    fixture.away_team_id,
    prediction.home_score,
    prediction.away_score,
    fixture.home_score,
    fixture.away_score,
    fixture.status = 'played' and fixture.home_score is not null
  from public.season_predictions prediction
  join public.season_fixtures fixture on fixture.id = prediction.season_fixture_id
  join public.competition_rounds round on round.id = fixture.competition_round_id
  where prediction.entry_id = p_entry_id
    and fixture.tournament_id = p_tournament_id
    -- The matchweek's OWN lock, resolved server-side. A round with no derivable
    -- lock is excluded: null is "not derivable" rather than "already open", and
    -- treating it as passed would publish an unlocked prediction.
    and predictor_internal.season_matchweek_lock_at(p_tournament_id, round.id, 0) <= now();
$window$;

revoke all on function predictor_internal.season_dna_window(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.get_season_prediction_dna(
  p_tournament_id uuid,
  p_player_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $dna$
declare
  -- One threshold, used for every `sufficient` flag and for the consensus
  -- cohort, so a reader cannot find two minimums and wonder which applies.
  c_minimum constant integer := 10;
  v_uid uuid := (select auth.uid());
  v_kind text;
  v_is_self boolean;
  v_shares_league boolean;
  v_display text;
  v_entry uuid;
  v_tendencies jsonb;
  v_accuracy jsonb;
  v_consensus jsonb;
  v_clubs jsonb;
  v_counted integer := 0;
  v_settled integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if p_tournament_id is null or p_player_id is null then
    raise exception 'A competition season and a player are required' using errcode = '22023';
  end if;

  select season.kind into v_kind
    from public.tournaments season where season.id = p_tournament_id;

  if v_kind is null then
    raise exception 'That competition season does not exist' using errcode = '22023';
  end if;

  if v_kind <> 'league_season' then
    raise exception 'That competition is not a league season' using errcode = '22023';
  end if;

  v_is_self := (p_player_id = v_uid);

  select exists (
    select 1
      from public.league_members mine
      join public.league_members theirs on theirs.league_id = mine.league_id
      join public.leagues league on league.id = mine.league_id
     where mine.user_id = v_uid
       and theirs.user_id = p_player_id
       and league.tournament_id = p_tournament_id
  ) into v_shares_league;

  if not (v_is_self or v_shares_league) then
    raise exception 'You do not share a private league with that player'
      using errcode = 'insufficient_privilege';
  end if;

  select profile.display_name into v_display
    from public.profiles profile where profile.id = p_player_id;

  if v_display is null then
    raise exception 'That player does not exist' using errcode = '22023';
  end if;

  select player_entry.id into v_entry
    from public.entries player_entry
   where player_entry.user_id = p_player_id
     and player_entry.tournament_id = p_tournament_id;

  if v_entry is null then
    -- A co-member who never entered is a real answer, not an error.
    return jsonb_build_object(
      'player', jsonb_build_object(
        'user_id', p_player_id, 'display_name', v_display, 'is_self', v_is_self),
      'entered', false,
      'server_now', now(),
      'minimum_sample', c_minimum,
      'tendencies', null, 'accuracy', null, 'consensus', null,
      'clubs', '[]'::jsonb);
  end if;

  select count(*)::integer, count(*) filter (where played)::integer
    into v_counted, v_settled
    from predictor_internal.season_dna_window(v_entry, p_tournament_id);

  -- -------------------------------------------------------------------------
  -- Tendencies. Facts about predictions; no result is involved.
  -- -------------------------------------------------------------------------
  select jsonb_build_object(
    'denominator', v_counted,
    'sufficient', v_counted >= c_minimum,
    'home_wins', count(*) filter (where predicted_home > predicted_away),
    'draws', count(*) filter (where predicted_home = predicted_away),
    'away_wins', count(*) filter (where predicted_home < predicted_away),
    'home_win_rate', case when count(*) = 0 then null else
      round(count(*) filter (where predicted_home > predicted_away)::numeric / count(*), 4) end,
    'draw_rate', case when count(*) = 0 then null else
      round(count(*) filter (where predicted_home = predicted_away)::numeric / count(*), 4) end,
    'away_win_rate', case when count(*) = 0 then null else
      round(count(*) filter (where predicted_home < predicted_away)::numeric / count(*), 4) end,
    'average_predicted_goals', case when count(*) = 0 then null else
      round(avg(predicted_home + predicted_away)::numeric, 4) end,
    'average_predicted_margin', case when count(*) = 0 then null else
      round(avg(predicted_home - predicted_away)::numeric, 4) end,
    'most_common_scoreline', (
      -- Ties broken by the lower scoreline, so two calls cannot disagree.
      select jsonb_build_object('home', top.predicted_home, 'away', top.predicted_away,
                                'count', top.uses)
        from (
          select predicted_home, predicted_away, count(*)::integer as uses
            from predictor_internal.season_dna_window(v_entry, p_tournament_id)
           group by predicted_home, predicted_away
           order by count(*) desc, predicted_home, predicted_away
           limit 1) top))
  into v_tendencies
  from predictor_internal.season_dna_window(v_entry, p_tournament_id);

  -- -------------------------------------------------------------------------
  -- Accuracy. Played fixtures only; still no point value anywhere.
  -- -------------------------------------------------------------------------
  select jsonb_build_object(
    'denominator', v_settled,
    'sufficient', v_settled >= c_minimum,
    'exact_scores', count(*) filter (
      where played and predicted_home = result_home and predicted_away = result_away),
    'correct_outcomes', count(*) filter (
      where played and sign(predicted_home - predicted_away) = sign(result_home - result_away)),
    'exact_score_rate', case when v_settled = 0 then null else
      round(count(*) filter (
        where played and predicted_home = result_home and predicted_away = result_away
      )::numeric / v_settled, 4) end,
    'correct_outcome_rate', case when v_settled = 0 then null else
      round(count(*) filter (
        where played and sign(predicted_home - predicted_away) = sign(result_home - result_away)
      )::numeric / v_settled, 4) end)
  into v_accuracy
  from predictor_internal.season_dna_window(v_entry, p_tournament_id);

  -- -------------------------------------------------------------------------
  -- Agreement with the field.
  -- -------------------------------------------------------------------------
  with mine as (
    select window_row.*
      from predictor_internal.season_dna_window(v_entry, p_tournament_id) window_row
     where window_row.played
  ),
  -- How the whole field split on each of those fixtures. One pass over the
  -- season's predictions for the fixtures this player actually played, so the
  -- cost is bounded by the player's own history rather than by the season.
  outcome_counts as (
    select
      other.season_fixture_id,
      sign(other.home_score - other.away_score) as outcome,
      count(*)::integer as backers
    from public.season_predictions other
    where other.season_fixture_id in (select season_fixture_id from mine)
    group by 1, 2
  ),
  peaks as (
    select
      season_fixture_id,
      sum(backers)::integer as entries_predicting,
      max(backers) as top_backers
    from outcome_counts
    group by season_fixture_id
  ),
  -- The most-predicted outcome, and how many outcomes tied for it. A tie is
  -- not a consensus: `tied_at_top > 1` excludes the fixture rather than
  -- picking a winner, so backing the other side is never called contrarian
  -- when the field was split down the middle.
  modal as (
    select
      counts.season_fixture_id,
      min(counts.outcome) as modal_outcome,
      count(*)::integer as tied_at_top
    from outcome_counts counts
    join peaks on peaks.season_fixture_id = counts.season_fixture_id
    where counts.backers = peaks.top_backers
    group by counts.season_fixture_id
  ),
  classified as (
    select
      mine.*,
      peaks.entries_predicting,
      modal.modal_outcome,
      modal.tied_at_top = 1 as has_strict_consensus
    from mine
    join peaks on peaks.season_fixture_id = mine.season_fixture_id
    join modal on modal.season_fixture_id = mine.season_fixture_id
  ),
  measured as (
    select
      classified.*,
      sign(classified.predicted_home - classified.predicted_away) = classified.modal_outcome
        as agreed,
      sign(classified.predicted_home - classified.predicted_away)
        = sign(classified.result_home - classified.result_away) as correct
    from classified
    where classified.entries_predicting >= c_minimum
      and classified.has_strict_consensus
  ),
  tally as (
    select
      (select count(*)::integer from measured) as measured_count,
      (select count(*)::integer from measured where agreed) as agreed_count,
      (select count(*)::integer from measured where not agreed) as against_count,
      (select count(*)::integer from measured where not agreed and correct) as against_correct,
      (select count(*)::integer from classified
        where entries_predicting < c_minimum) as small_cohort,
      (select count(*)::integer from classified
        where entries_predicting >= c_minimum and not has_strict_consensus) as no_consensus
  )
  select jsonb_build_object(
    'minimum_cohort', c_minimum,
    'settled_fixtures', v_settled,
    'measured', tally.measured_count,
    'excluded_small_cohort', tally.small_cohort,
    'excluded_no_consensus', tally.no_consensus,
    'sufficient', tally.measured_count >= c_minimum,
    'agreed_with_field', tally.agreed_count,
    'against_field', tally.against_count,
    'against_field_correct', tally.against_correct,
    'agreement_rate', case when tally.measured_count = 0 then null
      else round(tally.agreed_count::numeric / tally.measured_count, 4) end,
    'against_field_success_rate', case when tally.against_count = 0 then null
      else round(tally.against_correct::numeric / tally.against_count, 4) end)
  into v_consensus
  from tally;

  -- -------------------------------------------------------------------------
  -- Per-club tendencies. Bounded: the clubs this player has actually predicted
  -- about, most-predicted first, capped, and the cap is stated by the count.
  -- -------------------------------------------------------------------------
  select coalesce(jsonb_agg(row order by predictions desc, club_name, team_id), '[]'::jsonb)
    into v_clubs
    from (
      select
        club.team_id,
        club.club_name,
        club.predictions,
        jsonb_build_object(
          'team_id', club.team_id,
          'name', club.club_name,
          'predictions', club.predictions,
          'settled', club.settled,
          'exact_scores', club.exact_scores,
          'correct_outcomes', club.correct_outcomes,
          'predicted_to_win', club.predicted_to_win,
          'sufficient', club.settled >= c_minimum) as row
      from (
        select
          team.id as team_id,
          team.name as club_name,
          count(*)::integer as predictions,
          count(*) filter (where sides.played)::integer as settled,
          count(*) filter (
            where sides.played
              and sides.predicted_home = sides.result_home
              and sides.predicted_away = sides.result_away)::integer as exact_scores,
          count(*) filter (
            where sides.played
              and sign(sides.predicted_home - sides.predicted_away)
                = sign(sides.result_home - sides.result_away))::integer as correct_outcomes,
          count(*) filter (
            where (sides.is_home and sides.predicted_home > sides.predicted_away)
               or (not sides.is_home and sides.predicted_away > sides.predicted_home)
          )::integer as predicted_to_win
        from (
          select window_row.*, true as is_home, window_row.home_team_id as team_id
            from predictor_internal.season_dna_window(v_entry, p_tournament_id) window_row
          union all
          select window_row.*, false as is_home, window_row.away_team_id as team_id
            from predictor_internal.season_dna_window(v_entry, p_tournament_id) window_row) sides
        join public.teams team on team.id = sides.team_id
        group by team.id, team.name
        order by count(*) desc, team.name, team.id
        limit 40) club
    ) clubs;

  return jsonb_build_object(
    'player', jsonb_build_object(
      'user_id', p_player_id, 'display_name', v_display, 'is_self', v_is_self),
    'entered', true,
    'server_now', now(),
    'minimum_sample', c_minimum,
    'predictions_counted', v_counted,
    'settled_predictions', v_settled,
    'tendencies', v_tendencies,
    'accuracy', v_accuracy,
    'consensus', v_consensus,
    'clubs', v_clubs);
end;
$dna$;

revoke all on function public.get_season_prediction_dna(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_season_prediction_dna(uuid, uuid)
  to authenticated;

comment on function public.get_season_prediction_dna(uuid, uuid) is
  'Contract 176 (INNOV-002). Deterministic per-player prediction metrics over '
  'matchweeks whose own lock has passed, with every denominator returned. '
  'Contract 151''s disclosure boundary; no point value is computed and no '
  'player directory is exposed.';

commit;
