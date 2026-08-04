-- Contract 80's resolver, as redefined by contract 82.
--
-- The parity test reads the SQL and executes the TypeScript. This runs the SQL,
-- against the two rules that decide whether the season's scores are real.
--
-- THE CARD IS NOT PRE-FILLED. A fixture the player left blank submits no
-- prediction and scores nothing. ADR 0012 originally required a default on
-- every fixture and auto-completion at lock; contract 82 withdrew both, because
-- a player must not benefit from not filling something in. If a blank ever
-- produces a prediction here, every ignored fixture becomes a free entry, and
-- the resulting totals look entirely plausible — which is what makes this worth
-- running rather than only reading.
--
-- ROLLING ENTRY. A player who never engaged the matchweek is unbanked. Absence
-- and an empty card are different facts and must stay different.

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
  '{"kind": "submitted", "confirmed": false, "predictions": []}'::jsonb,
  'a blank fixture submits nothing — and the stale defaultPrediction is ignored, not honoured'
);

select is(
  predictor_internal.resolve_season_card_at_lock(
    '[{"fixtureId":"f1","defaultPrediction":{"home":1,"away":1},
       "playerPrediction":{"home":3,"away":0}}]'::jsonb,
    'provisional'),
  '{"kind": "submitted", "confirmed": false,
    "predictions": [{"fixtureId": "f1", "prediction": {"home": 3, "away": 0}}]}'::jsonb,
  'the value the player gave is the value submitted'
);

select is(
  predictor_internal.resolve_season_card_at_lock(
    '[{"fixtureId":"f1","playerPrediction":null},
      {"fixtureId":"f2","playerPrediction":{"home":2,"away":2}}]'::jsonb,
    'provisional'),
  '{"kind": "submitted", "confirmed": false,
    "predictions": [{"fixtureId": "f2", "prediction": {"home": 2, "away": 2}}]}'::jsonb,
  'a partial card submits its filled fixtures and nothing for the blank'
);

-- ---------------------------------------------------------------------------
-- Confirmation records intent and changes no scoring.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_season_card_at_lock(
    '[{"fixtureId":"f1","defaultPrediction":{"home":1,"away":1},"playerPrediction":null}]'::jsonb,
    'confirmed'),
  '{"kind": "submitted", "confirmed": true, "predictions": []}'::jsonb,
  'confirming a card does not adopt anything — there are no prefills to adopt'
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
    '[{"fixtureId":"f1","playerPrediction":{}}]'::jsonb,
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
    '[{"fixtureId":"f1","playerPrediction":{"home":-1,"away":1}},
      {"fixtureId":"f1","playerPrediction":null}]'::jsonb,
    'provisional'),
  '{"kind": "refused", "reason": "invalid_input"}'::jsonb,
  'each fixture is checked fully before the next, so the bad value wins over the duplicate'
);

select * from finish();
rollback;
