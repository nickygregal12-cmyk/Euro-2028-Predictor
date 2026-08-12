-- ---------------------------------------------------------------------------
-- Contract 183 — a season's clubs, and who is immediately above you.
--
-- `MIG-UI-16` and `MIG-UI-18`. Two bounded season reads, shipped together for
-- the reason contracts 147 and 148 were: each closes one register row, neither
-- adds a rule, and both replace a browser workaround that already exists and
-- already works — so neither is urgent alone and both are cheap together.
--
-- ---------------------------------------------------------------------------
-- `MIG-UI-16` — THE SEASON'S CLUBS, WITH THE ID AND THE IDENTITY TOGETHER
-- ---------------------------------------------------------------------------
--
-- Measured, and the measurement is the whole justification. `set_competition_follow`
-- takes a canonical `public.teams.id`, and **nothing returns a season's clubs
-- with both that id and contract 136's identity facts**:
--
--   * `public.teams` is browser-readable and holds `id` and `name`. No code, no
--     colours.
--   * `get_season_fixtures` carries the short code and the colours and
--     identifies its clubs by NAME, because a fixture entry is about the match
--     rather than about the club.
--
-- So the favourite-club picker ships as a TWO-READ JOIN in
-- `src/services/supabase/seasonClubs.ts`: ids and names from `teams`, identity
-- harvested from a fixture window and joined on the exact club name. That join
-- is exact rather than fuzzy — the fixture read takes its names from
-- `public.teams` by foreign key, so both sides are the same string — and a club
-- the fixture window does not cover is never dropped; it appears with whatever
-- the domain resolver derives from its name.
--
-- **It is not broken. It is one round trip and one join too many**, and it has
-- one real failure mode: a club with no fixture in the window silently loses
-- its stored identity and falls back to a derived one. That is why the pgTAP
-- suite seeds a club with **no fixture at all** and requires its short code and
-- colours to come back anyway.
--
-- The identity join is contract 136's own, character-for-character:
-- `club_identity_reference.normalised_name = normalised_club_name(team.name)`.
-- Contract 137 exists because that normaliser was wrong in a way only real
-- football exposed — it stripped `fc` from a name whose spaces had already been
-- removed, so 'Chelsea FC' became 'chelse' — and the fix belongs in the
-- normaliser, not in a second spelling of the join here.
--
-- ---------------------------------------------------------------------------
-- `MIG-UI-18` — THE NEIGHBOURHOOD, AND WHY IT IS NOT A SECOND RANKING
-- ---------------------------------------------------------------------------
--
-- `get_season_leaderboard` pages downward from rank 1 with an opaque cursor and
-- takes no offset and no anchor, so a player ranked 4,000th of 5,000 reaches
-- their own neighbours in **eighty** requests at the 50-row page size. The
-- browser deliberately does not do that: forty round trips to answer one
-- sentence is not an implementation of the requirement.
--
-- Two of the three halves of "rank never stands alone" are already held — rank
-- travels with field size, and the caller's own row is pinned beneath the table
-- when it falls off the loaded pages. The third, WHO is immediately above me
-- and by how much, is what this adds.
--
-- **It computes no rank.** Every figure comes from
-- `predictor_internal.season_standings`, which is the same authority
-- `get_season_leaderboard` and contract 128's league table read, and the total
-- order is `standing_rank, sort_name, display_name collate "C", entry_key` —
-- copied from contract 95 deliberately and asserted by
-- `232_season_clubs_and_neighbourhood.sql`, which requires the neighbourhood's
-- `position` for a given entry to equal the position the paged leaderboard
-- gives the same entry. Two reads answering "where am I" differently is exactly
-- the defect this repository keeps recording, and it would be invisible: both
-- would look sorted.
--
-- The window is symmetric and clamped. A caller at rank 1 gets fewer rows above
-- than below and is told so by the positions themselves rather than by padding
-- the array, because a padded neighbourhood invents players.
--
-- ---------------------------------------------------------------------------
-- WHAT NEITHER DOES
-- ---------------------------------------------------------------------------
--
-- Neither writes anything, adds a rule, or moves a lock, score, settlement or
-- reveal boundary. Both are `authenticated` and neither is anonymous. The
-- neighbourhood reuses contract 95's own membership boundary verbatim — an
-- entry in this season — and refuses a non-entrant identically to a season that
-- does not exist, so it cannot be used to discover which season ids are real.
-- The clubs read discloses no player, no entry and no prediction: it is
-- football about clubs, which is the same reason contract 141's form reads are
-- granted to any signed-in caller.
-- ---------------------------------------------------------------------------

begin;

-- ===========================================================================
-- 1. `MIG-UI-16` — the season's clubs.
-- ===========================================================================

