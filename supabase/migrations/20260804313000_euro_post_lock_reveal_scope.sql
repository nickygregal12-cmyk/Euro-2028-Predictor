-- ---------------------------------------------------------------------------
-- Contract 101 — Euro post-lock reveal stops gating on shared leagues.
--
-- ADR 0025 decision 4, code half. The documentation half landed with the ADR;
-- this is the append-only backend change Appendix D.2 asks for.
--
-- D.2, as restated by ADR 0025: "Remove shared-league membership as the general
-- gate for frozen Euro Original Predictor entry and profile reveal after lock.
-- This does not alter season-leaderboard entrant scoping under contract 95 or
-- league-context match-pick reads."
--
-- ---------------------------------------------------------------------------
-- THREE FUNCTIONS, AND THEY ARE NOT THE SAME SHAPE
-- ---------------------------------------------------------------------------
--
-- `get_rival_entry` and `get_h2h_rank_history` both already refuse EVERY caller
-- before lock — "hidden until entries lock" — and then apply a second,
-- shared-league gate on top. For those two the league gate is purely post-lock
-- gating, so it is removed outright and the authoritative server-side lock
-- becomes the only gate. Pre-lock behaviour is unchanged: still refused, for
-- everyone.
--
-- `get_player_profile` is NOT that shape, and treating it as though it were
-- would have been a privacy regression rather than a reveal. It has **no lock
-- gate on access at all**: the lock only decides whether total points and rank
-- are appended to the payload. Its access gate is shared-league membership
-- alone. Simply deleting that gate would have exposed display name, league
-- count and entry status to any authenticated caller **before** lock — and D.2
-- authorises the reveal *after* lock, while nothing authorises widening access
-- before it.
--
-- So `get_player_profile` GAINS a lock condition as it loses the league one:
-- post-lock, any authenticated player may view the profile; pre-lock, the
-- existing shared-league gate is kept verbatim. Co-membership stops being the
-- *general* gate, which is what D.2 asks, without changing what anyone could
-- see before lock.
--
-- ---------------------------------------------------------------------------
-- WHAT IS DELIBERATELY NOT TOUCHED
-- ---------------------------------------------------------------------------
--
--   * `get_league_match_picks` — D.2 is explicit that league-context match-pick
--     reads stay league scoped, and it is untouched.
--   * `public.get_season_leaderboard` (contract 95) — ADR 0025 confirms this is
--     a different scope with no conflict. It gates on holding an `entries` row
--     in that competition season, never on co-membership, so it was never an
--     instance of the drift D.2 describes. Not touched, and not weakened.
--   * `get_league`, `get_league_members`, `get_league_preview`, `join_league`,
--     and the rest of the league-management surface. Those gate league
--     membership because they ARE league features, which is a different thing
--     from using league membership as a proxy for "may see a frozen entry".
--   * every authentication check. Anonymous access is not opened anywhere.
--
-- The tournament lock is read server-side from `tournaments.lock_at` in all
-- three functions, which is the authoritative gate D.2 requires stay mandatory.
-- Nothing here trusts a client-supplied instant.
-- ---------------------------------------------------------------------------

begin;

