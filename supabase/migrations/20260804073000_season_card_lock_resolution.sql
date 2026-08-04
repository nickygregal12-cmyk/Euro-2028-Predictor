-- Contract 80: what happens to a matchweek card when its round locks.
--
-- Counterpart to `resolveCardAtLock` in `src/domain/season/cardSubmission.ts`,
-- held in step by `tests/database-parity/seasonCardLockParity.test.ts`.
--
-- FIRST OF TWO SLICES, stated so the scope is not overread. ADR 0012 asks for
-- "recurring matchweek submission scheduling around the existing tournament
-- submission mechanism". That needs three things: this resolution law, a record
-- of where each card stands, and the recurrence that applies the law at each
-- lock. Only the first is here. Card status is not persisted anywhere yet —
-- `season_predictions` has no confirmation flag and no card table exists — so
-- the recurrence has nothing to read. Building it now would mean inventing that
-- storage shape inside a scheduler, which is how storage decisions get made by
-- accident.
--
-- THE RULE THIS PROTECTS is rolling entry. A player who never engaged a
-- matchweek is UNBANKED: the lock does not invent a submission for them, and
-- never has. Only a card they touched auto-completes. Getting this backwards
-- would silently enter every registered player into every matchweek with
-- default predictions, manufacturing scores nobody made — and the totals would
-- look entirely plausible.
--
-- THE DETAIL A REIMPLEMENTATION LOSES SECOND is provenance on a confirmed card.
-- A prefilled default the player CONFIRMED counts as theirs, not as an
-- auto-completion, because confirming the card is the act of adopting the
-- prefills. So `confirmed` cards always report `autoCompleted: false` even
-- though the values came from defaults. Marking them auto-completed would tell
-- a player the system filled in a card they had personally signed off.
--
-- REFUSAL ORDER MATTERS and is per fixture, in order: blank id, then duplicate,
-- then an invalid default, then an invalid player prediction. A card whose
-- first fixture has a malformed default and whose second is a duplicate refuses
-- `invalid_input`, not `duplicate_fixture`, because the first fixture is fully
-- checked before the second is reached.
--
-- ONE DELIBERATE HARDENING over the TypeScript. `CardStatus` is a union type, so
-- an unrecognised status cannot reach `resolveCardAtLock`. SQL has no such
-- guarantee, so an unknown status is REFUSED here rather than falling through
-- to the engaged path. That is not a behavioural divergence — no reachable
-- TypeScript input produces it — it is the same rule where the type system
-- cannot enforce it.

-- ---------------------------------------------------------------------------
-- A scoreline is two non-negative integers. Nothing else.
--
-- The TypeScript guard is `Number.isInteger(value.home) && value.home >= 0`,
-- and both halves matter: `jsonb_typeof` reports 2.5 as 'number', so a decimal
-- would pass a type check and then silently truncate on cast. Comparing the
-- value against its own floor is what rejects it.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.is_valid_scoreline(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- `coalesce(..., false)` is load-bearing, not defensive noise. For an object
  -- with no `home` key, `p_value->'home'` is SQL NULL and `jsonb_typeof(NULL)`
  -- is NULL, so the conjunction evaluates to NULL rather than false — and
  -- `if not <null>` does not fire, so an empty object was ACCEPTED as a
  -- scoreline while TypeScript refused it. A differential sweep against
  -- `resolveCardAtLock` caught it; three-valued logic is exactly where a port
  -- from a two-valued language goes wrong.
  select coalesce(
       jsonb_typeof(p_value) = 'object'
     and jsonb_typeof(p_value->'home') = 'number'
     and jsonb_typeof(p_value->'away') = 'number'
     and (p_value->>'home')::numeric >= 0
     and (p_value->>'away')::numeric >= 0
     and (p_value->>'home')::numeric = floor((p_value->>'home')::numeric)
     and (p_value->>'away')::numeric = floor((p_value->>'away')::numeric),
     false)
$$;

revoke all on function predictor_internal.is_valid_scoreline(jsonb)
  from public, anon, authenticated;

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
  v_default jsonb;
  v_player jsonb;
  v_seen text[] := array[]::text[];
  v_confirmed boolean;
  v_predictions jsonb := '[]'::jsonb;
  v_auto_completed boolean := false;
  v_from_default boolean;
  v_count integer;
begin
  if p_status is null or p_status not in ('no_submission', 'provisional', 'confirmed') then
    return jsonb_build_object('kind', 'refused', 'reason', 'invalid_input');
  end if;

  -- Rolling entry: absence is not a submission, and the lock never invents one.
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

  v_confirmed := p_status = 'confirmed';

  -- `with ordinality` keeps the caller's order, which the refusal ordering
  -- above depends on.
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

    v_default := v_fixture->'defaultPrediction';
    if not predictor_internal.is_valid_scoreline(v_default) then
      return jsonb_build_object('kind', 'refused', 'reason', 'invalid_input');
    end if;

    v_player := v_fixture->'playerPrediction';
    if v_player is not null and jsonb_typeof(v_player) <> 'null'
       and not predictor_internal.is_valid_scoreline(v_player) then
      return jsonb_build_object('kind', 'refused', 'reason', 'invalid_input');
    end if;

    -- A confirmed card's prefills are the player's: confirming is the act of
    -- adopting them.
    v_from_default := not v_confirmed
      and (v_player is null or jsonb_typeof(v_player) = 'null');
    if v_from_default then
      v_auto_completed := true;
    end if;

    v_predictions := v_predictions || jsonb_build_object(
      'fixtureId', v_id,
      'prediction', case
        when v_player is null or jsonb_typeof(v_player) = 'null' then v_default
        else v_player
      end,
      'provenance', case when v_from_default then 'default' else 'player' end);
  end loop;

  return jsonb_build_object(
    'kind', 'submitted',
    'predictions', v_predictions,
    'autoCompleted', v_auto_completed,
    'confirmed', v_confirmed);
end;
$$;

revoke all on function predictor_internal.resolve_season_card_at_lock(jsonb, text)
  from public, anon, authenticated;
