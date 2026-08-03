-- Contract 71: Last Man Standing pick resolution.
--
-- The parity test reads the SQL. This runs it, against the case that matters:
-- an entrant who loses while holding Saves must go out. A Save rescues a draw
-- and never a defeat, and getting that wrong leaves state that looks entirely
-- plausible — a survivor with one fewer Save.

begin;
select plan(11);

-- ---------------------------------------------------------------------------
-- A Save rescues a draw. A Save never rescues a defeat.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_lms_pick('drew', 'eliminate', 1, 1),
  '{"alive": true, "via": "save", "livesRemaining": 1, "savesRemaining": 0}'::jsonb,
  'a draw spends a Save and keeps the Life'
);

select is(
  predictor_internal.resolve_lms_pick('lost', 'eliminate', 1, 1),
  '{"alive": true, "via": "life", "livesRemaining": 0, "savesRemaining": 1}'::jsonb,
  'a defeat spends a Life and leaves the Save untouched'
);

select is(
  predictor_internal.resolve_lms_pick('lost', 'eliminate', 0, 2),
  '{"alive": false, "livesRemaining": 0, "savesRemaining": 2}'::jsonb,
  'a defeat with Saves but no Lives eliminates — a Save cannot rescue it'
);

select is(
  predictor_internal.resolve_lms_pick('drew', 'eliminate', 1, 0),
  '{"alive": true, "via": "life", "livesRemaining": 0, "savesRemaining": 0}'::jsonb,
  'a draw falls through to a Life once Saves are gone'
);

select is(
  predictor_internal.resolve_lms_pick('drew', 'eliminate', 0, 0),
  '{"alive": false, "livesRemaining": 0, "savesRemaining": 0}'::jsonb,
  'a draw with neither currency eliminates'
);

-- ---------------------------------------------------------------------------
-- Outcomes that cost nothing.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_lms_pick('won', 'eliminate', 2, 2),
  '{"alive": true, "via": "win", "livesRemaining": 2, "savesRemaining": 2}'::jsonb,
  'a win spends nothing'
);

select is(
  predictor_internal.resolve_lms_pick('postponed', 'eliminate', 0, 0),
  '{"alive": true, "via": "postponement", "livesRemaining": 0, "savesRemaining": 0}'::jsonb,
  'a postponement survives even with nothing left to spend'
);

select is(
  predictor_internal.resolve_lms_pick('drew', 'survive', 0, 0),
  '{"alive": true, "via": "draw_survives", "livesRemaining": 0, "savesRemaining": 0}'::jsonb,
  'a draw survives untouched when the preset does not eliminate on draws'
);

-- ---------------------------------------------------------------------------
-- Invalid input is refused, never survived.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_lms_pick('lost', 'eliminate', -1, 0),
  '{"refused": "invalid_input"}'::jsonb,
  'a negative Life count is refused rather than treated as none'
);

select is(
  predictor_internal.resolve_lms_pick('exploded', 'eliminate', 1, 1),
  '{"refused": "invalid_input"}'::jsonb,
  'an unknown outcome is refused rather than falling through to elimination'
);

-- ---------------------------------------------------------------------------
-- The rule stays server-side.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from information_schema.role_routine_grants
    where routine_schema = 'predictor_internal'
      and routine_name = 'resolve_lms_pick'
      and grantee in ('anon', 'authenticated')),
  0,
  'no browser role may execute the LMS resolution'
);

select * from finish();
rollback;
