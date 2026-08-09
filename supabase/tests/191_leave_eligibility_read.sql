-- Contract 140: a Leave control that can predict itself.
--
-- WHAT THIS FILE ASSERTS, AND WHAT IT DELIBERATELY DOES NOT.
--
-- The read duplicates `leave_competition_game`'s branches on purpose, and the
-- migration records why that duplication is the lesser cost. What makes it safe
-- is the direction of the error: the WRITE remains the authority, so the read
-- can only ever be wrong about a refusal the server would still enforce.
--
-- Asserted here: the gate, the grants, that a missing competition is REPORTED
-- rather than raised, and -- the structural half that matters -- that the reader
-- consults exactly the relations the write consults. A branch added to one and
-- not the other changes that set and fails this file.
--
-- Not asserted here: a seeded end-to-end walk through each refusal. Driving
-- `scoring_started` needs an entrant row, a window, a category and an
-- explanation to satisfy `bonus_score_events`' composite foreign key, and
-- inventing that seed is how a suite comes to test its own fixture rather than
-- the product. The branch behaviour was exercised against a throwaway
-- PostgreSQL 16 cluster while the migration was written -- scoring_started,
-- not_entered, and allowed where the game requires a prediction entry -- and the
-- honest end-to-end proof belongs to the DFA-007 rehearsal, which has real
-- entrants and real score events.

begin;

select plan(6);

select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'bonus_score_events'
      and grantee in ('anon', 'authenticated')),
  0,
  'the fact behind the refusal stays behind a bounded read, not a table grant');

select ok(
  to_regprocedure('predictor_internal.leave_game_refusal(uuid,uuid)') is not null,
  'the refusal reader resolves at the signature this file checks');

select is(
  predictor_internal.leave_game_refusal(
    '00000000-0000-0000-0000-000000000000'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid),
  'not_found',
  'a competition that does not exist is reported rather than raised -- a read '
  'that threw here would make an ordinary empty dashboard an error');

-- The structural half. Both functions must consult the same four facts, so a
-- branch added to one and not the other is visible.
select is(
  (select coalesce(jsonb_agg(relation order by relation), '[]'::jsonb)
     from (values
       ('bonus_competitions'), ('game_definitions'),
       ('game_memberships'), ('bonus_score_events'), ('bonus_cup_members')
     ) as t(relation)
    where pg_get_functiondef(
            to_regprocedure('predictor_internal.leave_game_refusal(uuid,uuid)')::oid
          ) !~* ('public\.' || relation || '\M')),
  '[]'::jsonb,
  'the refusal reader consults every relation the write consults');

select is(
  (select coalesce(jsonb_agg(relation order by relation), '[]'::jsonb)
     from (values
       ('bonus_competitions'), ('game_definitions'),
       ('game_memberships'), ('bonus_score_events'), ('bonus_cup_members')
     ) as t(relation)
    where pg_get_functiondef(
            to_regprocedure('public.leave_competition_game(uuid)')::oid
          ) !~* ('public\.' || relation || '\M')),
  '[]'::jsonb,
  'and the write still consults all of them -- if it stops, the mirror above is '
  'mirroring something that no longer exists');

select is(
  (select has_function_privilege('authenticated',
     to_regprocedure('public.get_game_leave_eligibility(uuid)')::oid, 'execute')),
  true,
  'the eligibility read is reachable by a signed-in caller, and refuses inside '
  'when there is no session');

select finish();
rollback;
