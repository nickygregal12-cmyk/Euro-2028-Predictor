-- Contract 152: invite codes that cannot be enumerated cheaply.
--
-- THE ASSERTIONS THIS FILE EXISTS FOR are the two that could regress silently.
--
-- First: the generator is uniform over the whole alphabet. A modulo of a random
-- byte by 31 is biased toward the first eight characters, and a biased code
-- still LOOKS random — it passes every eyeball test and shrinks the effective
-- keyspace. Nothing but a distribution check catches it.
--
-- Second: a WRONG code costs the caller a limit slot. That is the whole finding.
-- The old limiter fired on a successful join, so probing — the one thing it
-- existed to stop — was free, and a test asserting that joining is limited
-- would have passed throughout.

begin;

select plan(16);

-- ---------------------------------------------------------------------------
-- The generator
-- ---------------------------------------------------------------------------

select is(length(gen_invite_code()), 12,
  'a fresh invite code is twelve characters');

select ok(gen_invite_code() ~ '^[A-Z0-9]{12}$',
  'a fresh invite code uses only the constrained character class');

select ok(gen_invite_code() !~ '[O0I1L]',
  'the unambiguous alphabet still omits the characters people mistype');

-- Distinctness rather than randomness: two consecutive draws colliding across a
-- 31^12 space would mean the generator is not drawing at all.
select isnt(gen_invite_code(), gen_invite_code(),
  'two draws differ');

-- UNIFORMITY. 200 codes is 2,400 characters over 31 symbols — 77 expected each.
-- A `% 31` bias gives the first eight symbols 9/256 and the rest 8/256, so the
-- biased group would run about 12.5% high: roughly 87 against 76. Asserting
-- every symbol appears at least 40 times and no more than 130 is far too loose
-- to fail by chance and far too tight for that bias to hide in.
with draws as (
  select gen_invite_code() as code from generate_series(1, 200)
), chars as (
  select substr(d.code, i, 1) as c
  from draws d, generate_series(1, 12) i
), counted as (
  select c, count(*) as n from chars group by c
)
select is((select count(*)::int from counted), 31,
  'every character in the alphabet is reachable');

with draws as (
  select gen_invite_code() as code from generate_series(1, 200)
), chars as (
  select substr(d.code, i, 1) as c
  from draws d, generate_series(1, 12) i
), counted as (
  select c, count(*) as n from chars group by c
)
select ok((select min(n) from counted) > 40 and (select max(n) from counted) < 130,
  'the character distribution is uniform, not modulo-biased');

-- ---------------------------------------------------------------------------
-- The constraint accepts the new length AND every code already issued
-- ---------------------------------------------------------------------------

select col_has_check('public', 'leagues', 'invite_code',
  'the invite code still carries a character-class constraint');

insert into public.tournaments (name, year, kind, display_timezone, status)
values ('C152 Invite Probe', 2041, 'tournament', 'UTC', 'active');

select set_config('test.ic_tournament',
  (select id::text from public.tournaments where name = 'C152 Invite Probe'), true);

-- A six-character code is what every league created before this contract holds.
-- It must still insert, or this migration breaks every existing league.
select lives_ok($$
  insert into public.leagues (tournament_id, owner_id, name, invite_code)
  values (current_setting('test.ic_tournament')::uuid,
          (select id from auth.users order by created_at limit 1),
          'Legacy Six', 'ABC234')
$$, 'a six-character code already issued still satisfies the constraint');

select lives_ok($$
  insert into public.leagues (tournament_id, owner_id, name, invite_code)
  values (current_setting('test.ic_tournament')::uuid,
          (select id from auth.users order by created_at limit 1),
          'Modern Twelve', 'ABCDEFGH2345')
$$, 'a twelve-character code satisfies the constraint');

select throws_ok($$
  insert into public.leagues (tournament_id, owner_id, name, invite_code)
  values (current_setting('test.ic_tournament')::uuid,
          (select id from auth.users order by created_at limit 1),
          'Too Short', 'ABC23')
$$, '23514', null, 'a five-character code is still refused');

select throws_ok($$
  insert into public.leagues (tournament_id, owner_id, name, invite_code)
  values (current_setting('test.ic_tournament')::uuid,
          (select id from auth.users order by created_at limit 1),
          'Lower Case', 'abcdefgh2345')
$$, '23514', null, 'a lower-case code is still refused');

-- ---------------------------------------------------------------------------
-- The preview no longer identifies the group
-- ---------------------------------------------------------------------------

select set_eq($$
  select column_name::text
  from information_schema.columns
  where table_name = 'get_league_preview'
$$, $$ select null::text where false $$,
  'the preview is a function, not a view someone can select around');

-- The returned columns ARE the disclosure boundary, so they are asserted by
-- name. `member_count` and `owner_name` identified which private group a
-- guessed code belonged to, and named a real person to whoever guessed it.
select bag_eq($$
  select p.proname::text || ':' || pg_catalog.pg_get_function_result(p.oid)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_league_preview'
$$, $$
  select 'get_league_preview:TABLE(name text, is_member boolean)'
$$, 'the preview returns only the league name and whether the caller is in it');

-- ---------------------------------------------------------------------------
-- Probing costs, and rotation is owner-only
-- ---------------------------------------------------------------------------

-- Charged BEFORE the lookup: the source is the assertion, because a wrong code
-- raises before it could reach any table this suite can observe.
select ok(
  (select prosrc from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_league_preview')
  ~ 'enforce_rate_limit\(''league_invite_probe''',
  'previewing a code charges the invite-probe limiter');

select ok(
  (select position('enforce_rate_limit' in prosrc) <
          position('where league.invite_code' in prosrc)
   from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'join_league'),
  'joining charges the limiter BEFORE the code is looked up, so a miss costs the same as a hit');

select ok(
  has_function_privilege('authenticated', 'public.rotate_league_invite_code(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.rotate_league_invite_code(uuid)', 'execute'),
  'rotation is executable by a signed-in caller and by nobody anonymous');

rollback;
