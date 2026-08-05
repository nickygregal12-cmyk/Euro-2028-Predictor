-- Contract 118: the games hub stops being blind to a season's fixtures.
--
-- `get_bonus_games` is the games hub listing — the first read a player meets in
-- a competition. Its per-window `fixtures` block joined `bonus_window_fixtures`
-- to `public.matches` with NO branch on competition kind, so for a season
-- competition it returned `fixtures: []`.
--
-- WHAT THAT COSTS, traced rather than guessed. Empty fixtures make
-- `deriveWindowFixtureAggregate` report `total: 0`. `resolveCompetitionStatus`
-- treats a window as settled only when `total > 0 and confirmed >= total`,
-- which can never hold at zero, and `activeWindowOf` picks the first window
-- that has locked and not settled. So a season competition's FIRST LOCKED
-- ROUND stays "in flight" permanently: the hub card sticks on it, showing a
-- stale round and a stale deadline, and never advances. `round_live` and
-- `round_awaiting_confirmation` are unreachable for a season for the same
-- reason.
--
-- THIS IS THE FOURTH INSTANCE OF ONE DEFECT and the pattern is now named:
-- contract 86 (the LMS selection trigger), contract 98 (three Cup RPCs),
-- contract 116 (the LMS round read), and this. Every one was a function
-- written for the tournament, defined once, and never widened; every one
-- failed SILENTLY, returning an empty set rather than an error.
-- `168_tournament_only_browser_reads.sql` exists so the fifth is caught by CI,
-- and this migration is the reason its `get_bonus_games` entry can be deleted.
--
-- THE APPROACH IS CONTRACT 98'S, NOT A NEW ONE. That contract generalised the
-- Cup RPC layer by extracting tournament and season fact functions and a
-- neutral combiner, and it deliberately did not branch on competition kind: a
-- window is served by exactly one limb, so a union takes whichever has rows and
-- cannot get the choice wrong. The same shape is used here.
--
-- THE VOCABULARY MAPPING IS CONTRACT 77'S, NOT A NEW ONE EITHER. A tournament
-- match records `result_state in ('scheduled', 'confirmed', 'corrected')`; a
-- season fixture records `status in ('scheduled', 'played', 'postponed',
-- 'abandoned', 'void')`. Contract 77 already settled that these are "different
-- vocabularies for the same question", answering "has this fixture finished?"
-- with `result_state in ('confirmed','corrected')` for a tournament and
-- `status = 'played'` for a season — and proved the equivalence with a
-- 400-scenario differential harness. So `played` maps to `confirmed` here on an
-- established authority rather than on a judgement made in this file.
--
-- Every other season status maps to `scheduled`. That is a total mapping rather
-- than a lossy one: the target vocabulary has three values and no way to say
-- "postponed", so nothing is discarded that it could have expressed. What the
-- hub does with the value is decide whether a fixture has finished, and a
-- postponed fixture has not.

-- ---------------------------------------------------------------------------
-- The two limbs and the neutral combiner.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.bonus_tournament_window_fixture_facts(
  p_window_id uuid
)
returns table (fixture_id uuid, kickoff_at timestamptz, result_state text)
language sql
stable
security definer
set search_path = ''
as $$
  select match.id, match.kickoff_at, match.result_state
    from public.bonus_window_fixtures window_fixture
    join public.matches match on match.id = window_fixture.match_id
   where window_fixture.window_id = p_window_id
$$;

