-- Contract 73: how a Last Man Standing round ends.
--
-- The parity test reads the branch order. This runs it, against the case the
-- ordering protects: a sole survivor who only survived because their fixture
-- was postponed has beaten nobody, so the round continues. Crown them instead
-- and the competition ends on a match that was never played, and the output
-- looks like an ordinary win.

begin;
select plan(14);

-- ---------------------------------------------------------------------------
-- A postponement cannot win.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.conclude_lms_round(
    '[{"entryId":"a","alive":true,"viaPostponement":true},
      {"entryId":"b","alive":false,"viaPostponement":false}]'::jsonb,
    'private', 'play_on'),
  '{"kind": "continues_postponement_cannot_win", "soleSurvivorEntryId": "a"}'::jsonb,
  'a sole survivor via postponement continues rather than winning'
);

select is(
  predictor_internal.conclude_lms_round(
    '[{"entryId":"a","alive":true,"viaPostponement":false},
      {"entryId":"b","alive":false,"viaPostponement":false}]'::jsonb,
    'private', 'play_on'),
  '{"kind": "winner", "entryId": "a"}'::jsonb,
  'a sole survivor who played takes the title'
);

select is(
  predictor_internal.conclude_lms_round(
    '[{"entryId":"a","alive":true,"viaPostponement":false},
      {"entryId":"b","alive":true,"viaPostponement":false}]'::jsonb,
    'private', 'play_on'),
  '{"kind": "continues"}'::jsonb,
  'more than one survivor continues'
);

-- ---------------------------------------------------------------------------
-- The wipeout round, which ADR 0013 treats as likely rather than exceptional.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.conclude_lms_round(
    '[{"entryId":"a","alive":false,"viaPostponement":false}]'::jsonb,
    'private', 'play_on'),
  '{"kind": "wipeout_play_on"}'::jsonb,
  'a private play-on wipeout continues'
);

select is(
  predictor_internal.conclude_lms_round(
    '[{"entryId":"a","alive":false,"viaPostponement":false}]'::jsonb,
    'private', 'reset'),
  '{"kind": "reset_no_winner"}'::jsonb,
  'a private reset wipeout ends with no winner'
);

select is(
  predictor_internal.conclude_lms_round(
    '[{"entryId":"b","alive":false,"viaPostponement":false},
      {"entryId":"a","alive":false,"viaPostponement":false}]'::jsonb,
    'private', 'shared_win'),
  '{"kind": "shared_win", "entryIds": ["a", "b"]}'::jsonb,
  'a private shared-win wipeout returns its ids sorted, not in arrival order'
);

-- ---------------------------------------------------------------------------
-- The public joint-winner cap: three share, four restart.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.conclude_lms_round(
    '[{"entryId":"c","alive":false,"viaPostponement":false},
      {"entryId":"a","alive":false,"viaPostponement":false},
      {"entryId":"b","alive":false,"viaPostponement":false}]'::jsonb,
    'public', null),
  '{"kind": "shared_win", "entryIds": ["a", "b", "c"]}'::jsonb,
  'three entrants at the public cap share the win'
);

select is(
  predictor_internal.conclude_lms_round(
    '[{"entryId":"a","alive":false,"viaPostponement":false},
      {"entryId":"b","alive":false,"viaPostponement":false},
      {"entryId":"c","alive":false,"viaPostponement":false},
      {"entryId":"d","alive":false,"viaPostponement":false}]'::jsonb,
    'public', null),
  '{"kind": "restart_all_reentered"}'::jsonb,
  'four entrants exceed the cap and everyone re-enters'
);

-- ---------------------------------------------------------------------------
-- A malformed round is refused, never repaired.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.conclude_lms_round('[]'::jsonb, 'private', 'play_on'),
  '{"kind": "refused", "reason": "invalid_input"}'::jsonb,
  'an empty round is refused'
);

select is(
  predictor_internal.conclude_lms_round(
    '[{"entryId":"a","alive":true,"viaPostponement":false},
      {"entryId":"a","alive":false,"viaPostponement":false}]'::jsonb,
    'private', 'play_on'),
  '{"kind": "refused", "reason": "invalid_input"}'::jsonb,
  'the same entrant twice is refused rather than deduplicated'
);

select is(
  predictor_internal.conclude_lms_round(
    '[{"entryId":"  ","alive":true,"viaPostponement":false}]'::jsonb,
    'private', 'play_on'),
  '{"kind": "refused", "reason": "invalid_input"}'::jsonb,
  'a blank entry id is refused'
);

select is(
  predictor_internal.conclude_lms_round(
    '[{"entryId":"a","alive":false,"viaPostponement":false}]'::jsonb,
    'private', null),
  '{"kind": "refused", "reason": "invalid_input"}'::jsonb,
  'a private endgame with no wipeout rule is refused, not guessed'
);

-- ---------------------------------------------------------------------------
-- Season exhaustion: shared under play on, undecided otherwise.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_lms_season_exhaustion(array['b','a'], 'private', 'play_on'),
  '{"kind": "shared_win", "entryIds": ["a", "b"]}'::jsonb,
  'running out of fixtures under play on shares the win'
);

select is(
  predictor_internal.resolve_lms_season_exhaustion(array['a','b'], 'private', 'reset'),
  null,
  'any other rule is undecided, and returns null rather than inventing a winner'
);

select * from finish();
rollback;
