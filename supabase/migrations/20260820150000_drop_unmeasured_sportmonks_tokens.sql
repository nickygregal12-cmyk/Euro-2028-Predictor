-- ===========================================================================
-- CONTRACT 213 — the unmeasured SportMonks tokens are dropped so they fail
-- closed.
--
-- This is the second half of `ING-002`. Contract 209 closed the first half by
-- MEASURING token `10` from retained payloads. This one closes the rest by
-- REMOVING what was never measured at all — and removal, not remapping, is the
-- improvement.
--
-- WHY REMOVAL RATHER THAN A BETTER GUESS.
--
-- Contract 135 seeded SportMonks tokens `14`–`21` from the provider's published
-- documentation. Contract 209 then measured what this provider actually sends
-- for a postponement and found `10` — while `14`, the token the documentation
-- calls "postponed", has never appeared in a payload. So the table currently
-- says two things map to `postponed`, one because it was observed and one
-- because a document said so, and nothing in the table distinguishes them
-- except a note.
--
-- Contract 209 deliberately removed none of them, on the grounds that replacing
-- one guess with another is not an improvement. That is right, and it is why
-- these are removed rather than remapped. The improvement is the absence:
--
--   * an unmapped token resolves to `unknown` through
--     `predictor_internal.provider_status_kind`, which coalesces a missing row
--     to that word rather than to null;
--   * an `unknown` is RECORDED in `provider_status_observations`, once per
--     response with the number of fixtures it blocked, where it can be measured
--     against a real payload;
--   * and nothing downstream acts on a fixture from a status the system has
--     never seen.
--
-- That is what "fail closed" means here. The fixture keeps the status it has and
-- the token surfaces for review, instead of a documentation guess silently
-- moving a player's fixture — which for `15` (`cancelled`) or `16`–`18`
-- (`abandoned`) would mean taking a fixture away from a player on no evidence
-- that the provider ever says those words.
--
-- THE EVIDENCE CHECK CAME FIRST, AND IT IS THE PART THAT COULD HAVE STOPPED
-- THIS. The brief for this change said to keep any token that had since been
-- observed, and to say so with the payload evidence — the honest outcome, not a
-- failure. Read-only against BOTH hosted environments on 20 August 2026:
--
--   * Development `iouzoutneyjpugbbtdem`: 440 retained SportMonks responses
--     between 2026-08-05T18:19:53Z and 2026-08-19T15:40:03Z. Every `state_id`
--     they contain, taken from the raw bodies rather than from any decoded
--     projection: `1, 2, 3, 5, 10, 22`. Its `provider_status_observations` holds
--     24 rows, all token `22`.
--   * Production `vkfnsqdyhvtwyqkisxhk`: 21 retained SportMonks responses
--     between 2026-08-10T17:19:48Z and 2026-08-19T23:45:05Z, containing
--     `1, 5, 10`. Its single observation row is token `10`.
--
-- NOT ONE of `14`–`21` appears anywhere on either environment. Nothing is kept
-- back.
--
-- ONE FINDING THAT IS NOT ACTED ON HERE, AND IS RECORDED RATHER THAN BURIED.
-- Token `4` ("break") is mapped `in_play` and did not appear in either
-- environment's retained payloads either. It is NOT dropped, for two reasons
-- that are about evidence rather than convenience. The retained window is two
-- weeks of pre-season and opening fixtures, which is a thin sample for a token
-- that only occurs during a stoppage; and `4` sits between `2` and `3`, both
-- observed, in a contiguous in-play run, which is a materially different
-- evidential position from `14`–`21`. Dropping it would also change how a LIVE
-- match reads, which is not what this contract is for. It is written into the
-- `ING-002` row as the next thing to measure.
--
-- WHAT THIS CONTRACT DOES NOT DO.
--
-- It changes no function, no column, no policy and no grant. The resolver, the
-- observation writer and the lifecycle applier are all untouched — they already
-- behave correctly for an unknown token, and that behaviour is what this change
-- relies on rather than something it has to add. It does not touch the
-- `football-data` vocabulary. It does not call the provider.
--
-- IT IS NOT ADDITIVE, AND THAT IS DELIBERATE. It deletes seven rows, so
-- `check-migration-additive.mjs` will report it destructive and the ADR 0024
-- development fast lane will refuse it. That is the correct routing: the rows
-- are removable only through the guarded lane, with a snapshot behind it. Seven
-- seeded reference rows is exactly the sort of loss a backup exists for.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. The seven guesses, removed.
--
-- Named individually rather than by a range, so this statement says which seven
-- and a later reader can check the list against the header without trusting a
-- bound. `19` is absent from both this list and the table: contract 135 never
-- seeded it, which is why it is not mentioned as dropped.
-- ---------------------------------------------------------------------------