CREATE OR REPLACE FUNCTION public.get_player_profile(p_player_id uuid, p_tournament_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_lock_at timestamptz;
  v_locked boolean;
  v_display_name text;
  v_league_count integer := 0;
  v_entry_id uuid;
  v_has_entry boolean := false;
  v_total_points integer := 0;
  v_rank integer;
  v_base jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select tournament.lock_at
    into v_lock_at
    from public.tournaments tournament
    where tournament.id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found'
      using errcode = 'no_data_found';
  end if;

  select profile.display_name
    into v_display_name
    from public.profiles profile
    where profile.id = p_player_id;

  if v_display_name is null then
    raise exception 'Player not found'
      using errcode = 'no_data_found';
  end if;

  -- ADR 0025 decision 4. Once the tournament has locked, every entry is frozen
  -- and any authenticated player may view another player's profile: shared-league
  -- membership is no longer the gate.
  --
  -- BEFORE lock it still is. D.2 authorises the reveal "after lock", and nothing
  -- authorises widening pre-lock access, so the old gate is kept verbatim on that
  -- branch rather than removed outright. The lock is read from the tournament
  -- server-side, which is the authoritative gate D.2 requires stay mandatory.
  if p_player_id <> v_uid
     and not (v_lock_at is not null and now() >= v_lock_at)
     and not exists (
    select 1
    from public.league_members caller_membership
    join public.leagues league
      on league.id = caller_membership.league_id
     and league.tournament_id = p_tournament_id
    join public.league_members player_membership
      on player_membership.league_id = caller_membership.league_id
     and player_membership.user_id = p_player_id
    where caller_membership.user_id = v_uid
  ) then
    raise exception 'Other players'' profiles are hidden until entries lock'
      using errcode = 'insufficient_privilege';
  end if;

  select count(*)::integer
    into v_league_count
    from public.league_members membership
    join public.leagues league on league.id = membership.league_id
    where membership.user_id = p_player_id
      and league.tournament_id = p_tournament_id;

  select entry.id, entry.submitted_at is not null
    into v_entry_id, v_has_entry
    from public.entries entry
    where entry.user_id = p_player_id
      and entry.tournament_id = p_tournament_id;

  v_has_entry := coalesce(v_has_entry, false);
  v_locked := v_lock_at is not null and now() >= v_lock_at;

  v_base := jsonb_build_object(
    'player_id', p_player_id,
    'display_name', v_display_name,
    'league_count', v_league_count,
    'has_entry', v_has_entry,
    'locked', v_locked,
    'lock_at', v_lock_at
  );

  if not v_locked or not v_has_entry then
    return v_base;
  end if;

  select coalesce(total.total_points, 0)
    into v_total_points
    from public.entry_totals total
    where total.entry_id = v_entry_id;

  v_total_points := coalesce(v_total_points, 0);

  select ranked.rank
    into v_rank
    from (
      select
        entry.user_id,
        rank() over (
          order by coalesce(total.total_points, 0) desc
        )::integer as rank
      from public.entries entry
      left join public.entry_totals total on total.entry_id = entry.id
      where entry.tournament_id = p_tournament_id
        and entry.submitted_at is not null
    ) ranked
    where ranked.user_id = p_player_id;

  return v_base || jsonb_build_object(
    'total_points', v_total_points,
    'rank', v_rank,
    'group_matches', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'match_id', bounded.match_id,
            'home_score', bounded.home_score,
            'away_score', bounded.away_score,
            'joker', bounded.joker
          )
          order by bounded.match_ref, bounded.match_id
        )
        from (
          select
            prediction.match_id,
            prediction.home_score,
            prediction.away_score,
            prediction.joker,
            match.match_ref
          from public.match_predictions prediction
          join public.matches match on match.id = prediction.match_id
          where prediction.entry_id = v_entry_id
            and match.tournament_id = p_tournament_id
            and match.round = 'group'
          order by match.match_ref, prediction.match_id
          limit 36
        ) bounded
      ),
      '[]'::jsonb
    ),
    'progression', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'team_id', bounded.team_id,
            'stage', bounded.stage
          )
          order by bounded.team_id
        )
        from (
          select progression.team_id, progression.stage
          from public.predicted_progression progression
          join public.teams team on team.id = progression.team_id
          where progression.entry_id = v_entry_id
            and team.tournament_id = p_tournament_id
          order by progression.team_id
          limit 24
        ) bounded
      ),
      '[]'::jsonb
    ),
    'score_events', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', bounded.id,
            'category', bounded.category,
            'points', bounded.points,
            'joker', bounded.joker,
            'explanation', bounded.explanation
          )
          order by bounded.category, bounded.created_at, bounded.id
        )
        from (
          select
            event.id,
            event.category,
            event.points,
            event.joker,
            event.explanation,
            event.created_at
          from public.score_events event
          where event.entry_id = v_entry_id
          order by event.category, event.created_at, event.id
          limit 100
        ) bounded
      ),
      '[]'::jsonb
    )
  );
end;
$function$

;

