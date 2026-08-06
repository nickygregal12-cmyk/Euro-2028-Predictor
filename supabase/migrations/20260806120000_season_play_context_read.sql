-- Contract 120: a season's play context — which season a URL means, and which
-- matchweek its card opens at.
--
-- The season Match Predictor surface has been production code since UI-04 and
-- reachable only from `/dev/season-predictor`. Registering it as a real route
-- needs two facts the browser cannot obtain, and this supplies both in one
-- read: a route that resolved the season and then asked separately for the
-- matchweek would be two round trips to answer one question.
--
-- WHICH SEASON. The route is `/competitions/:competitionSlug/:seasonSlug`. The
-- slug lives in `public.competitions`, which is `revoke all ... from public,
-- anon, authenticated` (contract 65), and no browser-reachable function
-- returns one. `public.tournaments` IS readable, so a client can see season
-- rows — but the only thing distinguishing two seasons sharing a `season_key`
-- is `competition_id`, pointing at the table it cannot read. Matching on
-- `tournaments.name` instead would make a display string a join key, and the
-- first rename would break routing. `(competitions.slug, tournaments.season_key)`
-- is a real composite key: `slug` is unique and `(competition_id, season_key)`
-- is unique, so the pair identifies exactly one season.
--
-- WHICH MATCHWEEK. `get_season_matchweek_card` takes the matchweek as an
-- argument and nothing told the caller what to pass. Opening at matchweek 1 is
-- wrong from the second matchweek onward, and `public.competition_rounds` is
-- revoked from the browser, so a client cannot derive it — and deriving it in
-- JavaScript would put a second answer beside the one the database owns.
--
-- NOTHING NEW IS DECIDED HERE. `predictor_internal.next_eligible_league_round`
-- (contract 109) already answers the scheduling question for the Last Man
-- Standing successor calendar: given a season, a game and an instant, which
-- league round locks next. It orders by the DERIVED lock instant rather than by
-- `ordinal`, so a rescheduled fixture list resolves to the round that actually
-- locks next rather than the lowest-numbered one — the property contract 119
-- made matter. This adds no scheduling logic; it makes that answer reachable,
-- and reachable is the only thing it was not.
--
-- WHY IT IS NOT GATED ON AN ENTRY. A season's identity and calendar are the
-- same for everyone playing it, and `tournaments` is already readable by every
-- authenticated user, so nothing here is private: no prediction, no entry, no
-- standing and no other player. `get_season_matchweek_card` keeps its own
-- entry gate for the things that ARE personal.
--
-- WHAT IT RETURNS WHEN THERE IS NO MATCHWEEK. A season past its last lock has
-- no next eligible round, and that is an ordinary end-of-season state rather
-- than an error: `matchweek` comes back null and the surface says so. A slug
-- or season key naming nothing, and a competition that is not a league season,
-- both raise — a null for those as well would let a mistyped URL read as a
-- finished season.

begin;

create or replace function public.get_season_play_context(
  p_competition_slug text,
  p_season_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_tournament_id uuid;
  v_competition_name text;
  v_season_key text;
  v_time_zone text;
  v_status text;
  v_kind text;
  v_count integer;
  v_round_id uuid;
  v_ordinal integer;
  v_locks_at timestamptz;
begin
  if p_competition_slug is null or p_season_key is null then
    raise exception 'A competition and season are required' using errcode = '22023';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select season.id, competition.name, season.season_key,
         season.display_timezone, season.status, season.kind
    into v_tournament_id, v_competition_name, v_season_key,
         v_time_zone, v_status, v_kind
    from public.tournaments season
    join public.competitions competition on competition.id = season.competition_id
   where competition.slug = p_competition_slug
     and season.season_key = p_season_key;

  if v_tournament_id is null then
    raise exception 'That competition season does not exist' using errcode = '22023';
  end if;

  -- A tournament-shaped competition has no league matchweeks, so the question
  -- does not apply to it. Refusing names the mistake; a null would hide it.
  if v_kind <> 'league_season' then
    raise exception 'That competition is not a league season' using errcode = '22023';
  end if;

  select count(*)::integer into v_count
    from public.competition_rounds round
   where round.tournament_id = v_tournament_id
     and round.kind = 'league_matchweek';

  if v_count = 0 then
    raise exception 'This competition has no league matchweeks' using errcode = '22023';
  end if;

  -- The existing authority. `main_predictor` is the game whose lock buffer
  -- governs the card this read exists to open; a different game with a
  -- different buffer would legitimately resolve to a different round, which is
  -- why the game is named rather than assumed.
  v_round_id := predictor_internal.next_eligible_league_round(
    v_tournament_id, 'main_predictor', now()
  );

  if v_round_id is not null then
    select round.ordinal into v_ordinal
      from public.competition_rounds round
     where round.id = v_round_id;

    select predictor_internal.season_matchweek_lock_at(
             v_tournament_id, v_round_id, definition.buffer_minutes
           )
      into v_locks_at
      from public.game_definitions definition
     where definition.game_key = 'main_predictor';
  end if;

  return jsonb_build_object(
    'tournament_id', v_tournament_id,
    'competition_name', v_competition_name,
    'season_key', v_season_key,
    'time_zone', v_time_zone,
    'status', v_status,
    'matchweek', v_ordinal,
    'of', v_count,
    'locks_at', v_locks_at
  );
end;
$$;

revoke all on function public.get_season_play_context(text, text)
  from public, anon;

grant execute on function public.get_season_play_context(text, text)
  to authenticated;

commit;
