-- ---------------------------------------------------------------------------
-- Contract 161 — a player's own season history, and how they find it.
--
-- ---------------------------------------------------------------------------
-- THE GAP, MEASURED
-- ---------------------------------------------------------------------------
--
-- Contract 156 built the permanent archive: `public.season_wrapped`, immutable
-- once written, read one player at a time by `get_season_wrapped(uuid)`. That
-- read takes a `tournament_id`, so a player can only see a Wrapped for a season
-- they can already NAME.
--
-- Nothing tells them which seasons those are. Measured against the migrations:
--
--   * `get_published_weekly_seasons` (contract 147) is the catalogue, and it
--     excludes drafts and is a list of what is PUBLISHED — which is exactly
--     the wrong list, because a finished season is eventually archived and
--     drops out of it. A player's 2026/27 would vanish from the platform the
--     day 2027/28 replaced it;
--   * `public.tournaments` is readable to `authenticated`, but reading it
--     answers "which seasons exist", not "which did I play", and a player who
--     joined nothing would get the same answer as one who won;
--   * `entries`, `game_memberships` and `bonus_competition_entrants` hold the
--     participation facts and are all revoked from the browser.
--
-- So the archive exists and is unreachable. This is the same shape as contracts
-- 116, 118, 120, 122, 124, 128 and 129 — an authority written for what existed,
-- with nothing able to call it.
--
-- ---------------------------------------------------------------------------
-- WHAT "MAY DISCOVER" MEANS HERE, AND WHY IT IS PARTICIPATION
-- ---------------------------------------------------------------------------
--
-- A season is discoverable by a player when that player TOOK PART in it. Not
-- when it is published, because that would lose their history the moment the
-- season was archived — which is the whole failure this read exists to prevent.
-- Not when they merely followed it, because following is not entry (contract
-- 157 is explicit) and a follow is a present-tense interest rather than a past.
--
-- Participation is any of three facts, and all three are the player's OWN rows:
--
--   1. an `entries` row on the season — they made predictions in it;
--   2. a `game_memberships` row in any state — `left` and `disqualified` count,
--      because a season a player left is still a season they played;
--   3. a `bonus_competition_entrants` row — the game-level entry.
--
-- THEY ARE UNIONED RATHER THAN JOINED, and the load-bearing direction is worth
-- stating correctly rather than plausibly. An earlier draft of this header said
-- the union protects "a player who entered the predictor and no game" — that
-- case cannot arise: `prepare_entry_game_membership` is a BEFORE trigger on
-- `entries` that creates the Main Predictor membership if none exists, so an
-- entry always implies a membership. Corrected here because the pgTAP suite
-- built on the false premise failed against the real schema.
--
-- The direction that IS load-bearing is the other one: a player may hold a Last
-- Man Standing or Championship membership and entrant row and never make a
-- predictor entry at all, because neither game requires one. A join on
-- `entries` would drop that player's season entirely.
--
-- IT IS NOT A DIRECTORY AND CANNOT BECOME ONE. It answers only for
-- `auth.uid()`; it takes no player argument; every row it returns is the
-- caller's own. Nothing here discloses another player's participation, which is
-- the property that lets it be granted at all — a season with fifty thousand
-- entrants is fifty thousand people who never agreed to be enumerated. The one
-- number about other people it returns is `field_size`, and that is already in
-- the caller's own Wrapped row.
--
-- ---------------------------------------------------------------------------
-- WHAT IT DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It computes nothing. Every final figure comes from `season_wrapped`, the
-- banked snapshot, so history cannot disagree with the season it describes. For
-- a season with no Wrapped it says so — `wrapped_available: false` — rather
-- than deriving a stand-in, because contract 156 recorded precisely why a
-- re-derivation over data allowed to change produces a different past.
--
-- Additive: two new internal derivations and one new read. No relation, policy,
-- trigger, grant or existing function is altered.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Which seasons the caller took part in
-- ===========================================================================
--
-- Internal and granted to nobody, so participation has one definition. Written
-- as a union of three self-scoped reads rather than one join, because a player
-- may hold any combination of the three and a join would drop the player who
-- entered a game but never opened the predictor.

