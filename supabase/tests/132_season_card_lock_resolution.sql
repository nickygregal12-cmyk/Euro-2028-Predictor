-- Contract 80: what happens to a matchweek card when its round locks.
--
-- The parity test reads the SQL and executes the TypeScript. This runs the SQL,
-- against the two rules that decide whether the season's scores are real.
--
-- ROLLING ENTRY. A player who never engaged the matchweek is unbanked. If this
-- ever returns a submission, every registered player is silently entered into
-- every matchweek with default predictions, and the resulting totals look
-- entirely plausible — which is what makes it worth running rather than only
-- reading.
--
-- PROVENANCE ON A CONFIRMED CARD. A prefilled default the player confirmed is
-- theirs. Confirmed cards report `autoCompleted: false` even when every value
-- came from a default, because confirming is the act of adopting the prefills.

begin;
select plan(12);

-- ---------------------------------------------------------------------------
-- Rolling entry: absence is not a submission.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_season_card_at_lock(
    '[{"fixtureId":"f1","defaultPrediction":{"home":1,"away":1},"playerPrediction":null}]'::jsonb,
    'no_submission'),
  '{"kind": "unbanked"}'::jsonb,
  'a card the player never engaged is unbanked'
);

select is(
  predictor_internal.resolve_season_card_at_lock('[]'::jsonb, 'no_submission'),
  '{"kind": "unbanked"}'::jsonb,
  'an unengaged card is unbanked even with no fixtures, rather than refused'
);

select is(
  predictor_internal.resolve_season_card_at_lock(
    '[{"fixtureId":"","defaultPrediction":null,"playerPrediction":null}]'::jsonb,
    'no_submission'),
  '{"kind": "unbanked"}'::jsonb,
  'an unengaged card is unbanked even when its fixtures are malformed'
);

-- ---------------------------------------------------------------------------
-- An engaged card completes from defaults, and says so.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_season_card_at_lock(
    '[{"fixtureId":"f1","defaultPrediction":{"home":1,"away":1},"playerPrediction":null}]'::jsonb,
    'provisional'),
  '{"kind": "submitted", "confirmed": false, "autoCompleted": true,
    "predictions": [{"fixtureId": "f1", "prediction": {"home": 1, "away": 1},
                     "provenance": "default"}]}'::jsonb,
  'a provisional gap is filled from the default and flagged as auto-completed'
);

select is(
  predictor_internal.resolve_season_card_at_lock(
    '[{"fixtureId":"f1","defaultPrediction":{"home":1,"away":1},
       "playerPrediction":{"home":3,"away":0}}]'::jsonb,
    'provisional'),
  '{"kind": "submitted", "confirmed": false, "autoCompleted": false,
    "predictions": [{"fixtureId": "f1", "prediction": {"home": 3, "away": 0},
                     "provenance": "player"}]}'::jsonb,
  'the player value wins where they gave one'
);

select is(
  (predictor_internal.resolve_season_card_at_lock(
    '[{"fixtureId":"f1","defaultPrediction":{"home":1,"away":1},"playerPrediction":null},
      {"fixtureId":"f2","defaultPrediction":{"home":0,"away":0},
       "playerPrediction":{"home":2,"away":2}}]'::jsonb,
    'provisional'))->>'autoCompleted',
  'true',
  'one filled gap on a mixed card is enough to be auto-completed'
);

-- ---------------------------------------------------------------------------
-- A confirmed card owns its prefills.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_season_card_at_lock(
    '[{"fixtureId":"f1","defaultPrediction":{"home":1,"away":1},"playerPrediction":null}]'::jsonb,
    'confirmed'),
  '{"kind": "submitted", "confirmed": true, "autoCompleted": false,
    "predictions": [{"fixtureId": "f1", "prediction": {"home": 1, "away": 1},
                     "provenance": "player"}]}'::jsonb,
  'a confirmed prefill is the player''s, and the card is not auto-completed'
);

-- ---------------------------------------------------------------------------
-- Contradictory cards refuse rather than submitting a guess.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_season_card_at_lock('[]'::jsonb, 'provisional'),
  '{"kind": "refused", "reason": "invalid_input"}'::jsonb,
  'an engaged card with no fixtures is refused'
);

select is(
  predictor_internal.resolve_season_card_at_lock(
    '[{"fixtureId":"f1","defaultPrediction":{},"playerPrediction":null}]'::jsonb,
    'provisional'),
  '{"kind": "refused", "reason": "invalid_input"}'::jsonb,
  'an empty object is not a scoreline — the three-valued-logic case'
);

select is(
  predictor_internal.resolve_season_card_at_lock(
    '[{"fixtureId":"f1","defaultPrediction":{"home":1,"away":1},
       "playerPrediction":{"home":2.5,"away":1}}]'::jsonb,
    'provisional'),
  '{"kind": "refused", "reason": "invalid_input"}'::jsonb,
  'a fractional prediction is refused rather than truncated'
);

select is(
  predictor_internal.resolve_season_card_at_lock(
    '[{"fixtureId":"f1","defaultPrediction":{"home":1,"away":1},"playerPrediction":null},
      {"fixtureId":"f1","defaultPrediction":{"home":1,"away":1},"playerPrediction":null}]'::jsonb,
    'provisional'),
  '{"kind": "refused", "reason": "duplicate_fixture"}'::jsonb,
  'the same fixture twice is refused rather than deduplicated'
);

select is(
  predictor_internal.resolve_season_card_at_lock(
    '[{"fixtureId":"f1","defaultPrediction":{"home":-1,"away":1},"playerPrediction":null},
      {"fixtureId":"f1","defaultPrediction":{"home":1,"away":1},"playerPrediction":null}]'::jsonb,
    'provisional'),
  '{"kind": "refused", "reason": "invalid_input"}'::jsonb,
  'each fixture is checked fully before the next, so the bad default wins over the duplicate'
);

select * from finish();
rollback;
