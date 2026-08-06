-- Contract 120: tell the browser WHICH matchweek a season's card should open at.
--
-- Contract 114 gave the browser a season's matchweek card, and it takes the
-- matchweek as an argument: `get_season_matchweek_card(p_tournament_id,
-- p_matchweek)`. Nothing tells the caller what to pass. The UI-04 surface has
-- therefore never been registered as a production route — it is reachable only
-- from `/dev/season-predictor`, where the harness supplies a number.
--
-- The browser cannot work it out either. `public.competition_rounds` is
-- `revoke all ... from public, anon, authenticated` (contract 65), so a client
-- cannot see a season's rounds at all, let alone derive which one is next.
-- Opening at matchweek 1 would be wrong from the second matchweek onward, and
-- guessing from the calendar in JavaScript would put a second answer to a
-- scheduling question beside the one the database already owns.
--
-- NOTHING NEW IS DECIDED HERE. `predictor_internal.next_eligible_league_round`
-- (contract 109) already answers this exact question for the Last Man Standing
-- successor scheduler: given a season, a game and an instant, which league
-- round locks next. It orders by the DERIVED lock instant rather than by
-- `ordinal`, so a rescheduled fixture list resolves to the round that actually
-- locks next rather than the one with the lowest number — the property
-- contract 119 made matter. This migration adds no scheduling logic; it makes
-- that existing answer reachable, and reachable is the only thing it was not.
--
-- WHY IT IS NOT PERSONAL DATA, and therefore not gated on an entry. A season's
-- calendar is the same for everyone playing it, and `public.tournaments` is
-- already `select to authenticated`, so the season itself is not a secret. The
-- read returns no prediction, no entry, no standing and no other player — only
-- which matchweek is next and how many there are. `get_season_matchweek_card`
-- keeps its own entry gate for the things that ARE personal.
--
-- WHAT IT RETURNS WHEN THERE IS NO ANSWER. A season whose last matchweek has
-- locked has no next eligible round, and that is an ordinary end-of-season
-- state rather than an error: `matchweek` comes back null and the surface says
-- so. A tournament id that is not a league season, or does not exist, is a
-- caller mistake and raises — the two cases are different and a null for both
-- would let a typo read as "the season is over".

begin;

-- ---------------------------------------------------------------------------
-- The read.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_play_matchweek(
  p_tournament_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_kind text;
  v_count integer;
  v_round_id uuid;
  v_ordinal integer;
  v_locks_at timestamptz;
begin
  if p_tournament_id is null then
    raise exception 'A season is required' using errcode = '22023';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  -- A tournament-shaped competition has no league matchweeks, so answering
  -- "which matchweek is next" for one would be answering a question that does
  -- not apply. Refusing names the mistake; a null would hide it.
  select kind into v_kind
    from public.tournaments
   where id = p_tournament_id;

  if v_kind is null then
    raise exception 'That competition season does not exist' using errcode = '22023';
  end if;

  if v_kind <> 'league_season' then
    raise exception 'That competition is not a league season' using errcode = '22023';
  end if;

  select count(*)::integer into v_count
    from public.competition_rounds
   where tournament_id = p_tournament_id
     and kind = 'league_matchweek';

  if v_count = 0 then
    raise exception 'This competition has no league matchweeks' using errcode = '22023';
  end if;

  -- The existing authority. `main_predictor` is the game whose lock buffer
  -- governs the card this read exists to open; a different game with a
  -- different buffer would legitimately resolve to a different round, which is
  -- why the game is named rather than assumed.
  v_round_id := predictor_internal.next_eligible_league_round(
    p_tournament_id, 'main_predictor', now()
  );

  if v_round_id is not null then
    select round.ordinal into v_ordinal
      from public.competition_rounds round
     where round.id = v_round_id;

    select predictor_internal.season_matchweek_lock_at(
             p_tournament_id, v_round_id, definition.buffer_minutes
           )
      into v_locks_at
      from public.game_definitions definition
     where definition.game_key = 'main_predictor';
  end if;

  return jsonb_build_object(
    'matchweek', v_ordinal,
    'of', v_count,
    'locks_at', v_locks_at
  );
end;
$$;

revoke all on function public.get_season_play_matchweek(uuid)
  from public, anon;

grant execute on function public.get_season_play_matchweek(uuid)
  to authenticated;

commit;
