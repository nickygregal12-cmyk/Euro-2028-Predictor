-- Contract 191: a weekly-season standing row becomes a player you can address.
--
-- ---------------------------------------------------------------------------
-- THE DEFECT, MEASURED ON CONTRACT 190
-- ---------------------------------------------------------------------------
--
-- `get_season_leaderboard` (contract 95) builds each row from `displayName`,
-- `points`, `rank`, `matchweeksPlayed`, `tied`, `position` and `isYou`, and
-- `get_season_leaderboard_neighbourhood` (contract 183) copies that shape and
-- adds `pointsFromYou`. Neither carries an identifier of any kind.
--
-- So the GLOBAL weekly table is the one standings surface on the platform whose
-- rows cannot be opened. `get_season_league_standings` (contract 128) returns
-- `userId` per row and `get_season_player_profile` (contract 151) admits a
-- private-league co-member, so a PRIVATE league row already leads somewhere.
-- The global row leads nowhere — not because a rule refuses it, but because
-- there is no address.
--
-- That is recorded in the vNext model as `PlayerReach = 'profile' | 'name-only'`
-- with the global table pinned to `name-only`, and its comment says the honest
-- thing: "this is not a permission that could be widened in the frontend — it
-- is an address that does not exist." This contract creates the address.
--
-- ---------------------------------------------------------------------------
-- WHAT IS *NOT* DONE HERE, AND WHY IT MATTERS MOST
-- ---------------------------------------------------------------------------
--
-- **No visibility rule is widened.** Two rules already exist and both are kept
-- exactly as their contracts decided them:
--
--   * PROFILE — contract 151 took `MIG-UI-02`'s recommended boundary unvaried:
--     identity is visible to PRIVATE-LEAGUE CO-MEMBERS on this season, and to
--     nobody else. Sharing a competition season is not enough.
--
--   * COMPARISON — contract 129 deliberately chose a different and wider rule
--     for the one-matchweek head-to-head, and argued it in its own header:
--     "It is deliberately NOT `get_rival_entry`'s shared-league rule, and the
--     reason is that the season leaderboard already shows every entrant to
--     every entrant." Both players must hold an entry in the season, and the
--     matchweek must have locked.
--
-- Those two are not in conflict; they answer different questions, which is the
-- same reconciliation ADR 0025 § 4 reached for Appendix D.2 and contract 95.
-- What was missing is that neither was ADDRESSABLE from the global table, so
-- contract 129's accepted rule has been unreachable for anyone who is not
-- already a league co-member. Making an accepted rule reachable is implementing
-- it, not widening it — and this migration adds no third rule.
--
-- Whether a same-season participant should also be able to read another
-- participant's PROFILE is a product decision that no accepted authority takes.
-- It is registered as `PROF-001` rather than decided here.
--
-- ---------------------------------------------------------------------------
-- ONE VISIBILITY AUTHORITY, NOT TWO
-- ---------------------------------------------------------------------------
--
-- `predictor_internal.season_player_reach` is the single implementation of
-- "what may this caller do with that player, in this season". Contract 151's
-- profile read is REDEFINED to call it rather than to carry its own copy of the
-- co-membership `exists`, so the leaderboard and the profile cannot drift into
-- disagreeing about who may be opened. Behaviour is unchanged: the same message
-- and the same SQLSTATE refuse the same callers.
--
-- `predictor_internal.assert_single_season_player_visibility_authority()`
-- refuses an installation in which anything OTHER than that function decides a
-- season profile boundary by joining `league_members` to itself, which is the
-- shape a second copy would take. It follows contract 182's guard exactly, for
-- the same reason: a rule that lives in two functions is a rule that will be
-- changed in one.
--
-- ---------------------------------------------------------------------------
-- THE IDENTIFIER IS THE ENTRY, NOT THE USER
-- ---------------------------------------------------------------------------
--
-- `playerRef` is `entries.id`. It is canonical (contract 94's standings key is
-- already this column), it is SEASON-SCOPED by `entries unique (user_id,
-- tournament_id)`, and it is not an authentication identifier — so two entrants
-- who share Premier League 2026/27 and Scottish Premiership 2026/27 cannot be
-- correlated across them by anyone reading either table.
--
-- `playerId` — the `auth.users` identifier the existing profile read and route
-- are keyed on — is emitted ONLY where `reach` is `self` or `profile`. That is
-- exactly the set of callers who can already obtain it today from
-- `get_season_league_standings`, so no identifier reaches anyone who could not
-- already read it. A `compare` row carries the ref and no user id.
--
-- No email, phone, auth metadata or invite code appears in any of this. There
-- is no directory: every function here answers about a season the caller holds
-- an entry in, and `resolve_season_player` answers about ONE named ref.
--
-- ---------------------------------------------------------------------------
-- BOUNDED
-- ---------------------------------------------------------------------------
--
-- `season_player_reach` is evaluated in the PAGE projection only — never inside
-- `ordered`, which spans the whole field. A leaderboard page is at most 100
-- rows and a neighbourhood at most 21, so the co-membership probe runs a
-- bounded number of times per request and the page's ordering, cursor and rank
-- arithmetic are untouched.
--
-- Nothing is written. No score, settlement, standing, rank or prediction.

