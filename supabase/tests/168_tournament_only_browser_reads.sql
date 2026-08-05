-- Browser-callable reads that can only see tournament fixtures.
--
-- WHY THIS GUARD EXISTS. The same defect has now been found twice, by hand,
-- months apart, and in both cases the write worked while the read did not:
--
--   - contract 86 found `assert_bonus_lms_selection_shape` reading
--     `bonus_window_fixtures -> public.matches`, so EVERY season Last Man
--     Standing pick was refused with "The picked team does not play in this
--     round" — including an ordinary player picking a club that was playing;
--   - contract 116 found `get_my_lms` doing the identical thing on the read
--     side, returning season rounds with empty fixture arrays, so a player
--     could save a pick whose fixtures they could not see.
--
-- Both had the same cause, stated in contract 86's own words: the function was
-- written for the tournament and defined once, and nothing since widened it.
-- A season round's fixtures live in `season_cup_window_fixtures ->
-- season_fixtures`, and a function that joins only the tournament link is
-- silently blind to them. Silently is the problem — nothing failed, nothing
-- errored, an array was just empty.
--
-- So the pattern is pinned rather than left to be rediscovered a third time.
-- Every browser-callable function that reaches `bonus_window_fixtures` must be
-- listed below with its verdict. A new one fails this test until someone has
-- decided which it is: a tournament-only function that is correct to be so, or
-- the next instance of this bug.
--
-- THIS IS A LIST OF FUNCTIONS, NOT A LIST OF DEFECTS. Being on it is not an
-- accusation — `get_my_lms` is on it and is now correct, because the season
-- path it cannot serve has its own function. What the list forbids is a
-- function joining that table without anyone having thought about seasons.

begin;

select plan(4);

-- ---------------------------------------------------------------------------
-- The reviewed list.
-- ---------------------------------------------------------------------------

create temporary table tournament_only_reads (name text primary key, verdict text) on commit drop;

insert into tournament_only_reads (name, verdict) values
  ('get_my_lms',
   'SERVED. Tournament-only by design since contract 116: the season path is '
   'get_season_lms_round, which reads season_cup_window_fixtures and returns '
   'the survival verdict from the settlement authority.'),
  ('get_my_cup',
   'NOT SERVED. A season Predictor Championship stores its round fixtures in '
   'season_cup_window_fixtures, so this returns empty fixture arrays for one — '
   'the same defect contract 116 closed for Last Man Standing. Its season '
   'counterpart is outstanding work, recorded here so a Championship surface '
   'is not built on a read that cannot see its own fixtures.'),
  ('get_bonus_games',
   'NOT SERVED, and the widest of the three. This is the games hub listing, so '
   'a season game appears in it with no kickoffs behind it: the per-window '
   'fixture block joins bonus_window_fixtures to public.matches like the rest. '
   'Whatever it drives — next deadline, settled state — is blank or wrong for a '
   'season, and it is the read a player meets FIRST.'),
  ('submit_cup_penalty_number',
   'Tournament-only, and a WRITE rather than a read. It validates the Cup '
   'tie-break input against the round''s fixtures. A season Championship that '
   'needs a penalty number will need this widened or partnered, on the same '
   'reasoning as contract 86 widening the Last Man Standing selection shape.'),
  ('admin_settle_predictor_cup_round',
   'Tournament-only BY DESIGN. Season Championship settlement has its own '
   'authorities (the cup_window_settled and cup_tournament_* helpers split '
   'tournament from season deliberately), so this one is not a gap.');

select is(
  (select coalesce(jsonb_agg(candidate.proname order by candidate.proname), '[]'::jsonb)
     from (
       select p.proname
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          -- Plain functions only: pg_get_functiondef raises on an aggregate or
          -- a procedure, which would fail this guard for a reason that has
          -- nothing to do with what it is checking.
          and p.prokind = 'f'
          and has_function_privilege('authenticated', p.oid, 'execute')
          and pg_get_functiondef(p.oid) like '%bonus_window_fixtures%'
          and p.proname not in (select name from tournament_only_reads)
        group by p.proname
     ) candidate),
  '[]'::jsonb,
  'every browser-callable function reaching bonus_window_fixtures is reviewed — '
  'a new one is either correct to be tournament-only or the next instance of the '
  'contract 86/116 defect, and someone must say which');

-- The inverse: an entry that no longer describes anything real is deleted
-- rather than left to rot, exactly as the reviewed-pairings list in
-- `cssTokenPairings.test.ts` is kept honest.
select is(
  (select coalesce(jsonb_agg(stale.name order by stale.name), '[]'::jsonb)
     from tournament_only_reads stale
    where not exists (
      select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.prokind = 'f'
         and p.proname = stale.name
         and pg_get_functiondef(p.oid) like '%bonus_window_fixtures%'
    )),
  '[]'::jsonb,
  'reviewed entries that no longer join bonus_window_fixtures — delete them');

-- ---------------------------------------------------------------------------
-- The counterpart that closed the Last Man Standing half.
-- ---------------------------------------------------------------------------

select ok(
  to_regprocedure('public.get_season_lms_round(uuid)') is not null,
  'the season Last Man Standing read exists, which is what makes get_my_lms''s '
  'tournament-only scope a design rather than a gap');

select is(
  (select pg_get_functiondef(to_regprocedure('public.get_season_lms_round(uuid)')::oid)
     like '%season_cup_window_fixtures%'),
  true,
  'and it reads the season fixture link rather than the tournament one');

select finish();
rollback;
