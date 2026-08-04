-- Contract 95: the bounded season leaderboard read.
--
-- The first season surface anything outside the database can reach. Contracts
-- 90 to 94 built scores, settlement, the replay link, the job and the ranking,
-- and a player could see none of it: every one of those functions is
-- `predictor_internal` and revoked from every browser role.
--
-- ---------------------------------------------------------------------------
-- IT CALLS CONTRACT 94 RATHER THAN RECOMPUTING
-- ---------------------------------------------------------------------------
--
-- The ranking arithmetic is not repeated here. `season_standings` is the SQL
-- counterpart to `computeSeasonStandings`, held in step by a differential sweep
-- of 600 seasons, and a read that recomputed the same totals with its own
-- `rank()` would be a second implementation that the parity suite does not
-- guard. It would also make contract 94 a function with no caller, which is the
-- exact pattern that let season scoring sit unwritten for twenty contracts
-- while "Main Predictor scoring has a PostgreSQL counterpart" stayed true.
--
-- ---------------------------------------------------------------------------
-- THE DISPLAY ORDER DELIBERATELY DIFFERS FROM THE PARITY ORDER
-- ---------------------------------------------------------------------------
--
-- `season_standings` orders tied rows by entry id, because the TypeScript
-- authority does and the arrays have to match. An entry id is a UUID, so that
-- ordering is meaningless to a human — it would put tied players in an order
-- that changes for no visible reason.
--
-- This read therefore re-sorts ties by display name, mirroring the tournament
-- leaderboard. What must NOT differ is `rank` and `points`: those come straight
-- from contract 94 and are never recomputed here. The divergence is presentation
-- only, and stating it plainly matters — a later reader comparing the two
-- functions' array orders would otherwise find a real difference and have to
-- guess whether it was a bug.
--
-- ---------------------------------------------------------------------------
-- WHO MAY READ IT, WHICH IS NOT THE TOURNAMENT'S ANSWER
-- ---------------------------------------------------------------------------
--
-- `public.get_leaderboard` lets any authenticated user read any tournament's
-- table, and that is defensible there: the tournament is the one competition
-- everybody in the application is in, so its leaderboard exposes no
-- relationship that did not already exist.
--
-- A season is not. Premier League 2026/27 and Scottish Premiership 2026/27
-- already exist side by side, and a player in one has no relationship with the
-- players in the other. Copying the tournament's grant would publish display
-- names across unrelated leagues, which is precisely the boundary the platform
-- states: other players' data is limited to authenticated league co-members.
--
-- So the caller must hold an entry in the season they are asking about. That is
-- the boundary applied, not a new rule invented — and it fails closed, because
-- a caller with no entry is refused rather than shown an empty table.

begin;

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
as $$
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

  -- NULL rather than an empty array is contract 94's answer for anything that
  -- is not a league season, so this distinguishes "not a season" from "a season
  -- with nobody in it" without a second lookup.
  v_standings := predictor_internal.season_standings(p_tournament_id);
  if v_standings is null then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  -- The boundary. Checked AFTER the season is known to exist so that a
  -- non-member and a nonexistent season are not distinguishable by error
  -- code — but before any row is read, so no display name is touched on the
  -- refusing path.
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

    -- Deliberately overlapping with the handler above. Replacing the handler's
    -- raise with `v_after_position := null` does not open a hole, because this
    -- catches the null — mutation testing confirmed that as an equivalent
    -- mutant, and confirmed the layering is real by removing BOTH, which fails.
    -- Two guards, because a cursor silently reinterpreted as page one repeats
    -- rows a caller has already seen and looks like a UI bug rather than a
    -- rejected input.
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
        -- `collate "C"` for the same reason the tournament leaderboard uses it:
        -- a locale-dependent sort makes the page a caller sees depend on the
        -- database's collation, and a cursor issued under one ordering would
        -- page through a different one.
        lower(profile.display_name) collate "C" as sort_name,
        -- Final separator, so two players with identical display names still
        -- have a total order and pagination cannot loop or skip.
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
      select candidate.* from candidates candidate
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
            -- Shown beside points because ADR 0012 pairs them: two players on
            -- 84 from 22 and 23 matchweeks are not tied in meaning.
            'matchweeksPlayed', row.matchweeks_played,
            'tied', row.same_rank_count > 1,
            'position', row.position,
            'isYou', row.user_id = v_uid)
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
      -- The caller's own row, whatever page they asked for. Without it a player
      -- ranked 60th has to page through the table to find themselves, which is
      -- the thing a bounded read exists to avoid.
      'you', (
        select jsonb_build_object(
          'displayName', row.display_name,
          'points', row.points,
          'rank', row.standing_rank,
          'matchweeksPlayed', row.matchweeks_played,
          'tied', row.same_rank_count > 1,
          'position', row.position)
        from ordered row where row.user_id = v_uid limit 1))
  );
end;
$$;

revoke all on function public.get_season_leaderboard(uuid, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_season_leaderboard(uuid, integer, text)
  to authenticated;

commit;
