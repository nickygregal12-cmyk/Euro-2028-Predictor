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
  ('get_bonus_games',
   'NOT SERVED, and the consequence is now traced rather than guessed. This is '
   'the games hub listing — the read a player meets FIRST. Its per-window '
   'fixtures block joins bonus_window_fixtures to public.matches with no branch '
   'on competition kind, so a season window returns fixtures: []. Downstream, '
   'deriveWindowFixtureAggregate then reports total 0, and '
   'resolveCompetitionStatus treats a window as settled only when '
   '"total > 0 and confirmed >= total" — which can never hold. So a season '
   'competition''s FIRST LOCKED ROUND stays "in flight" permanently: the hub '
   'card sticks on it, showing a stale round and a stale deadline, and never '
   'advances. round_live and round_awaiting_confirmation are unreachable for a '
   'season for the same reason. Traced through the code rather than executed, '
   'so the mechanism is stated and not the symptom.');

-- WHAT THIS LIST NO LONGER CLAIMS, and why the correction is recorded rather
-- than quietly dropped. get_my_cup, submit_cup_penalty_number and
-- admin_settle_predictor_cup_round were listed here on a first pass, on the
-- strength of reading the migration files. All three were WRONG: their current
-- definitions do not touch bonus_window_fixtures at all. get_my_cup now routes
-- through cup_window_scores and cup_window_settled — the neutral helpers the
-- cup_neutral_* contracts introduced precisely to split tournament from season
-- — and the other two were superseded the same way.
--
-- The mistake is instructive enough to keep: the file-reading missed later
-- redefinitions written in UPPERCASE, and over-ran function bodies terminated
-- with $function$ rather than $$, so it attributed one function's text to
-- another. pg_get_functiondef against a built database has neither problem,
-- which is the entire reason this guard queries the catalogue instead of
-- grepping the tree — and it caught its own author's error on the first run.

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