begin;

-- ---------------------------------------------------------------------------
-- The one visibility authority.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_player_reach(
  p_tournament_id uuid,
  p_viewer_id uuid,
  p_player_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $reach$
  select case
    when p_tournament_id is null or p_viewer_id is null or p_player_id is null
      then 'none'

    -- A player may always reach themselves. Contract 151 already returns an
    -- unlocked matchweek to its owner, because those are their own picks.
    when p_viewer_id = p_player_id then 'self'

    -- Contract 151's boundary, moved here unchanged: a shared PRIVATE LEAGUE
    -- on THIS season. Entering the same competition season is not consent to
    -- be looked up.
    when exists (
      select 1
        from public.league_members mine
        join public.league_members theirs on theirs.league_id = mine.league_id
        join public.leagues league on league.id = mine.league_id
       where mine.user_id = p_viewer_id
         and theirs.user_id = p_player_id
         and league.tournament_id = p_tournament_id
    ) then 'profile'

    -- Contract 129's boundary, moved here unchanged: both hold an entry in the
    -- season. It grants COMPARISON and not profile disclosure, and the
    -- comparison reads impose their own per-matchweek reveal boundary on top —
    -- this function decides who, never when.
    when exists (
      select 1 from public.entries viewer_entry
       where viewer_entry.tournament_id = p_tournament_id
         and viewer_entry.user_id = p_viewer_id
    ) and exists (
      select 1 from public.entries player_entry
       where player_entry.tournament_id = p_tournament_id
         and player_entry.user_id = p_player_id
    ) then 'compare'

    else 'none'
  end;
$reach$;

comment on function predictor_internal.season_player_reach(uuid, uuid, uuid) is
  'Contract 191. The sole authority for what one weekly-season participant may '
  'do with another: self, profile (contract 151''s shared private league), '
  'compare (contract 129''s shared season entry) or none. It decides WHO, never '
  'WHEN — every reveal boundary stays with the read that owns it. Nothing else '
  'may implement a season profile boundary; '
  'assert_single_season_player_visibility_authority() refuses an installation '
  'where something does.';

revoke all on function predictor_internal.season_player_reach(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The guard that keeps it single.
--
-- Contract 182's shape. It fires on the CONJUNCTION that a second copy would
-- have — deciding a season profile/comparison boundary by self-joining
-- `league_members` while scoping to a season's leagues — rather than banning
-- `league_members` outright, which would be deleted by the next person who
-- legitimately needs league membership for something else.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.assert_single_season_player_visibility_authority()
returns void
language plpgsql
stable
set search_path = ''
as $guard$
declare
  v_offender text;
begin
  select string_agg(format('%s.%s', n.nspname, p.proname), ', ' order by p.proname)
    into v_offender
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'predictor_internal')
     and p.proname not in (
       'season_player_reach',
       'assert_single_season_player_visibility_authority'
     )
     -- The self-join that decides "do we share a private league"...
     and p.prosrc like '%league_members%'
     and p.prosrc like '%theirs.user_id%'
     -- ...scoped to one competition season, which is what makes it this rule
     -- rather than an ordinary membership check.
     and p.prosrc like '%league.tournament_id = p_tournament_id%';

  if v_offender is not null then
    raise exception
      'Contract 191: % implements the season player visibility rule beside predictor_internal.season_player_reach',
      v_offender
      using errcode = '23514';
  end if;
end;
$guard$;

comment on function predictor_internal.assert_single_season_player_visibility_authority() is
  'Contract 191. Refuses any installed function other than season_player_reach '
  'that decides a season profile boundary by self-joining league_members within '
  'one competition season. A rule that lives in two functions is a rule that '
  'will be changed in one.';

revoke all on function predictor_internal.assert_single_season_player_visibility_authority()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Contract 151's profile read, calling the authority instead of copying it.
--
-- Redefined from its own committed text with the boundary block replaced —
-- the method contracts 118 and 128 established. Message, SQLSTATE, ordering,
-- payload and every reveal rule below the boundary are byte-identical to
-- contract 151; only the four lines that decided WHO have moved.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_player_profile(
  p_tournament_id uuid,
  p_player_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $profile$
declare
  v_uid uuid := (select auth.uid());
  v_kind text;
  v_reach text;
  v_is_self boolean;
  v_entry uuid;
  v_display text;
  v_standings jsonb;
  v_season jsonb;
  v_accuracy jsonb;
  v_history jsonb;
  v_jokers jsonb;
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
    raise exception 'That competition is not a league season; use the tournament player reads'
      using errcode = '22023';
  end if;

  -- Contract 191. The boundary is unchanged and is no longer stated here: only
  -- `self` and `profile` may read a profile, and `profile` still means a shared
  -- private league on this season. `compare` is contract 129's comparison grant
  -- and is deliberately NOT enough to open a profile.
  v_reach := predictor_internal.season_player_reach(p_tournament_id, v_uid, p_player_id);
  v_is_self := (v_reach = 'self');

  if v_reach not in ('self', 'profile') then
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

  -- A co-member who never entered the game is a real answer, not an error: they
  -- are in the league and have no season.
  if v_entry is null then
    return jsonb_build_object(
      'player', jsonb_build_object(
        'user_id', p_player_id, 'display_name', v_display, 'is_self', v_is_self,
        -- Contract 191. Absent rather than null-shaped: a player with no entry
        -- has no season-scoped address, which is exactly what `entered: false`
        -- already says.
        'player_ref', null, 'reach', v_reach),
      'entered', false, 'server_now', now(),
      'season', null, 'accuracy', null, 'jokers', null, 'history', '[]'::jsonb);
  end if;

  -- Banked season totals, from the authority the season and the leagues use.
  v_standings := predictor_internal.season_standings(p_tournament_id);

  select jsonb_build_object(
           'points', standing.points,
           'matchweeks_played', standing.matchweeks_played,
           'rank', standing.season_rank,
           'field_size', standing.field_size)
    into v_season
    from (
      select (row ->> 'entryId')::uuid as entry_id,
             (row ->> 'points')::integer as points,
             (row ->> 'matchweeksPlayed')::integer as matchweeks_played,
             -- Contract 191 note: this is contract 94's own rank, read from the
             -- payload rather than recomputed. It used to be a local
             -- `rank() over (order by points desc)` — identical arithmetic, but
             -- a second expression of it. Taking the stored value removes the
             -- copy without changing a single answer.
             (row ->> 'rank')::integer as season_rank,
             count(*) over ()::integer as field_size
        from jsonb_array_elements(coalesce(v_standings, '[]'::jsonb)) row) standing
   where standing.entry_id = v_entry;

  -- Accuracy, counted over settled matchweeks only. Counting is not scoring:
  -- no point value appears here, and the totals above are never recomputed.
  select jsonb_build_object(
           'fixtures_predicted', count(*),
           'exact_scores', count(*) filter (
             where fixture.home_score = prediction.home_score
               and fixture.away_score = prediction.away_score),
           'correct_outcomes', count(*) filter (
             where sign(fixture.home_score - fixture.away_score)
                 = sign(prediction.home_score - prediction.away_score)))
    into v_accuracy
    from public.season_predictions prediction
    join public.season_fixtures fixture on fixture.id = prediction.season_fixture_id
   where prediction.entry_id = v_entry
     and fixture.status = 'played'
     and exists (
       select 1 from public.season_matchweek_scores score
        where score.entry_id = v_entry
          and score.competition_round_id = fixture.competition_round_id);

  select jsonb_build_object(
           'played', count(*),
           'points_from_joker_matchweeks', coalesce(sum(score.points), 0))
    into v_jokers
    from public.season_matchweek_jokers joker
    left join public.season_matchweek_scores score
      on score.entry_id = joker.entry_id
     and score.competition_round_id = joker.competition_round_id
   where joker.entry_id = v_entry;

  -- History. Matchweeks whose own lock has passed, most recent first, bounded.
  -- The caller's own profile is not gated, because these are their own picks.
  select coalesce(jsonb_agg(entry order by ordinal desc), '[]'::jsonb)
    into v_history
    from (
      select round.ordinal,
             jsonb_build_object(
               'matchweek_id', round.id,
               'ordinal', round.ordinal,
               'label', round.label,
               'points', score.points,
               'joker_played', joker.entry_id is not null,
               'predictions', coalesce((
                 select jsonb_object_agg(prediction.season_fixture_id, jsonb_build_object(
                          'home', prediction.home_score,
                          'away', prediction.away_score))
                   from public.season_predictions prediction
                   join public.season_fixtures fixture
                     on fixture.id = prediction.season_fixture_id
                  where prediction.entry_id = v_entry
                    and fixture.competition_round_id = round.id), '{}'::jsonb)
             ) as entry
        from public.competition_rounds round
        left join public.season_matchweek_scores score
          on score.competition_round_id = round.id and score.entry_id = v_entry
        left join public.season_matchweek_jokers joker
          on joker.competition_round_id = round.id and joker.entry_id = v_entry
       where round.tournament_id = p_tournament_id
         and (
           v_is_self
           or predictor_internal.season_matchweek_lock_at(p_tournament_id, round.id, 0)
                <= now()
         )
         and exists (
           select 1 from public.season_predictions prediction
             join public.season_fixtures fixture on fixture.id = prediction.season_fixture_id
            where prediction.entry_id = v_entry
              and fixture.competition_round_id = round.id)
       order by round.ordinal desc
       limit 40) locked;

  return jsonb_build_object(
    'player', jsonb_build_object(
      'user_id', p_player_id, 'display_name', v_display, 'is_self', v_is_self,
      -- Contract 191. The season-scoped address for this player, so a profile
      -- reached from a private-league row and one reached from the global table
      -- are provably the same player without comparing display names.
      'player_ref', v_entry, 'reach', v_reach),
    'entered', true,
    'server_now', now(),
    'season', v_season,
    'accuracy', v_accuracy,
    'jokers', v_jokers,
    'history', v_history);
end;
$profile$;

revoke all on function public.get_season_player_profile(uuid, uuid) from public, anon;
grant execute on function public.get_season_player_profile(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Contract 95's leaderboard, with an address on every row.
--
-- Redefined from its own committed text. Ordering, cursor encoding, page
-- bounds, rank, points, `totalCount`, `hasMore` and `you` are unchanged — the
-- only difference is three keys per row and two on `you`. The reach probe is
-- inside the PAGE projection, never inside `ordered`.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_leaderboard(
  p_tournament_id uuid,
  p_limit integer default 50,
  p_after text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $leaderboard$
declare
  v_uid uuid;
  v_limit integer;
  v_standings jsonb;
  v_cursor jsonb;
  v_after_position integer;
begin
  if p_tournament_id is null then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  v_standings := predictor_internal.season_standings(p_tournament_id);
  if v_standings is null then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.entries entry
     where entry.tournament_id = p_tournament_id
       and entry.user_id = v_uid
  ) then
    raise exception 'This season is not yours to read' using errcode = '42501';
  end if;

  if p_limit is null then
    v_limit := 50;
  elsif p_limit < 1 then
    raise exception 'Leaderboard page size must be at least 1' using errcode = '22023';
  else
    v_limit := least(p_limit, 100);
  end if;

  if p_after is not null and btrim(p_after) <> '' then
    begin
      v_cursor := convert_from(decode(p_after, 'hex'), 'UTF8')::jsonb;
      v_after_position := (v_cursor ->> 'position')::integer;
    exception when others then
      raise exception 'Invalid leaderboard cursor' using errcode = '22023';
    end;

    if v_after_position is null or v_after_position < 1 then
      raise exception 'Invalid leaderboard cursor' using errcode = '22023';
    end if;
  end if;

  return (
    with standing as (
      select
        (row ->> 'entryId')::uuid as entry_id,
        (row ->> 'rank')::integer as standing_rank,
        (row ->> 'points')::integer as points,
        (row ->> 'matchweeksPlayed')::integer as matchweeks_played
      from jsonb_array_elements(v_standings) row
    ),
    named as (
      select
        standing.*,
        entry.user_id,
        profile.display_name,
        lower(profile.display_name) collate "C" as sort_name,
        md5(standing.entry_id::text) as entry_key
      from standing
      join public.entries entry on entry.id = standing.entry_id
      join public.profiles profile on profile.id = entry.user_id
    ),
    ordered as (
      select
        named.*,
        row_number() over (
          order by named.standing_rank, named.sort_name,
                   named.display_name collate "C", named.entry_key
        )::integer as position,
        count(*) over (partition by named.standing_rank)::integer as same_rank_count,
        count(*) over ()::integer as total_count
      from named
    ),
    candidates as (
      select ordered.* from ordered
       where v_after_position is null or ordered.position > v_after_position
       order by ordered.position
       limit v_limit + 1
    ),
    page_rows as (
      select candidate.*,
             -- Contract 191. Evaluated here and nowhere earlier: `ordered`
             -- spans the whole field, and probing co-membership once per
             -- entrant would make a page of fifty cost the season.
             predictor_internal.season_player_reach(
               p_tournament_id, v_uid, candidate.user_id) as reach
        from candidates candidate
       order by candidate.position
       limit v_limit
    )
    select jsonb_build_object(
      'rows', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'displayName', row.display_name,
            'points', row.points,
            'rank', row.standing_rank,
            'matchweeksPlayed', row.matchweeks_played,
            'tied', row.same_rank_count > 1,
            'position', row.position,
            'isYou', row.user_id = v_uid,
            -- Contract 191: the season-scoped address, the server's decision
            -- about what may be done with it, and the auth identifier ONLY
            -- where a profile will actually answer.
            'playerRef', row.entry_id,
            'reach', row.reach,
            'playerId', case when row.reach in ('self', 'profile')
                             then to_jsonb(row.user_id) end)
          order by row.position)
        from page_rows row), '[]'::jsonb),
      'totalCount', coalesce((select max(total_count) from ordered), 0),
      'pageSize', v_limit,
      'hasMore', (select count(*) from candidates) > v_limit,
      'nextCursor', case
        when (select count(*) from candidates) > v_limit then (
          select encode(
            convert_to(jsonb_build_object('position', row.position)::text, 'UTF8'),
            'hex')
          from page_rows row order by row.position desc limit 1)
        else null
      end,
      'you', (
        select jsonb_build_object(
          'displayName', row.display_name,
          'points', row.points,
          'rank', row.standing_rank,
          'matchweeksPlayed', row.matchweeks_played,
          'tied', row.same_rank_count > 1,
          'position', row.position,
          'playerRef', row.entry_id,
          'reach', 'self',
          'playerId', to_jsonb(row.user_id))
        from ordered row where row.user_id = v_uid limit 1))
  );
