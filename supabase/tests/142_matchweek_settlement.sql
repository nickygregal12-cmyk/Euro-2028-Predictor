-- Contract 91: what a matchweek card means for scoring.
--
-- These functions take jsonb and return jsonb, touching no relation, so every
-- rule is exercisable with no seeded rows. That makes this the behavioural half
-- of the parity: the TypeScript suite executes the TypeScript and READS the
-- SQL, and reading cannot catch a rule that changed shape while keeping its
-- keywords.
--
-- THE RULE MOST WORTH PROTECTING is the matches-played denominator. Void
-- leaves it, which is the obvious half; a fixture already CARRIED to a known
-- replay leaves it too, which is not — its slot belongs to the replay now, and
-- counting both would count one match twice. An implementation that remembered
-- only the void rule passes every test that has no abandoned fixture in it, and
-- `standings.ts` shows matches played beside points precisely so that "two
-- players on 84 points from 22 and 23 matchweeks are not tied in meaning".
--
-- THE FAULT THAT FAILS SILENTLY is three-valued logic in the score predicate.
-- `'{}'::jsonb->'home'` is SQL NULL, `jsonb_typeof(NULL)` is NULL, and a NULL
-- inside a caller's `if not ...` does not fire — so a scoreless `completed`
-- fixture settles as scoreable with a null final score, and every player on
-- that matchweek is scored against nothing. The first version of this contract
-- had exactly that bug; a differential sweep caught it on seven cases. The
-- empty-object assertions below are its regression.

begin;
select plan(16);

-- ---------------------------------------------------------------------------
-- The score predicate, where the three-valued trap lives.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.is_settlement_score('{"home": 2, "away": 1}'::jsonb),
  true,
  'a whole non-negative scoreline is a score'
);

select is(
  predictor_internal.is_settlement_score('{}'::jsonb),
  false,
  'an empty object is NOT a score — and returns false, not null, or the caller''s NOT would vanish'
);

select is(
  predictor_internal.is_settlement_score(null::jsonb),
  false,
  'and neither is a null'
);

select is(
  predictor_internal.is_settlement_score('{"home": 1.5, "away": 0}'::jsonb),
  false,
  'a fractional score is refused — JSON has one number type, so 1.5 arrives as a number'
);

select is(
  predictor_internal.is_settlement_score('{"home": -1, "away": 0}'::jsonb),
  false,
  'and a negative one is refused'
);

-- ---------------------------------------------------------------------------
-- The denominator, including the half that is easy to miss.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_matchweek_settlement(
    '[{"id":"a","state":"completed","score":{"home":1,"away":0},"replayFixtureId":null},
      {"id":"b","state":"void","score":null,"replayFixtureId":null}]'::jsonb)
    -> 'settlement' ->> 'matchesPlayedDenominator',
  '1',
  'a void fixture leaves the matches-played denominator'
);

select is(
  predictor_internal.resolve_matchweek_settlement(
    '[{"id":"a","state":"completed","score":{"home":1,"away":0},"replayFixtureId":null},
      {"id":"b","state":"abandoned","score":null,"replayFixtureId":"r1"}]'::jsonb)
    -> 'settlement' ->> 'matchesPlayedDenominator',
  '1',
  'and so does a fixture already carried to a known replay — its slot belongs to the replay'
);

select is(
  predictor_internal.resolve_matchweek_settlement(
    '[{"id":"a","state":"completed","score":{"home":1,"away":0},"replayFixtureId":null},
      {"id":"b","state":"abandoned","score":null,"replayFixtureId":null}]'::jsonb)
    -> 'settlement' ->> 'matchesPlayedDenominator',
  '2',
  'but an abandoned fixture with NO replay yet still counts — nothing has taken its slot'
);

-- ---------------------------------------------------------------------------
-- Settlement, and the carries persistence must make.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_matchweek_settlement(
    '[{"id":"a","state":"completed","score":{"home":1,"away":0},"replayFixtureId":null},
      {"id":"b","state":"void","score":null,"replayFixtureId":null},
      {"id":"c","state":"abandoned","score":{"home":0,"away":0},"replayFixtureId":"r1"}]'::jsonb)
    -> 'settlement' ->> 'settled',
  'true',
  'a card of completed, void and carried fixtures has settled'
);

select is(
  predictor_internal.resolve_matchweek_settlement(
    '[{"id":"a","state":"completed","score":{"home":1,"away":0},"replayFixtureId":null},
      {"id":"b","state":"abandoned","score":null,"replayFixtureId":null}]'::jsonb)
    -> 'settlement' ->> 'settled',
  'false',
  'an abandoned fixture awaiting its replay keeps the card unsettled'
);

select is(
  predictor_internal.resolve_matchweek_settlement(
    '[{"id":"a","state":"scheduled","score":null,"replayFixtureId":null}]'::jsonb)
    -> 'settlement' ->> 'settled',
  'false',
  'and so does a fixture still awaiting its result'
);

select is(
  predictor_internal.resolve_matchweek_settlement(
    '[{"id":"c","state":"abandoned","score":{"home":2,"away":2},"replayFixtureId":"r1"}]'::jsonb)
    -> 'settlement' -> 'predictionCarries',
  '[{"toFixtureId": "r1", "fromFixtureId": "c"}]'::jsonb,
  'the prediction carries to the replay in full — the abandoned partial score never stands'
);

-- ---------------------------------------------------------------------------
-- A contradictory card refuses WHOLE, and the reason is part of the contract.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_matchweek_settlement(
    '[{"id":"a","state":"completed","score":{},"replayFixtureId":null}]'::jsonb),
  '{"ok": false, "reason": "completed_without_result"}'::jsonb,
  'a completed fixture with an empty score object is refused — the three-valued regression'
);

select is(
  predictor_internal.resolve_matchweek_settlement(
    '[{"id":"a","state":"void","score":{"home":1,"away":0},"replayFixtureId":null}]'::jsonb),
  '{"ok": false, "reason": "score_on_unplayed_fixture"}'::jsonb,
  'a score on a fixture that will never be played is contradictory, not a harmless extra'
);

select is(
  predictor_internal.resolve_matchweek_settlement(
    '[{"id":"a","state":"completed","score":{"home":1,"away":0},"replayFixtureId":"r1"}]'::jsonb),
  '{"ok": false, "reason": "replay_on_non_abandoned_fixture"}'::jsonb,
  'only an abandoned fixture may name a replay'
);

select is(
  predictor_internal.resolve_matchweek_settlement(
    '[{"id":"a","state":"abandoned","score":null,"replayFixtureId":"a"}]'::jsonb),
  '{"ok": false, "reason": "replay_self_reference"}'::jsonb,
  'and a fixture cannot be its own replay'
);

select * from finish();
rollback;
