-- Contract 96: which fault a contradictory Cup tie reports.
--
-- These are the two disagreements a differential sweep found between
-- `settleCupTie` and `settle_season_cup_tie` — a pair that had existed since
-- contract 74 with no parity suite, because nothing drives either of them and
-- an unused pair cannot fail loudly.
--
-- Neither fault ever mis-settled a tie. Both implementations always agreed on
-- WHETHER to refuse, and on the points when they did not. Only the reason
-- moved, and only for a tie wrong in more than one way at once — the class of
-- defect that survives review by looking like a judgement call.
--
-- The regressions below are the two exact cards the sweep disagreed on. If a
-- later edit reinstates the interleaved loop or the per-key check, these fail
-- with the reason the other language would have given.

begin;
select plan(10);

-- ---------------------------------------------------------------------------
-- FAULT ONE: the two entrants were interleaved.
--
-- Home is missing a confirmed fixture (d); away carries an off-scale value at
-- an EARLIER fixture (c). Walking the card once and checking both entrants per
-- fixture reaches away's fault first and reports the wrong entrant.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"a","confirmedByCutoff":true},{"fixtureId":"b","confirmedByCutoff":false},
      {"fixtureId":"c","confirmedByCutoff":true},{"fixtureId":"d","confirmedByCutoff":true}]'::jsonb,
    '{"entryId":"home","fixturePoints":{"a":3,"c":5}}'::jsonb,
    '{"entryId":"away","fixturePoints":{"a":3,"c":1,"d":3}}'::jsonb)->>'reason',
  'points_missing_for_confirmed_fixture',
  'home is evaluated COMPLETELY before away — interleaving them reported away''s off-scale value instead of home''s missing one'
);

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"a","confirmedByCutoff":true},{"fixtureId":"b","confirmedByCutoff":false},
      {"fixtureId":"c","confirmedByCutoff":false},{"fixtureId":"d","confirmedByCutoff":true}]'::jsonb,
    '{"entryId":"home","fixturePoints":{"a":0,"d":2}}'::jsonb,
    '{"entryId":"away","fixturePoints":{}}'::jsonb)->>'reason',
  'points_off_raw_scale',
  'and home''s off-scale value outranks away''s missing one, for the same reason'
);

-- ---------------------------------------------------------------------------
-- FAULT TWO: the reason depended on key order.
--
-- `zz` is on no fixture card; `b` is on the card but unconfirmed. jsonb stores
-- keys by (length, then bytes) and JavaScript preserves insertion order, so a
-- rule that read one key at a time could never agree across the two. Checking
-- every key for one condition before any key for the next makes the answer
-- independent of storage order in both languages.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"a","confirmedByCutoff":true},{"fixtureId":"b","confirmedByCutoff":false}]'::jsonb,
    '{"entryId":"home","fixturePoints":{"zz":3,"b":3,"a":3}}'::jsonb,
    '{"entryId":"away","fixturePoints":{"a":3}}'::jsonb)->>'reason',
  'invalid_input',
  'a key naming no fixture on the card outranks a key naming an unconfirmed one, whatever order they are stored in'
);

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"a","confirmedByCutoff":true},{"fixtureId":"b","confirmedByCutoff":false}]'::jsonb,
    '{"entryId":"home","fixturePoints":{"b":3,"zz":3,"a":3}}'::jsonb,
    '{"entryId":"away","fixturePoints":{"a":3}}'::jsonb)->>'reason',
  'invalid_input',
  'and writing the same two keys the other way round gives the same answer — the point of the two-pass shape'
);

-- ---------------------------------------------------------------------------
-- What contract 96 does NOT change: every settled tie settles as before.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"a","confirmedByCutoff":true},{"fixtureId":"b","confirmedByCutoff":true},
      {"fixtureId":"c","confirmedByCutoff":false}]'::jsonb,
    '{"entryId":"home","fixturePoints":{"a":5,"b":3}}'::jsonb,
    '{"entryId":"away","fixturePoints":{"a":3,"b":0}}'::jsonb),
  '{"ok": true, "settlement": {"away": {"points": 3, "entryId": "away", "matchPoints": 0},
     "home": {"points": 8, "entryId": "home", "matchPoints": 3}, "result": "home_win",
     "reducedSet": true, "fixtureCardSize": 3, "settledOnFixtures": 2}}'::jsonb,
  'a tie settled on 2 of 3 fixtures still settles the same way, and still says it was a reduced set'
);

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"a","confirmedByCutoff":true}]'::jsonb,
    '{"entryId":"home","fixturePoints":{"a":3}}'::jsonb,
    '{"entryId":"away","fixturePoints":{"a":3}}'::jsonb)
    ->'settlement'->>'result',
  'draw',
  'and equal totals are still a draw, worth one match point each'
);

-- ---------------------------------------------------------------------------
-- The refusals that were never in doubt, kept so the file cannot pass by
-- only exercising the two corrected paths.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"a","confirmedByCutoff":true}]'::jsonb,
    '{"entryId":"same","fixturePoints":{"a":3}}'::jsonb,
    '{"entryId":"same","fixturePoints":{"a":3}}'::jsonb)->>'reason',
  'same_entrant_twice',
  'an entrant cannot play themselves'
);

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"a","confirmedByCutoff":false},{"fixtureId":"b","confirmedByCutoff":false}]'::jsonb,
    '{"entryId":"home","fixturePoints":{}}'::jsonb,
    '{"entryId":"away","fixturePoints":{}}'::jsonb)->>'reason',
  'no_settled_fixtures',
  'and a tie whose whole card missed the cutoff has nothing to settle on'
);

select is(
  predictor_internal.settle_season_cup_tie(
    '[{"fixtureId":"a","confirmedByCutoff":true},{"fixtureId":"a","confirmedByCutoff":true}]'::jsonb,
    '{"entryId":"home","fixturePoints":{"a":3}}'::jsonb,
    '{"entryId":"away","fixturePoints":{"a":3}}'::jsonb)->>'reason',
  'duplicate_fixture',
  'a fixture listed twice would count once and be scored twice'
);

-- ---------------------------------------------------------------------------
-- The new helper is server-side only, like everything it replaced.
-- ---------------------------------------------------------------------------

select is(
  (select bool_or(has_function_privilege(role, fn, 'execute'))
     from unnest(array['anon', 'authenticated']) role,
          unnest(array['predictor_internal.settle_season_cup_tie(jsonb,jsonb,jsonb)',
                       'predictor_internal.cup_tie_entrant_total(jsonb,text[],text[])']) fn),
  false,
  'neither the tie settlement nor its new per-entrant helper is callable from a browser role'
);

select * from finish();
rollback;