end;
$leaderboard$;

revoke all on function public.get_season_leaderboard(uuid, integer, text)
  from public, anon;
grant execute on function public.get_season_leaderboard(uuid, integer, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Contract 183's neighbourhood, given the same address.
--
-- The two reads must agree about position — `232_season_clubs_and_neighbourhood`
-- pages the leaderboard to the same entry and requires it — so they must also
-- agree about identity. The row shape below is the leaderboard's, plus
-- `pointsFromYou`.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_leaderboard_neighbourhood(
  p_tournament_id uuid,
  p_window integer default 3
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $neighbourhood$
declare
  v_uid uuid := (select auth.uid());
  v_standings jsonb;
  v_window integer;
begin
  if p_tournament_id is null then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  v_standings := predictor_internal.season_standings(p_tournament_id);
  if v_standings is null then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.entries entry
     where entry.tournament_id = p_tournament_id
       and entry.user_id = v_uid
  ) then
    raise exception 'This season is not yours to read' using errcode = '42501';
  end if;

  v_window := least(greatest(coalesce(p_window, 3), 1), 10);

  return (
    with standing as (
      select
        (row ->> 'entryId')::uuid as entry_id,
        (row ->> 'rank')::integer as standing_rank,
        (row ->> 'points')::integer as points,
        (row ->> 'matchweeksPlayed')::integer as matchweeks_played
      from jsonb_array_elements(v_standings) row
    ),
    named as (
      select
        standing.*,
        entry.user_id,
        profile.display_name,
        lower(profile.display_name) collate "C" as sort_name,
        md5(standing.entry_id::text) as entry_key
      from standing
      join public.entries entry on entry.id = standing.entry_id
      join public.profiles profile on profile.id = entry.user_id
    ),
    ordered as (
      select
        named.*,
        row_number() over (
          order by named.standing_rank, named.sort_name,
                   named.display_name collate "C", named.entry_key
        )::integer as position,
        count(*) over (partition by named.standing_rank)::integer as same_rank_count,
        count(*) over ()::integer as total_count
      from named
    ),
    me as (
      select * from ordered where ordered.user_id = v_uid limit 1
    ),
    neighbourhood as (
      select ordered.*,
             -- Contract 191, and bounded by construction: this projection is
             -- at most 2 × 10 + 1 rows.
             predictor_internal.season_player_reach(
               p_tournament_id, v_uid, ordered.user_id) as reach
        from ordered, me
       where ordered.position between me.position - v_window
                                  and me.position + v_window
    )
    select jsonb_build_object(
      'rows', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'displayName', row.display_name,
            'points', row.points,
            'rank', row.standing_rank,
            'matchweeksPlayed', row.matchweeks_played,
            'tied', row.same_rank_count > 1,
            'position', row.position,
            'isYou', row.user_id = v_uid,
            'pointsFromYou', row.points - (select points from me),
            'playerRef', row.entry_id,
            'reach', row.reach,
            'playerId', case when row.reach in ('self', 'profile')
                             then to_jsonb(row.user_id) end)
          order by row.position)
        from neighbourhood row), '[]'::jsonb),
      'you', (
        select jsonb_build_object(
          'displayName', me.display_name,
          'points', me.points,
          'rank', me.standing_rank,
          'matchweeksPlayed', me.matchweeks_played,
          'tied', me.same_rank_count > 1,
          'position', me.position,
          'playerRef', me.entry_id,
          'reach', 'self',
          'playerId', to_jsonb(me.user_id))
        from me),
      'window', v_window,
      'totalCount', coalesce((select max(total_count) from ordered), 0),
      'atTop', (select position from me) - v_window <= 1,
      'atBottom', (select position from me) + v_window
                  >= coalesce((select max(total_count) from ordered), 0))
  );
