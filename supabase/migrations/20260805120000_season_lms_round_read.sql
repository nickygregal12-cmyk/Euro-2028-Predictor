-- Contract 116: let a season Last Man Standing entrant SEE their round.
--
-- Contract 86 made a season LMS pick possible. It fixed the write: the
-- selection-shape trigger read `bonus_window_fixtures` joined to
-- `public.matches` — the tournament fixture link — so every season pick was
-- refused with "The picked team does not play in this round", including an
-- ordinary player picking a club that was genuinely playing.
--
-- THE READ WAS NEVER WIDENED, and it has the identical defect. `get_my_lms`
-- resolves a window's fixtures through `bonus_window_fixtures -> public.matches`
-- unconditionally, so for a season competition it returns rounds whose fixture
-- arrays are empty. A player can save a pick they cannot see the fixtures for.
-- That asymmetry is this contract: the write already works, only the read is
-- missing.
--
-- WHY A NEW FUNCTION RATHER THAN WIDENING `get_my_lms`. The two fixture sources
-- do not merely join differently, they record outcome differently. A tournament
-- match carries `result_state` and `winner_team_id`; a season fixture carries
-- `status` with scores and no winner column. A widened function would return
-- both shapes with one half always null, and the caller would have to decide
-- what "survived" means from raw scores — putting a survival authority in the
-- browser, which the settlement job owns. This function answers the survival
-- question server-side instead, through the same
-- `predictor_internal.season_lms_pick_outcome` the settlement replay uses, so
-- the surface and the ledger can never disagree about a round.
--
-- ONE ROUND, DELIBERATELY. A season runs ~38 windows; a read that returned all
-- of them with their fixtures would be unbounded in the way contract 114's card
-- read was written to avoid. The surface is a weekly selection, so this returns
-- the round the player can act on — the earliest window not yet locked, or the
-- latest window when the season has finished locking — plus the entry state and
-- the used-club list that decide what may be picked in it. History and
-- standings are separate reads and do not belong here.
--
-- NOTHING ABOUT ANY OTHER ENTRANT. No other player's pick, survival or count
-- appears in the payload, so no reveal question arises: there is nothing to
-- reveal. The caller's own entry is the entire subject.

-- ---------------------------------------------------------------------------
-- Which window the player is being shown, and why that one.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_lms_current_window(
  p_competition_id uuid,
  p_now timestamptz
)
returns uuid
language sql
stable
set search_path = ''
as $$
  -- The round still open to a pick wins: `locks_at` in the future, nulls last
  -- so an unscheduled window never outranks a scheduled one. When every window
  -- has locked the season is over for picking, and the player is shown the last
  -- one rather than nothing, so a finished competition still renders its ending.
  select coalesce(
    (
      select w.id
        from public.bonus_competition_windows w
       where w.competition_id = p_competition_id
         and w.locks_at is not null
         and w.locks_at > p_now
       order by w.locks_at, w.sequence
       limit 1
    ),
    (
      select w.id
        from public.bonus_competition_windows w
       where w.competition_id = p_competition_id
       order by w.sequence desc
       limit 1
    )
  );
$$;

revoke all on function predictor_internal.season_lms_current_window(uuid, timestamptz)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The caller's own round.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_lms_round(
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
  v_now timestamptz := now();
  v_competition_id uuid;
  v_window_id uuid;
  v_outcome text;
  v_cycle smallint;
