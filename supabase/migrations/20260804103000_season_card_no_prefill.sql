-- Contract 82: the card is not pre-filled, and nothing completes it for you.
--
-- ADR 0012 required every fixture to be pre-filled with "a sensible default"
-- and partial cards to auto-complete at lock using it. Both are WITHDRAWN by
-- owner decision, recorded in that ADR's 4 August 2026 amendment. This
-- migration brings contract 80's resolver into line.
--
-- WHY THE RULE CHANGED. A player must not benefit from not filling something
-- in. A default that can score is a free entry into every fixture a player
-- ignored: whatever value it takes, some of those fixtures come in, and the
-- points are indistinguishable in the standings from points somebody earned by
-- deciding. The benefit is largest for the LEAST engaged player, because the
-- more fixtures you leave blank the more of your season is scored by a rule
-- rather than by a judgement. That inverts the competition.
--
-- Nothing replaces the default, and that is the point — there is no default to
-- choose. A blank fixture is submitted as no prediction and scores nothing.
--
-- WHY A NEW MIGRATION RATHER THAN AN EDIT. Contract 80 is applied to
-- development, and migrations are append-only after hosted application. The
-- function is redefined here instead, which is additive.
--
-- WHAT LEAVES THE CONTRACT:
--
--   * `defaultPrediction` is no longer read. Callers may still send it and it
--     is ignored, so a stale caller degrades to correct behaviour rather than
--     to a refusal;
--   * `provenance` leaves the output. Every submitted prediction is the
--     player's, because nothing else can now produce one, and a field with one
--     possible value is a field that will eventually be believed to have two;
--   * `autoCompleted` leaves the output for the same reason — it could only
--     ever be false.
--
-- WHAT DOES NOT CHANGE:
--
--   * ROLLING ENTRY. A player who never engaged is still unbanked. Absence and
--     an empty card remain different facts, and contract 81's storage keeps
--     them different by having no row for the first;
--   * the refusal set and its ORDER. A blank or duplicated fixture id, a
--     malformed player prediction, and a matchweek with no fixtures at all
--     still refuse, still per fixture in caller order, so the first fault wins
--     and points at the right fixture;
--   * `is_valid_scoreline`, including the three-valued-logic fix contract 80
--     landed. It is still what decides whether a value the player gave is a
--     scoreline.
--
-- A CARD WITH BLANKS IS NOT A REFUSAL. It is the ordinary, expected case: the
-- player filled in what they wanted to. Refusing it would make silence an error
-- somebody has to resolve, when the rule is simply that silence scores nothing.
--
-- `confirmed` and `provisional` now submit exactly the same thing. With no
-- prefills there is nothing for confirmation to adopt, so the status becomes a
-- record of intent rather than a scoring input. It is retained because "I meant
-- to leave that blank" and "I had not got to it yet" are different things to
-- have said.

begin;

create or replace function predictor_internal.resolve_season_card_at_lock(
  p_fixtures jsonb,
  p_status text
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_fixture jsonb;
  v_id text;
  v_player jsonb;
  v_seen text[] := array[]::text[];
  v_predictions jsonb := '[]'::jsonb;
  v_count integer;
begin
  if p_status is null or p_status not in ('no_submission', 'provisional', 'confirmed') then
    return jsonb_build_object('kind', 'refused', 'reason', 'invalid_input');
  end if;

  -- Rolling entry: absence is not a submission, and the lock never invents one.
  -- Checked before the fixtures so an absent player cannot be turned into a
  -- refusal by data they never touched.
  if p_status = 'no_submission' then
    return jsonb_build_object('kind', 'unbanked');
  end if;

  if p_fixtures is null or jsonb_typeof(p_fixtures) <> 'array' then
    return jsonb_build_object('kind', 'refused', 'reason', 'invalid_input');
  end if;

  select count(*) into v_count from jsonb_array_elements(p_fixtures) as f;
  if v_count = 0 then
    return jsonb_build_object('kind', 'refused', 'reason', 'invalid_input');
  end if;

  -- `with ordinality` keeps the caller's order, which the refusal ordering
  -- depends on: each fixture is checked fully before the next, so a malformed
  -- prediction on fixture one wins over a duplicate on fixture two.
  for v_fixture in
    select value from jsonb_array_elements(p_fixtures) with ordinality as t(value, position)
    order by t.position
  loop
    v_id := v_fixture->>'fixtureId';
    if coalesce(btrim(v_id), '') = '' then
      return jsonb_build_object('kind', 'refused', 'reason', 'invalid_input');
    end if;
    if v_id = any (v_seen) then
      return jsonb_build_object('kind', 'refused', 'reason', 'duplicate_fixture');
    end if;
    v_seen := v_seen || v_id;

    v_player := v_fixture->'playerPrediction';

    -- A blank is a blank: absent, or JSON null. Only a value the player
    -- actually gave is validated, and only such a value is submitted.
    if v_player is null or jsonb_typeof(v_player) = 'null' then
      continue;
    end if;

    if not predictor_internal.is_valid_scoreline(v_player) then
      return jsonb_build_object('kind', 'refused', 'reason', 'invalid_input');
    end if;

    v_predictions := v_predictions || jsonb_build_object(
      'fixtureId', v_id,
      'prediction', v_player);
  end loop;

  return jsonb_build_object(
    'kind', 'submitted',
    'predictions', v_predictions,
    'confirmed', p_status = 'confirmed');
end;
$$;

revoke all on function predictor_internal.resolve_season_card_at_lock(jsonb, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Prove the withdrawal at apply time rather than trusting the body above.
--
-- The failure this guards against is a later edit reintroducing a default under
-- another name. A card whose only fixture is blank must submit NOTHING; if it
-- ever submits a prediction, something is filling it in.
-- ---------------------------------------------------------------------------

do $$
declare
  v_blank jsonb :=
    '[{"fixtureId":"f1","defaultPrediction":{"home":1,"away":1},"playerPrediction":null}]'::jsonb;
  v_result jsonb;
begin
  foreach v_result in array array[
    predictor_internal.resolve_season_card_at_lock(v_blank, 'provisional'),
    predictor_internal.resolve_season_card_at_lock(v_blank, 'confirmed')
  ] loop
    if v_result->>'kind' <> 'submitted' then
      raise exception
        'a card with a blank fixture must submit, not %', v_result->>'kind';
    end if;
    -- Note the payload deliberately still carries `defaultPrediction`: a stale
    -- caller must degrade to correct behaviour, not to a scoring surprise.
    if jsonb_array_length(v_result->'predictions') <> 0 then
      raise exception
        'a blank fixture produced a prediction; the card is being pre-filled';
    end if;
    if v_result ? 'autoCompleted' or v_result->'predictions' @> '[{"provenance":"default"}]' then
      raise exception 'auto-completion survived the withdrawal';
    end if;
  end loop;
end;
$$;

commit;