create or replace function predictor_internal.player_season_participation(p_user_id uuid)
returns table (tournament_id uuid)
language sql
stable
security definer
set search_path = ''
as $participation$
  select distinct season.id
    from public.tournaments season
   where exists (
           select 1 from public.entries entry
            where entry.tournament_id = season.id
              and entry.user_id = p_user_id)
      or exists (
           select 1 from public.game_memberships membership
            where membership.tournament_id = season.id
              and membership.user_id = p_user_id)
      or exists (
           select 1 from public.bonus_competition_entrants entrant
            join public.bonus_competitions competition
              on competition.id = entrant.competition_id
            where competition.tournament_id = season.id
              and entrant.user_id = p_user_id);
$participation$;

revoke all on function predictor_internal.player_season_participation(uuid)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 2. What the caller did in one season's games
-- ===========================================================================
--
-- Per GAME rather than per season, because ADR 0011's separation is the point:
-- Match Predictor, Last Man Standing and Predictor Championship are equal
-- first-class games with their own entry, their own rules and their own
-- outcome, and a single "how did you do" figure across them would be the
-- combined cross-competition total this repository forbids.
--
-- `outcome` is `bonus_competition_entrants.outcome` verbatim — the settlement
-- authority's own word, not a re-derivation. `left` and `disqualified` come
-- from the membership, so a player sees that they left rather than seeing
-- nothing.