CREATE OR REPLACE FUNCTION public.get_rival_entry(p_rival_id uuid, p_tournament_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_lock timestamptz;
  v_entry uuid;
  v_out jsonb;
begin
  select tournament.lock_at
    into v_lock
    from public.tournaments tournament
    where tournament.id = p_tournament_id;

  if v_lock is null or now() < v_lock then
    raise exception 'Other players'' predictions are hidden until entries lock'
      using errcode = 'insufficient_privilege';
  end if;

  -- ADR 0025 decision 4: the shared-league gate is removed. Authentication is
  -- still required, and the lock check above already refused every caller
  -- before lock — so what remains is exactly the reveal D.2 describes: a frozen
  -- entry, visible to any authenticated player.
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select entry.id
    into v_entry
    from public.entries entry
    where entry.user_id = p_rival_id
      and entry.tournament_id = p_tournament_id
      and entry.submitted_at is not null;

  if v_entry is null then
    raise exception 'That player has not submitted an entry'
      using errcode = 'no_data_found';
  end if;

  select jsonb_build_object(
    'display_name', (
      select profile.display_name
      from public.profiles profile
      where profile.id = p_rival_id
    ),
    'total_points', coalesce(
      (
        select total.total_points
        from public.entry_totals total
        where total.entry_id = v_entry
      ),
      0
    ),
    'group_matches', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'match_id', bounded.match_id,
            'home_score', bounded.home_score,
            'away_score', bounded.away_score,
            'joker', bounded.joker
          )
          order by bounded.match_ref, bounded.match_id
        )
        from (
          select
            prediction.match_id,
            prediction.home_score,
            prediction.away_score,
            prediction.joker,
            match.match_ref
          from public.match_predictions prediction
          join public.matches match
            on match.id = prediction.match_id
          where prediction.entry_id = v_entry
            and match.tournament_id = p_tournament_id
            and match.round = 'group'
          order by match.match_ref, prediction.match_id
          limit 36
        ) bounded
      ),
      '[]'::jsonb
    ),
    'progression', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'team_id', bounded.team_id,
            'stage', bounded.stage
          )
          order by bounded.team_id
        )
        from (
          select progression.team_id, progression.stage
          from public.predicted_progression progression
          join public.teams team
            on team.id = progression.team_id
          where progression.entry_id = v_entry
            and team.tournament_id = p_tournament_id
          order by progression.team_id
          limit 24
        ) bounded
      ),
      '[]'::jsonb
    )
  ) into v_out;

  return v_out;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.get_h2h_rank_history(p_rival_id uuid, p_tournament_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_lock_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select tournament.lock_at
    into v_lock_at
    from public.tournaments tournament
    where tournament.id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found'
      using errcode = 'no_data_found';
  end if;

  if v_lock_at is null or now() < v_lock_at then
    raise exception 'Head-to-head rank history is hidden until entries lock'
      using errcode = 'insufficient_privilege';
  end if;

  -- ADR 0025 decision 4: the shared-league gate is removed here too. The lock
  -- check above already refused every caller before lock, and authentication is
  -- enforced at the top of the function.

  return jsonb_build_object(
    'you', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'key', bounded.matchday_key,
            'order', bounded.matchday_ord,
            'rank', bounded.rank,
            'total_points', bounded.total_points,
            'captured_at', bounded.captured_at
          )
          order by bounded.matchday_ord
        )
        from (
          select
            history.matchday_key,
            history.matchday_ord,
            history.rank,
            history.total_points,
            history.captured_at
          from public.rank_history history
          where history.user_id = v_uid
            and history.tournament_id = p_tournament_id
          order by history.matchday_ord
          limit 7
        ) bounded
      ),
      '[]'::jsonb
    ),
    'rival', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'key', bounded.matchday_key,
            'order', bounded.matchday_ord,
            'rank', bounded.rank,
            'total_points', bounded.total_points,
            'captured_at', bounded.captured_at
          )
          order by bounded.matchday_ord
        )
        from (
          select
            history.matchday_key,
            history.matchday_ord,
            history.rank,
            history.total_points,
            history.captured_at
          from public.rank_history history
          where history.user_id = p_rival_id
            and history.tournament_id = p_tournament_id
          order by history.matchday_ord
          limit 7
        ) bounded
      ),
      '[]'::jsonb
    )
  );
end;
$function$

;

commit;
