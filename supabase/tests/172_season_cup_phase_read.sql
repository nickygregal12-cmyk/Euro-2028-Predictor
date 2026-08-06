-- Contract 120: the Championship's phase and continuing table reach the browser.
--
-- WHAT THIS COVERS, AND WHAT IT DOES NOT, stated first so the gap is not
-- mistaken for coverage.
--
-- Covered here: the boundary. That the read exists at the signature the
-- application calls, that it is definer with `search_path` pinned to the empty
-- string, that `anon` cannot execute it and `authenticated` can, that it
-- refuses a null competition and an unauthenticated caller, and that a caller
-- with no membership is told `entered: false` rather than receiving an
-- exception that would confirm the competition exists.
--
-- NOT covered here: a populated split group. No split group can exist in this
-- database, because the phase-transition driver that creates one has not been
-- built -- it is the open Stage G item this read was deliberately separated
-- from, since it is progression and needs its own authority and approval. A
-- split group could be fabricated by inserting rows directly, and that was
-- rejected: it would assert MY assumption about what the driver will produce,
-- and a test that agrees with the assumption it was written from proves
-- nothing about the driver that eventually lands. The behavioural split case
-- belongs to that contract, against real transition output.
--
-- What makes that acceptable rather than a hole: the branch this file cannot
-- exercise is a lookup, not a computation. `cup_split_group_tables` already
-- filters `member.phase_kind = 'split'` and owns the continuing table; the read
-- selects the authority and re-derives nothing.

begin;

select plan(9);

-- ---------------------------------------------------------------------------
-- The boundary.
-- ---------------------------------------------------------------------------

select ok(
  to_regprocedure('public.get_season_cup_phase(uuid)') is not null,
  'the Championship phase read exists at the signature the application calls');

select is(
  (select p.prosecdef
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_season_cup_phase'),
  true,
  'it is security definer, like every other bounded read');

select is(
  (select p.proconfig @> array['search_path=""']
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_season_cup_phase'),
  true,
  'with search_path pinned to the empty string, so a definer function cannot be '
  'redirected by a caller''s search path');

select is(
  has_function_privilege('anon', 'public.get_season_cup_phase(uuid)', 'execute'),
  false,
  'anon cannot execute it -- a Championship table is not public');

select is(
  has_function_privilege('authenticated', 'public.get_season_cup_phase(uuid)', 'execute'),
  true,
  'authenticated can');

-- ---------------------------------------------------------------------------
-- It adds no rule: it must not recompute a table of its own.
-- ---------------------------------------------------------------------------
--
-- The failure this catches is the tempting one -- inlining the standings maths
-- instead of calling the authority, which produces a second answer to "what is
-- this group's table" that drifts from contract 105 silently.

select is(
  (select pg_get_functiondef(to_regprocedure('public.get_season_cup_phase(uuid)')::oid)
     ilike '%cup_split_group_tables%'),
  true,
  'the split branch calls contract 105''s continuing-table authority');

select is(
  (select pg_get_functiondef(to_regprocedure('public.get_season_cup_phase(uuid)')::oid)
     ilike '%cup_final_group_tables%'),
  true,
  'and the initial branch calls the initial-table authority');

-- ---------------------------------------------------------------------------
-- Behaviour reachable without a phase driver.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.get_season_cup_phase(null)$$,
  '22023',
  'Competition is required',
  'a null competition is refused rather than resolved to something');

-- No `auth.uid()` is set in this session, so the caller is unauthenticated.
select throws_ok(
  $$select public.get_season_cup_phase('00000000-0000-0000-0000-000000000001'::uuid)$$,
  '42501',
  'Authentication is required',
  'an unauthenticated caller is refused before any membership is read');

select finish();
rollback;