create or replace function public.get_season_clubs(p_tournament_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $clubs$
declare
  v_uid uuid := (select auth.uid());
  v_kind text;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_tournament_id is null then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  select season.kind into v_kind
    from public.tournaments season
   where season.id = p_tournament_id;

  -- A league season only, on contract 147's reasoning: a catalogue-shaped read
  -- that answered for a tournament would put Euro 2028's clubs on the weekly
  -- platform's own surfaces, and `EURO-001` is a recorded defect rather than a
  -- licence to add more.
  if v_kind is distinct from 'league_season' then
    raise exception 'That competition is not a league season' using errcode = '22023';
  end if;

  return (
    select coalesce(jsonb_agg(entry order by entry ->> 'name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 -- The canonical id `set_competition_follow` takes. This is the
                 -- field the two-read browser join existed to obtain.
                 'id', team.id,
                 'name', team.name,
                 -- Contract 136's facts, through contract 137's corrected
                 -- normaliser. Null where the reference holds no row, which is
                 -- a real state: the domain resolver derives a fallback and
                 -- the read does not invent one here.
                 'shortCode', identity.short_code,
                 'clubColours', identity.club_colours
               ) as entry
          from public.teams team
          left join predictor_internal.club_identity_reference identity
                 on identity.normalised_name
                  = predictor_internal.normalised_club_name(team.name)
         where team.tournament_id = p_tournament_id
         -- No fixture join of any kind, deliberately. A club with no fixture in
         -- any window is still one of the season's clubs and is still followable.
         order by team.name
         limit 200) listed);
end;
$clubs$;

comment on function public.get_season_clubs(uuid) is
  'Contract 183 / MIG-UI-16. Every club in a league season with its canonical '
  'teams.id and contract 136''s identity facts in one answer, replacing the '
  'two-read browser join. Reads no fixture, so a club with no fixture is still '
  'returned. Discloses no player, entry or prediction.';

revoke all on function public.get_season_clubs(uuid) from public, anon;
grant execute on function public.get_season_clubs(uuid) to authenticated;

-- ===========================================================================
-- 2. `MIG-UI-18` — the leaderboard neighbourhood.
-- ===========================================================================

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

  -- Contract 95's boundary, in contract 95's order and for its reason: the
  -- season's existence is established first, so a non-entrant and a nonexistent
  -- season are not distinguishable by error code, and no display name is
  -- touched on the refusing path.
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

  -- Clamped rather than refused. A caller asking for 500 neighbours is asking
  -- for the leaderboard, and that read already exists.
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
        -- `collate "C"` and the md5 separator are contract 95's, copied so the
        -- two reads cannot order differently. See the header.
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
      select ordered.*
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
            -- The sentence this read exists to answer. Signed, and relative to
            -- the caller: positive means ahead of them.
            'pointsFromYou', row.points - (select points from me))
          order by row.position)
        from neighbourhood row), '[]'::jsonb),
      'you', (
        select jsonb_build_object(
          'displayName', me.display_name,
          'points', me.points,
          'rank', me.standing_rank,
          'matchweeksPlayed', me.matchweeks_played,
          'tied', me.same_rank_count > 1,
          'position', me.position)
        from me),
      'window', v_window,
      -- The field size, so rank never stands alone — the direction this row
      -- comes from, and already true of every other rank surface.
      'totalCount', coalesce((select max(total_count) from ordered), 0),
      -- Stated rather than inferred from the row count, because a caller at
      -- rank 1 legitimately receives fewer rows above than they asked for and
      -- padding the array would invent players.
      'atTop', (select position from me) - v_window <= 1,
      'atBottom', (select position from me) + v_window
                  >= coalesce((select max(total_count) from ordered), 0))
  );
end;
$neighbourhood$;

comment on function public.get_season_leaderboard_neighbourhood(uuid, integer) is
  'Contract 183 / MIG-UI-18. A symmetric window of entrants around the caller''s '
  'own rank in one request, so reaching rank 4,000 costs one call rather than '
  'eighty. Computes no rank: every figure and the whole total order come from '
  'predictor_internal.season_standings and contract 95''s ordering, and 232 '
  'requires this read and the paged leaderboard to agree on position.';

revoke all on function public.get_season_leaderboard_neighbourhood(uuid, integer)
  from public, anon;
grant execute on function public.get_season_leaderboard_neighbourhood(uuid, integer)
  to authenticated;

-- ===========================================================================
-- 3. Prove what cannot be left to a test file.
-- ===========================================================================

do $$
begin
  if has_function_privilege('anon', 'public.get_season_clubs(uuid)', 'execute')
     or has_function_privilege('anon',
          'public.get_season_leaderboard_neighbourhood(uuid, integer)', 'execute')
  then
    raise exception 'Neither contract 183 read may be reachable anonymously';
  end if;

  if not has_function_privilege('authenticated', 'public.get_season_clubs(uuid)', 'execute')
     or not has_function_privilege('authenticated',
          'public.get_season_leaderboard_neighbourhood(uuid, integer)', 'execute')
  then
    raise exception 'Both contract 183 reads must be reachable by a signed-in player';
  end if;

  -- The neighbourhood must not have acquired a ranking of its own. Asserted on
  -- the installed definition, because this is the property the whole contract
  -- turns on and a later edit would be invisible in every ordered-looking test.
  if pg_catalog.pg_get_functiondef(
       'public.get_season_leaderboard_neighbourhood(uuid, integer)'::regprocedure
     ) !~ 'season_standings' then
    raise exception
      'The neighbourhood must take its ranking from predictor_internal.season_standings';
  end if;

  -- The clubs read must not have acquired a fixture join, which is what would
  -- silently drop a club with no fixture -- the exact defect MIG-UI-16 records.
  if pg_catalog.pg_get_functiondef('public.get_season_clubs(uuid)'::regprocedure)
       ~* 'season_fixtures' then
    raise exception
      'The clubs read must not join fixtures: a club with no fixture is still a club';
  end if;
end;
$$;

commit;