create or replace function predictor_internal.bonus_season_window_fixture_facts(
  p_window_id uuid
)
returns table (fixture_id uuid, kickoff_at timestamptz, result_state text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    fixture.id,
    fixture.kickoff_at,
    -- Contract 77's equivalence, in the direction this caller needs.
    case when fixture.status = 'played' then 'confirmed' else 'scheduled' end
    from public.season_cup_window_fixtures link
    join public.season_fixtures fixture on fixture.id = link.season_fixture_id
   where link.window_id = p_window_id
$$;

-- Union, not a branch: a window's fixtures live in exactly one source, so the
-- other limb contributes no rows and the combiner cannot pick wrong. Contract
-- 98 made the same choice for the Cup facts, for the same reason.
create or replace function predictor_internal.bonus_window_fixture_facts(
  p_window_id uuid
)
returns table (fixture_id uuid, kickoff_at timestamptz, result_state text)
language sql
stable
security definer
set search_path = ''
as $$
  select * from predictor_internal.bonus_tournament_window_fixture_facts(p_window_id)
  union all
  select * from predictor_internal.bonus_season_window_fixture_facts(p_window_id)
$$;

revoke all on function predictor_internal.bonus_tournament_window_fixture_facts(uuid)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.bonus_season_window_fixture_facts(uuid)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.bonus_window_fixture_facts(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The caller, redefined to read the neutral facts.
--
-- The body below is contract 104's definition with ONLY the fixtures subquery
-- changed — 12 lines, verified by diffing the redefinition against the text of
-- `20260805001000_live_competition_callers.sql` before it was written here.
-- That check is deliberate: contract 114 redefined a function from an older
-- migration's text and silently reverted contract 104's work, and Database
-- parity caught it. Nothing else in this function — the guards, the ordering,
-- the entrant block, the bounds — differs by a character.
-- ---------------------------------------------------------------------------

create or replace function public.get_bonus_games(
  p_tournament_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.tournaments tournament
    where tournament.id = p_tournament_id
  ) then
    raise exception 'Tournament not found'
      using errcode = 'no_data_found';
  end if;

  return jsonb_build_object(
    'server_now', now(),
    'competitions', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', competition.id,
            'game_key', competition.game_key,
            'registration_opens_at', competition.registration_opens_at,
            'registration_closes_at', competition.registration_closes_at,
            'draw_required', competition.draw_required,
            'draw_completed_at', competition.draw_completed_at,
            'completed_at', competition.completed_at,
            'entrant', (
              select jsonb_build_object(
                'joined_at', entrant.joined_at,
                'outcome', entrant.outcome
              )
              from public.bonus_competition_entrants entrant
              where entrant.competition_id = competition.id
                and entrant.user_id = v_uid
            ),
            'windows', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', bounded_window.id,
                    'sequence', bounded_window.sequence,
                    'label', bounded_window.label,
                    'opens_at', bounded_window.opens_at,
                    'locks_at', bounded_window.locks_at,
                    'settles_at', bounded_window.settles_at,
                    'requires_tie_break_input', bounded_window.requires_tie_break_input,
                    'fixtures', coalesce(
                      (
                        select jsonb_agg(
                          jsonb_build_object(
                            'kickoff_at', bounded_fixture.kickoff_at,
                            'result_state', bounded_fixture.result_state
                          )
                          order by
                            bounded_fixture.kickoff_at nulls last,
                            bounded_fixture.match_id
                        )
                        from (
                          select facts.kickoff_at, facts.result_state,
                                 facts.fixture_id as match_id
                          from predictor_internal.bonus_window_fixture_facts(
                                 bounded_window.id
                               ) facts
                          order by facts.kickoff_at nulls last, facts.fixture_id
                          limit 16
                        ) bounded_fixture
                      ),
                      '[]'::jsonb
                    )
                  )
                  order by bounded_window.sequence
                )
                from (
                  select
                    competition_window.id,
                    competition_window.sequence,
                    competition_window.label,
                    competition_window.opens_at,
                    competition_window.locks_at,
                    competition_window.settles_at,
                    competition_window.requires_tie_break_input
                  from public.bonus_competition_windows competition_window
                  where competition_window.competition_id = competition.id
                  order by competition_window.sequence
                  limit 12
                ) bounded_window
              ),
              '[]'::jsonb
            )
          )
          order by competition.game_key
        )
        from (
          select *
          from public.bonus_competitions candidate
          where candidate.tournament_id = p_tournament_id
            and candidate.id = predictor_internal.current_public_competition_id(
              p_tournament_id, candidate.game_key
            )
            and candidate.published
          order by candidate.game_key
          limit 6
        ) competition
      ),
      '[]'::jsonb
    )
  );
end;
$$;
