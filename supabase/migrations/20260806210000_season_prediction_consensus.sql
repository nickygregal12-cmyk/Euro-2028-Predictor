-- Contract 130: what everybody else predicted, for one season matchweek.
--
-- ---------------------------------------------------------------------------
-- THE GAP
-- ---------------------------------------------------------------------------
--
-- `get_prediction_consensus` answers this for the tournament, and every fact in
-- it is the tournament's: `match_predictions` over `public.matches`,
-- `predicted_progression`, `entries.submitted_at`, and one season-wide
-- `tournaments.lock_at`. A competition season writes none of them.
--
-- ---------------------------------------------------------------------------
-- KEYED ON THE ROUND, NOT ON THE SEASON
-- ---------------------------------------------------------------------------
--
-- This is the whole difference, and it is not cosmetic. The tournament's
-- consensus is a single answer for a single lock instant — one reveal for the
-- whole competition. A season locks per matchweek and runs for nine months, so
-- "the season's consensus" is not a thing that exists. Matchweek 4 being open
-- says nothing about matchweek 3, and a function that took only a season would
-- have to pick one of them silently.
--
-- So the signature carries the matchweek, the reveal is that matchweek's own
-- lock derived by `predictor_internal.season_matchweek_lock_at`, and the cohort
-- counted is the cohort that predicted THAT matchweek. A null lock — a round
-- whose fixture list has incomplete kickoffs — hides rather than reveals, for
-- contract 129's reason: the picks are final either way, and declining to show
-- them costs nothing while revealing on a null would expose a season whose
-- kickoffs were never published.
--
-- ---------------------------------------------------------------------------
-- THE MINIMUM COHORT IS THE TOURNAMENT'S, AND IS MEASURED PER MATCHWEEK
-- ---------------------------------------------------------------------------
--
-- Ten, the same number contract 61 chose, because the protection is the same
-- one: below it, a distribution is close enough to naming individuals. It is
-- reused rather than re-decided.
--
-- What it counts is different, and has to be. The tournament counts submitted
-- entries in the tournament; this counts ENTRIES THAT PREDICTED THIS
-- MATCHWEEK. A season with fifty entrants of whom six played matchweek 30 is
-- exactly the case the rule exists for, and a season-wide count would report it
-- as safe.
--
-- Suppression RETURNS rather than raises, matching the tournament shape, so a
-- caller can say "6 of 10 needed" instead of handling an error.
--
-- Nothing is written, and no individual is named: the read returns counts per
-- scoreline and never a user, an entry or a display name.

begin;

create or replace function public.get_season_prediction_consensus(
  p_tournament_id uuid,
  p_matchweek integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $consensus$
declare
  v_ctx record;
  v_buffer integer;
  v_locks_at timestamptz;
  v_cohort integer;
  v_minimum constant integer := 10;
begin
  -- Contract 114's resolver: authentication, the matchweek's round and the
  -- caller's own entry.
  select * into v_ctx
    from predictor_internal.season_card_context(p_tournament_id, p_matchweek);

  -- Contract 95's boundary. A season is not the one competition everybody is
  -- in, so the caller must hold an entry in the season they are asking about.
  perform predictor_internal.require_season_entry(v_ctx.o_entry_id);

  select definition.buffer_minutes into v_buffer
    from public.game_definitions definition
   where definition.game_key = 'main_predictor';

  v_locks_at := predictor_internal.season_matchweek_lock_at(
    p_tournament_id, v_ctx.o_round_id, v_buffer
  );

  if v_locks_at is null or now() < v_locks_at then
    raise exception 'Prediction consensus is hidden until the matchweek locks'
      using errcode = '42501';
  end if;

  -- The cohort for THIS matchweek. See the header for why not the season's.
  select count(distinct prediction.entry_id)::integer into v_cohort
    from public.season_predictions prediction
    join public.season_fixtures fixture
      on fixture.id = prediction.season_fixture_id
   where fixture.competition_round_id = v_ctx.o_round_id;

  if v_cohort < v_minimum then
    return jsonb_build_object(
      'suppressed', true,
      'reason', 'not_enough_entries',
      'matchweek', p_matchweek,
      'minimum_entries', v_minimum,
      'submitted_entries', v_cohort,
      'locked_at', v_locks_at,
      'server_now', now(),
      'fixtures', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'suppressed', false,
    'matchweek', p_matchweek,
    'minimum_entries', v_minimum,
    'submitted_entries', v_cohort,
    'locked_at', v_locks_at,
    'server_now', now(),
    'fixtures', (
      select coalesce(jsonb_agg(fixture_row order by fixture_row ->> 'id'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', fixture.id,
          'kickoff_at', fixture.kickoff_at,
          'home_name', home_team.name,
          'away_name', away_team.name,
          'result_home', case when fixture.status = 'played' then fixture.home_score end,
          'result_away', case when fixture.status = 'played' then fixture.away_score end,
          'predicted', (
            select count(*)::integer from public.season_predictions p
             where p.season_fixture_id = fixture.id
          ),
          -- Outcome shares, which is the fact a player reads first. Derived
          -- from the predicted scoreline rather than stored, because no
          -- authority stores a predicted outcome.
          'home_win', (
            select count(*)::integer from public.season_predictions p
             where p.season_fixture_id = fixture.id and p.home_score > p.away_score
          ),
          'draw', (
            select count(*)::integer from public.season_predictions p
             where p.season_fixture_id = fixture.id and p.home_score = p.away_score
          ),
          'away_win', (
            select count(*)::integer from public.season_predictions p
             where p.season_fixture_id = fixture.id and p.home_score < p.away_score
          ),
          -- The most-picked scorelines. Bounded at five: a distribution is a
          -- summary, and an unbounded list of every distinct scoreline in a
          -- large cohort is a different thing that nobody asked for.
          'top_scores', (
            select coalesce(jsonb_agg(
              jsonb_build_object(
                'home', top.home_score,
                'away', top.away_score,
                'picks', top.picks)
              order by top.picks desc, top.home_score, top.away_score
            ), '[]'::jsonb)
            from (
              select p.home_score, p.away_score, count(*)::integer as picks
                from public.season_predictions p
               where p.season_fixture_id = fixture.id
               group by p.home_score, p.away_score
               order by count(*) desc, p.home_score, p.away_score
               limit 5
            ) top
          )
        ) as fixture_row
        from public.season_fixtures fixture
        join public.teams home_team on home_team.id = fixture.home_team_id
        join public.teams away_team on away_team.id = fixture.away_team_id
        where fixture.competition_round_id = v_ctx.o_round_id
      ) rows
    )
  );
end;
$consensus$;

revoke all on function public.get_season_prediction_consensus(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_season_prediction_consensus(uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
begin
  -- No individual is named. The tournament consensus has the same property and
  -- states it in prose; here it is asserted, because the read joins `profiles`
  -- nowhere and must keep not doing so.
  if (
    select pg_catalog.pg_get_functiondef(to_regprocedure(
      'public.get_season_prediction_consensus(uuid, integer)'))
  ) like '%public.profiles%' then
    raise exception 'the season consensus read must name no individual';
  end if;
end;
$$;

commit;