create or replace function predictor_internal.player_season_games(
  p_user_id uuid,
  p_tournament_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $games$
  select coalesce(jsonb_agg(jsonb_build_object(
           'game_key', game.game_key,
           'game_name', definition.display_name,
           'competition_id', game.id,
           'competition_name', game.name,
           'visibility', game.visibility_kind,
           -- The membership state, which is what says a player left.
           'membership_status', membership.status,
           -- The settlement authority's own word for how it ended.
           'outcome', entrant.outcome,
           'joined_at', coalesce(entrant.joined_at, membership.joined_at),
           'left_at', membership.left_at
         ) order by definition.display_name, game.name), '[]'::jsonb)
    from public.bonus_competitions game
    join public.game_definitions definition on definition.game_key = game.game_key
    left join public.game_memberships membership
           on membership.game_competition_id = game.id
          and membership.user_id = p_user_id
    left join public.bonus_competition_entrants entrant
           on entrant.competition_id = game.id
          and entrant.user_id = p_user_id
   where game.tournament_id = p_tournament_id
     -- Only games the caller was actually in. Listing every game a season ran
     -- would turn a personal history into a catalogue, and the catalogue is
     -- contract 147's job.
     and (membership.user_id is not null or entrant.user_id is not null);
$games$;

revoke all on function predictor_internal.player_season_games(uuid, uuid)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 3. The read
-- ===========================================================================
--
-- Bounded by a server-clamped page size and ordered deterministically, for the
-- reason issue #129 gives: a growing list with no ceiling is a response contract
-- nobody wrote. A player's history grows by one row a season, so the ceiling is
-- generous rather than tight — but it exists, and the order is total, so the
-- same call twice returns the same rows in the same order.
--
-- Ordering is newest first by `season_key`, then by competition name, then by
-- season id. `season_key` rather than a date because that is the label a player
-- recognises — "2026/27" — and it is what `tournaments` actually holds; the two
-- further keys make the order total when two competitions share a season.

create or replace function public.get_my_season_history(
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $history$
declare
  v_uid uuid := (select auth.uid());
  v_limit integer;
  v_offset integer;
  v_total integer;
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  -- Clamped server-side, never trusted. Driven rather than described: a caller
  -- asking for a million rows gets 50, zero gets 1, and -5 gets 1 with the
  -- offset floored at 0. Zero clamps UP to one rather than down to an empty
  -- page, because an empty page and "you have no history" look identical to a
  -- reader and only one of them is true.
  v_limit := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*)::integer into v_total
    from predictor_internal.player_season_participation(v_uid);

  select coalesce(jsonb_agg(page.entry order by page.ordinal), '[]'::jsonb)
    into v_rows
    from (
      select row_number() over (
               order by coalesce(season.season_key, '') desc,
                        coalesce(competition.name, '') desc,
                        season.id desc
             ) as ordinal,
             jsonb_build_object(
               'tournament_id', season.id,
               'season_name', season.name,
               'season_key', season.season_key,
               'kind', season.kind,
               'status', season.status,
               'display_timezone', season.display_timezone,
               'competition_id', competition.id,
               'competition_name', competition.name,
               'competition_slug', competition.slug,
               -- WHETHER IT IS STILL IN THE CATALOGUE. A player needs to know
               -- the difference between "this season is over" and "this season
               -- is gone", and a completed or archived season is exactly the
               -- case contract 147's published catalogue cannot answer.
               'in_published_catalogue',
                 season.kind = 'league_season'
                 and season.status in ('scheduled', 'active', 'complete'),
               'complete', season.status in ('complete', 'archived'),
               'games', predictor_internal.player_season_games(v_uid, season.id),
               -- THE FINAL RESULT SUMMARY, taken from the banked snapshot and
               -- never recomputed, so a history cannot disagree with the season.
               'wrapped_available', wrapped.entry_id is not null,
               'final', case
                 when wrapped.entry_id is null then null
                 else jsonb_build_object(
                   'points', wrapped.final_points,
                   'rank', wrapped.final_rank,
                   'field_size', wrapped.field_size,
                   'matchweeks_played', wrapped.matchweeks_played,
                   'finalised_at', wrapped.finalised_at)
               end
             ) as entry
        from predictor_internal.player_season_participation(v_uid) mine
        join public.tournaments season on season.id = mine.tournament_id
        left join public.competitions competition
               on competition.id = season.competition_id
        left join public.season_wrapped wrapped
               on wrapped.tournament_id = season.id
              and wrapped.user_id = v_uid
       order by coalesce(season.season_key, '') desc,
                coalesce(competition.name, '') desc,
                season.id desc
       limit v_limit offset v_offset
    ) page;

  return jsonb_build_object(
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    -- `has_more` from the total rather than from a probe row, because the total
    -- is already needed and a second query to learn the same thing is a second
    -- thing that can disagree.
    'has_more', v_offset + v_limit < v_total,
    -- Already ordered by the window function's ordinal, which is the SAME
    -- expression the page's `order by` uses. An earlier draft ordered the page
    -- by a tuple and the aggregate by a concatenated string key, which agree
    -- for most data and not for all of it — two orderings of one list is one
    -- ordering too many.
    'seasons', v_rows);
end;
$history$;

revoke all on function public.get_my_season_history(integer, integer) from public, anon;
grant execute on function public.get_my_season_history(integer, integer) to authenticated;

-- ===========================================================================
-- 4. Prove the boundary, in the same transaction
-- ===========================================================================

do $$
declare
  v_read text := pg_get_functiondef('public.get_my_season_history(integer,integer)'::regprocedure);
  v_games text := pg_get_functiondef('predictor_internal.player_season_games(uuid,uuid)'::regprocedure);
  v_part text := pg_get_functiondef(
    'predictor_internal.player_season_participation(uuid)'::regprocedure);
begin
  -- IT ANSWERS ONLY FOR THE CALLER. A player-id argument would make this a
  -- directory, which is the one thing contract 151 refused to build and the
  -- reason that contract has no enumeration either.
  if v_read ~* 'p_user_id|p_player_id' then
    raise exception 'The history read must take no player argument';
  end if;

  if v_read !~ 'auth\.uid\(\)' then
    raise exception 'The history read must resolve the caller from auth.uid()';
  end if;

  -- The page size is clamped, not trusted. Issue #129's requirement, asserted
  -- rather than described.
  if v_read !~ 'least\(greatest\(' then
    raise exception 'The page size must be clamped server-side';
  end if;

  -- IT RECOMPUTES NOTHING. Every final figure is contract 156's banked
  -- snapshot; a history that re-derived would produce a different past exactly
  -- as contract 156 said it would.
  if v_read ~* 'season_matchweek_scores|predictor_internal\.season_standings|score_events' then
    raise exception 'The history read must take its finals from the banked archive only';
  end if;

  -- It never reads another player's row. Both derivations are keyed on the
  -- user id they are handed, and the read hands them its own caller's.
  if v_part !~ 'p_user_id' or v_games !~ 'p_user_id' then
    raise exception 'Both derivations must be scoped to one player';
  end if;

  -- No browser role reaches the derivations directly.
  if has_function_privilege('authenticated',
       'predictor_internal.player_season_participation(uuid)', 'execute')
     or has_function_privilege('authenticated',
       'predictor_internal.player_season_games(uuid,uuid)', 'execute')
  then
    raise exception 'The participation derivations must have exactly one caller';
  end if;

  if has_function_privilege('anon', 'public.get_my_season_history(integer,integer)', 'execute') then
    raise exception 'The history read must not be reachable anonymously';
  end if;

  if not has_function_privilege('authenticated',
       'public.get_my_season_history(integer,integer)', 'execute') then
    raise exception 'The history read must stay reachable by a signed-in caller';
  end if;
end;
$$;