delete from predictor_internal.provider_status_kinds
 where provider = 'sportmonks'
   and provider_status in ('14', '15', '16', '17', '18', '20', '21');

-- ---------------------------------------------------------------------------
-- 2. Shape assertions, inside the migration transaction.
--
-- These assert the RESOLUTION rather than the row count, because the row count
-- is the mechanism and the resolution is the promise. A token that had been
-- deleted from the table but still resolved to something would be the one
-- outcome this contract must not produce.
-- ---------------------------------------------------------------------------

do $$
declare
  v_token text;
  v_kind text;
  v_bad integer;
begin
  foreach v_token in array array['14', '15', '16', '17', '18', '20', '21'] loop
    v_kind := predictor_internal.provider_status_kind('sportmonks', v_token);
    if v_kind <> 'unknown' then
      raise exception
        'Contract 213: SportMonks token % still resolves to %, so a guess is '
        'still able to move a fixture.', v_token, v_kind;
    end if;
  end loop;

  -- The measured tokens are untouched, and each is named with the kind contract
  -- 135 and contract 209 measured for it. A migration that dropped one of these
  -- would pass every assertion above.
  if predictor_internal.provider_status_kind('sportmonks', '1') <> 'scheduled' then
    raise exception 'Contract 213: the measured scheduled token was lost.';
  end if;
  if predictor_internal.provider_status_kind('sportmonks', '2') <> 'in_play'
     or predictor_internal.provider_status_kind('sportmonks', '3') <> 'in_play'
     or predictor_internal.provider_status_kind('sportmonks', '4') <> 'in_play'
     or predictor_internal.provider_status_kind('sportmonks', '22') <> 'in_play' then
    raise exception 'Contract 213: an in-play token was lost.';
  end if;
  if predictor_internal.provider_status_kind('sportmonks', '5') <> 'final' then
    raise exception 'Contract 213: the measured final token was lost.';
  end if;

  -- Contract 209's measurement, which this contract exists to stop competing
  -- with. After this migration `10` is the ONLY thing that resolves postponed.
  if predictor_internal.provider_status_kind('sportmonks', '10') <> 'postponed' then
    raise exception 'Contract 213: the measured postponed token was lost.';
  end if;

  select count(*) into v_bad
    from predictor_internal.provider_status_kinds
   where provider = 'sportmonks' and kind = 'postponed';
  if v_bad <> 1 then
    raise exception
      'Contract 213: % SportMonks tokens resolve postponed. Exactly one was '
      'measured, and a second is the guess this contract removes.', v_bad;
  end if;

  select count(*) into v_bad
    from predictor_internal.provider_status_kinds
   where provider = 'sportmonks' and kind = 'final';
  if v_bad <> 1 then
    raise exception
      'Contract 213: SportMonks must still have exactly one measured final '
      'status, and has %.', v_bad;
  end if;

  -- Nothing that remains may carry a kind no measurement supports. `cancelled`
  -- and `abandoned` were reachable ONLY through the dropped tokens, so after
  -- this migration no SportMonks token resolves to either.
  select count(*) into v_bad
    from predictor_internal.provider_status_kinds
   where provider = 'sportmonks' and kind in ('cancelled', 'abandoned');
  if v_bad <> 0 then
    raise exception
      'Contract 213: % SportMonks token(s) still resolve cancelled or '
      'abandoned on no measurement.', v_bad;
  end if;

  -- The other provider's vocabulary is not this contract's business, and a
  -- delete that reached it would be a silent widening.
  select count(*) into v_bad
    from predictor_internal.provider_status_kinds
   where provider <> 'sportmonks';
  if v_bad = 0 then
    raise exception
      'Contract 213: the delete reached beyond SportMonks and emptied another '
      'provider''s vocabulary.';
  end if;
end;
$$;

commit;