begin
  if p_tournament_id is null then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  -- Same resolver `get_my_lms` uses. It delegates to
  -- `predictor_internal.live_competition_id`, which contract 104 made the one
  -- place a live competition is chosen; 155_live_competition_callers pins that
  -- delegation, so routing through this helper keeps the guard satisfied
  -- rather than opening a second resolution path.
  select competition.id
    into v_competition_id
    from public.bonus_competitions competition
   where competition.tournament_id = p_tournament_id
     and competition.game_key = 'last_man_standing'
     and competition.id = predictor_internal.current_public_competition_id(
           p_tournament_id, 'last_man_standing'
         )
     and competition.published;

  -- No published competition is not an error: a season that has not launched
  -- its Last Man Standing yet is an ordinary state for a surface to render.
  if v_competition_id is null then
    return jsonb_build_object(
      'available', false,
      'entered', false,
      'entry_outcome', null,
      'used_cycle', 0,
      'used_team_ids', '[]'::jsonb,
      'window', null
    );
  end if;

  select entrant.outcome
    into v_outcome
    from public.bonus_competition_entrants entrant
   where entrant.competition_id = v_competition_id
     and entrant.user_id = v_uid;

  -- A caller with no entry still sees the round. They cannot pick in it — the
  -- write refuses a non-entrant — but showing the fixtures is how a player
  -- decides whether to join, and none of it is anyone else's data.
  if v_outcome is null then
    v_cycle := 0;
  else
    v_cycle := predictor_internal.lms_current_used_cycle(v_competition_id, v_uid);
  end if;

  v_window_id := predictor_internal.season_lms_current_window(v_competition_id, v_now);

  return jsonb_build_object(
    'available', true,
    'entered', v_outcome is not null,
    'entry_outcome', v_outcome,
    'used_cycle', v_cycle,
    -- Already a jsonb array of team-id strings, ordered by when each was
    -- consumed, and already scoped to the caller's current cycle — the reset
    -- ADR 0013 mandates means the full history is the wrong list to show.
    'used_team_ids',
      case
        when v_outcome is null then '[]'::jsonb
        else predictor_internal.lms_used_team_ids(v_competition_id, v_uid)
      end,
    'window',
      case
        when v_window_id is null then null
        else (
          select jsonb_build_object(
            'id', w.id,
            'sequence', w.sequence,
            'label', w.label,
            'opens_at', w.opens_at,
            'locks_at', w.locks_at,
            'settles_at', w.settles_at,
            'selection',
              (
                select jsonb_build_object(
                  'team_id', sel.team_id,
                  -- Echoed by the client on its next write so the shared
                  -- enforce_write_version trigger can refuse a stale save with
                  -- PT409, exactly as the season card does.
                  'version', sel.version
                )
                  from public.bonus_lms_selections sel
                 where sel.competition_id = v_competition_id
                   and sel.user_id = v_uid
                   and sel.window_id = w.id
              ),
            -- The survival answer, decided by the same function the settlement
            -- replay folds over. Null until the player has picked, or when the
            -- picked club has no fixture in the round at all — which the
            -- settlement treats as a contradiction rather than a postponement,
            -- so this reports it as unknown rather than inventing a verdict.
            'pick_outcome',
              (
                select predictor_internal.season_lms_pick_outcome(
                         p_tournament_id, w.id, sel.team_id
                       )
                  from public.bonus_lms_selections sel
                 where sel.competition_id = v_competition_id
                   and sel.user_id = v_uid
                   and sel.window_id = w.id
              ),
            'fixtures', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'season_fixture_id', bounded.id,
                    'kickoff_at', bounded.kickoff_at,
                    'status', bounded.status,
                    'home_score', bounded.home_score,
                    'away_score', bounded.away_score,
                    'home', jsonb_build_object(
                      'team_id', bounded.home_team_id, 'name', bounded.home_name
                    ),
                    'away', jsonb_build_object(
                      'team_id', bounded.away_team_id, 'name', bounded.away_name
                    )
                  )
                  order by bounded.kickoff_at nulls last, bounded.id
                )
                from (
                  select
                    fixture.id, fixture.kickoff_at, fixture.status,
                    fixture.home_score, fixture.away_score,
                    fixture.home_team_id, fixture.away_team_id,
                    home.name as home_name, away.name as away_name
                    from public.season_cup_window_fixtures link
                    join public.season_fixtures fixture
                      on fixture.id = link.season_fixture_id
                     and fixture.tournament_id = p_tournament_id
                    join public.teams home
                      on home.tournament_id = p_tournament_id
                     and home.id = fixture.home_team_id
                    join public.teams away
                      on away.tournament_id = p_tournament_id
                     and away.id = fixture.away_team_id
                   where link.window_id = w.id
                   order by fixture.kickoff_at nulls last, fixture.id
                   -- A league round is ten fixtures; the cap is the same
                   -- belt-and-braces bound `get_my_lms` applies, not a rule.
                   limit 16
                ) bounded
              ),
              '[]'::jsonb
            )
          )
            from public.bonus_competition_windows w
           where w.id = v_window_id
        )
      end
  );
end;
$$;

revoke all on function public.get_season_lms_round(uuid) from public, anon, authenticated;
grant execute on function public.get_season_lms_round(uuid) to authenticated;

comment on function public.get_season_lms_round(uuid) is
  'Contract 116. The caller''s own season Last Man Standing round: the window '
  'they can act on, its fixtures from season_fixtures (which get_my_lms cannot '
  'see), their pick with its version, and the server''s survival verdict for '
  'that pick. Nothing about any other entrant.';
