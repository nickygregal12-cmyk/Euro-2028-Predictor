-- Contract 73: how a Last Man Standing round ends, with TypeScript parity.
--
-- Counterpart to `concludeLmsRound` and `resolveLmsSeasonExhaustion` in
-- `src/domain/season/lmsRoundResolution.ts`, held in step by
-- `tests/database-parity/lmsConclusionParity.test.ts`.
--
-- Contract 71 decided one entrant's fate. This decides the round's.
--
-- THE RULE A REIMPLEMENTATION LOSES FIRST: a postponement cannot win. A sole
-- survivor who only survived because their fixture did not play has not beaten
-- anyone, so the round CONTINUES and the eliminations still stand. Award them
-- the title and the competition ends on a match that was never played — and
-- the result looks like an ordinary win, because that is exactly what a
-- one-survivor round normally is.
--
-- ADR 0013 also records that mass elimination is likelier than independence
-- suggests, so the zero-survivor branches are first-class rather than edge
-- cases, and they differ by endgame:
--
--   public   — up to LMS_PUBLIC_JOINT_WINNER_CAP (3) entrants share the win;
--              more than that and everyone re-enters, because a "shared win"
--              between a crowd is not a win;
--   private  — play_on continues, shared_win shares, reset ends with no winner.
--
-- Entry ids come back sorted so the same wipeout always produces the same
-- answer, and duplicate or blank ids are refused rather than deduplicated: a
-- caller who sent the same entrant twice does not know its own round.

create or replace function predictor_internal.conclude_lms_round(
  p_entrants jsonb,
  p_endgame_scope text,
  p_endgame_on_wipeout text
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_total integer;
  v_distinct integer;
  v_survivors integer;
  v_sole jsonb;
  v_ids jsonb;
begin
  if p_entrants is null or jsonb_typeof(p_entrants) <> 'array' then
    return jsonb_build_object('kind', 'refused', 'reason', 'invalid_input');
  end if;

  select count(*), count(distinct entrant->>'entryId')
    into v_total, v_distinct
    from jsonb_array_elements(p_entrants) as entrant;

  -- An empty round, a blank id, or the same entrant twice: refused, never
  -- silently repaired.
  if v_total = 0 or v_distinct <> v_total then
    return jsonb_build_object('kind', 'refused', 'reason', 'invalid_input');
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_entrants) as entrant
     where coalesce(btrim(entrant->>'entryId'), '') = ''
  ) then
    return jsonb_build_object('kind', 'refused', 'reason', 'invalid_input');
  end if;

  if p_endgame_scope not in ('public', 'private')
     or (p_endgame_scope = 'private'
         and coalesce(p_endgame_on_wipeout, '') not in ('play_on', 'shared_win', 'reset')) then
    return jsonb_build_object('kind', 'refused', 'reason', 'invalid_input');
  end if;

  select count(*) into v_survivors
    from jsonb_array_elements(p_entrants) as entrant
   where (entrant->>'alive')::boolean;

  if v_survivors > 1 then
    return jsonb_build_object('kind', 'continues');
  end if;

  if v_survivors = 1 then
    select entrant into v_sole
      from jsonb_array_elements(p_entrants) as entrant
     where (entrant->>'alive')::boolean;

    -- The rule this whole function exists to protect.
    if coalesce((v_sole->>'viaPostponement')::boolean, false) then
      return jsonb_build_object(
        'kind', 'continues_postponement_cannot_win',
        'soleSurvivorEntryId', v_sole->>'entryId');
    end if;

    return jsonb_build_object('kind', 'winner', 'entryId', v_sole->>'entryId');
  end if;

  -- Zero survivors: the wipeout round.
  select jsonb_agg(id order by id) into v_ids
    from (
      select entrant->>'entryId' as id
        from jsonb_array_elements(p_entrants) as entrant
    ) as ids;

  if p_endgame_scope = 'public' then
    return case
      when v_total <= 3 then jsonb_build_object('kind', 'shared_win', 'entryIds', v_ids)
      else jsonb_build_object('kind', 'restart_all_reentered')
    end;
  end if;

  return case p_endgame_on_wipeout
    when 'play_on' then jsonb_build_object('kind', 'wipeout_play_on')
    when 'shared_win' then jsonb_build_object('kind', 'shared_win', 'entryIds', v_ids)
    else jsonb_build_object('kind', 'reset_no_winner')
  end;
end;
$$;

revoke all on function predictor_internal.conclude_lms_round(jsonb, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The backstop when the fixture list runs out with more than one player alive.
--
-- Under play on they share the win. Under any other rule ADR 0013 records no
-- outcome, so this returns null — an undecided case a caller must surface,
-- never a silent guess. Returning a winner here would invent a rule.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.resolve_lms_season_exhaustion(
  p_alive_entry_ids text[],
  p_endgame_scope text,
  p_endgame_on_wipeout text
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_alive_entry_ids is null or array_length(p_alive_entry_ids, 1) is null then null
    when array_length(p_alive_entry_ids, 1) <= 1 then null
    when p_endgame_scope = 'private' and p_endgame_on_wipeout = 'play_on' then
      jsonb_build_object(
        'kind', 'shared_win',
        'entryIds', (select jsonb_agg(id order by id) from unnest(p_alive_entry_ids) as id))
    else null
  end;
$$;

revoke all on function predictor_internal.resolve_lms_season_exhaustion(text[], text, text)
  from public, anon, authenticated;