end;
$neighbourhood$;

revoke all on function public.get_season_leaderboard_neighbourhood(uuid, integer)
  from public, anon;
grant execute on function public.get_season_leaderboard_neighbourhood(uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- One ref in, one permitted destination or an explicit refusal out.
--
-- The leaderboard already tells a page what it may do with each row, so this is
-- not on the hot path and is not an N+1 partner to it. It exists for the case a
-- surface holds ONLY a ref — a deep link, a restored URL, a payload that
-- outlived its page — and must not be answered by guessing.
--
-- It is not a directory: it takes one ref, in one season the caller already
-- holds an entry in, and refuses anything it cannot place.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_season_player(
  p_tournament_id uuid,
  p_player_ref uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $resolve$
declare
  v_uid uuid := (select auth.uid());
  v_kind text;
  v_player uuid;
  v_display text;
  v_reach text;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_tournament_id is null or p_player_ref is null then
    raise exception 'A competition season and a player reference are required'
      using errcode = '22023';
  end if;

  select season.kind into v_kind
    from public.tournaments season where season.id = p_tournament_id;

  if v_kind is null or v_kind <> 'league_season' then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  -- Contract 95's boundary, in contract 95's order: the caller's standing in
  -- this season is established before any name is read, so the refusing path
  -- touches no display name.
  if not exists (
    select 1 from public.entries entry
     where entry.tournament_id = p_tournament_id
       and entry.user_id = v_uid
  ) then
    raise exception 'This season is not yours to read' using errcode = '42501';
  end if;

  -- The ref is season-scoped, so a ref from another season is simply not found
  -- here. That is the whole point of keying on the entry rather than the user.
  select entry.user_id into v_player
    from public.entries entry
   where entry.id = p_player_ref
     and entry.tournament_id = p_tournament_id;

  if v_player is null then
    raise exception 'That player is not in this competition season'
      using errcode = 'no_data_found';
  end if;

  v_reach := predictor_internal.season_player_reach(p_tournament_id, v_uid, v_player);

  -- Explicit refusal rather than a null-shaped answer. `none` cannot arise from
  -- a leaderboard row — every row in that table is an entrant, so every row is
  -- at least `compare` — but it can arise from a stale link, and a surface that
  -- received an empty object would have to guess whether it meant "gone" or
  -- "not allowed".
  if v_reach = 'none' then
    raise exception 'You may not view that player' using errcode = '42501';
  end if;

  select profile.display_name into v_display
    from public.profiles profile where profile.id = v_player;

  return jsonb_build_object(
    'playerRef', p_player_ref,
    'reach', v_reach,
    'displayName', v_display,
    -- Same rule as the leaderboard: the auth identifier only where the profile
    -- destination will answer.
    'playerId', case when v_reach in ('self', 'profile') then to_jsonb(v_player) end,
    'canViewProfile', v_reach in ('self', 'profile'),
    'canCompare', v_reach in ('self', 'profile', 'compare'),
    'server_now', now());
end;
$resolve$;

comment on function public.resolve_season_player(uuid, uuid) is
  'Contract 191. One season-scoped player reference in; the permitted '
  'destination or an explicit refusal out. Not a directory: it answers about '
  'one ref, in one season the caller holds an entry in, and cannot enumerate.';

revoke all on function public.resolve_season_player(uuid, uuid)
  from public, anon, service_role;
grant execute on function public.resolve_season_player(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The other two copies of the same rule, consolidated onto the authority.
--
-- MEASURED, NOT ASSUMED: contract 151 was not the only place this rule lived.
-- `set_pinned_rival` (contract 157) and `get_season_prediction_dna`
-- (contract 176) each carry their own copy of the same three-table self-join,
-- and both say in their own comments that they are reusing contract 151's
-- boundary — which was true in intent and false in mechanism. Three copies of
-- one privacy rule is three places to change it and two places to forget.
--
-- Both are redefined from their committed text, EXTRACTED PROGRAMMATICALLY
-- rather than retyped, with only the boundary block replaced. Every message,
-- SQLSTATE, payload key and downstream rule is unchanged, and both keep the
-- narrower `profile` requirement rather than gaining `compare`: a pin and a
-- prediction-DNA read are profile disclosure, not a matchweek comparison.
-- ---------------------------------------------------------------------------

create or replace function public.set_pinned_rival(
  p_tournament_id uuid,
  p_rival_user_id uuid,
  p_pinned boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $rival$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if not p_pinned then
    delete from public.pinned_rivals
     where user_id = v_uid and tournament_id = p_tournament_id
       and rival_user_id = p_rival_user_id;
    return jsonb_build_object('pinned', false);
  end if;

  if p_rival_user_id = v_uid then
    raise exception 'You cannot pin yourself as a rival' using errcode = '23514';
  end if;

  -- A pin is a note to self about somebody the caller can ALREADY see.
  -- Contract 151 decided who that is — a private-league co-member — and
  -- contract 191 moved that decision into one function. Only `profile` may be
  -- pinned: `compare` is contract 129’s comparison grant, and a pin that
  -- worked on any same-season entrant would be user discovery by another name.
  if predictor_internal.season_player_reach(
       p_tournament_id, v_uid, p_rival_user_id) <> 'profile' then
    raise exception 'You can only pin a rival you share a private league with'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.pinned_rivals (user_id, tournament_id, rival_user_id)
  values (v_uid, p_tournament_id, p_rival_user_id)
  on conflict do nothing;

  return jsonb_build_object('pinned', true);
end;
$rival$;

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

  -- Contract 191. The third copy of contract 151’s boundary, replaced by the
  -- one authority. Behaviour is unchanged: `self` and `profile` pass, and
  -- `compare` — contract 129’s same-season comparison grant — does not,
  -- because prediction DNA is profile disclosure and not a matchweek
  -- comparison.
  v_is_self := (p_player_id = v_uid);
  v_shares_league := predictor_internal.season_player_reach(
    p_tournament_id, v_uid, p_player_id) = 'profile';

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

revoke all on function public.set_pinned_rival(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_pinned_rival(uuid, uuid, boolean) to authenticated;

revoke all on function public.get_season_prediction_dna(uuid, uuid) from public, anon;
grant execute on function public.get_season_prediction_dna(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_profile text := pg_get_functiondef(
    'public.get_season_player_profile(uuid, uuid)'::regprocedure);
  v_reach text := pg_get_functiondef(
    'predictor_internal.season_player_reach(uuid, uuid, uuid)'::regprocedure);
  v_leaderboard text := pg_get_functiondef(
    'public.get_season_leaderboard(uuid, integer, text)'::regprocedure);
  v_neighbourhood text := pg_get_functiondef(
    'public.get_season_leaderboard_neighbourhood(uuid, integer)'::regprocedure);
  v_resolve text := pg_get_functiondef(
    'public.resolve_season_player(uuid, uuid)'::regprocedure);
begin
  -- The guard must hold against the catalogue this migration has just built,
  -- including contract 151's redefinition. Run before anything else, because a
  -- failure here means the repository already holds two authorities.
  perform predictor_internal.assert_single_season_player_visibility_authority();

  -- Contract 151's boundary moved rather than vanished: the shared-private-
  -- league test is in the authority, and the profile calls it.
  if v_reach !~ 'league_members' or v_reach !~ 'league.tournament_id = p_tournament_id' then
    raise exception 'The visibility authority must gate profile on a shared private league';
  end if;

  if v_profile !~ 'season_player_reach' then
    raise exception 'The profile read must take its boundary from the visibility authority';
  end if;

  -- And it must still refuse `compare`. A profile opened by any same-season
  -- entrant is the widening this contract explicitly does not take.
  if v_profile !~ 'not in \(''self'', ''profile''\)' then
    raise exception 'The profile read must refuse a compare-only viewer';
  end if;

  -- Prediction detail is still gated on the matchweek's own lock, server-resolved.
  if v_profile !~ 'season_matchweek_lock_at' then
    raise exception 'Prediction history must be gated on the matchweek lock';
  end if;

  if v_profile ~ 'p_now|p_as_of' or v_resolve ~ 'p_now|p_as_of' then
    raise exception 'A reveal boundary must not accept a client-supplied time';
  end if;

  -- The auth identifier is conditional in every read that emits one.
  if v_leaderboard !~ 'reach in \(''self'', ''profile''\)'
     or v_neighbourhood !~ 'reach in \(''self'', ''profile''\)'
     or v_resolve !~ 'v_reach in \(''self'', ''profile''\)' then
    raise exception 'The auth identifier must be conditional on a profile-capable reach';
  end if;

  -- The reach probe must not be inside the full-field CTE. `ordered` spans the
  -- whole season; a probe there turns a fifty-row page into a season-sized
  -- membership scan. Asserted by POSITION rather than by a regex spanning the
  -- CTEs, because a pattern wide enough to reach across them also matches the
  -- legitimate occurrence and would pass on the very implementation it exists
  -- to refuse.
  if position('candidates as (' in v_leaderboard) = 0
     or position('season_player_reach' in v_leaderboard) = 0
     or position('season_player_reach' in v_leaderboard)
        < position('candidates as (' in v_leaderboard) then
    raise exception 'The reach probe must not run over the whole field';
  end if;

  -- No read here may enumerate. Each takes a season plus at most one player.
  if pg_catalog.array_length(
       (select proargnames from pg_proc where oid =
          'public.resolve_season_player(uuid, uuid)'::regprocedure), 1) <> 2 then
    raise exception 'The resolver must take exactly a season and one reference';
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
     where routine_schema = 'public'
       and routine_name in (
         'resolve_season_player', 'get_season_player_profile',
         'get_season_leaderboard', 'get_season_leaderboard_neighbourhood')
       and grantee in ('anon', 'PUBLIC')
  ) then
    raise exception 'No season identity read may be executable anonymously';
  end if;
end;
$$;

commit;
