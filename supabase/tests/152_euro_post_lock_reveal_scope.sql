-- Contract 101: Euro post-lock reveal stops gating on shared leagues.
--
-- ADR 0025 decision 4, code half. Appendix D.2 asked for an append-only change
-- removing shared-league membership as the general gate for frozen Euro entry
-- and profile reveal after lock, while keeping the authoritative server-side
-- lock mandatory and leaving league-context match-pick reads league scoped.
--
-- The three functions were NOT the same shape, and the whole risk of this
-- change lives in that difference:
--
--   * `get_rival_entry` and `get_h2h_rank_history` already refused EVERY caller
--     before lock, then applied a second league gate on top. For those the
--     league gate was purely post-lock and is removed outright.
--
--   * `get_player_profile` had NO lock gate on access at all — the lock only
--     decided whether points and rank were appended. Deleting its league gate
--     would have exposed display name, league count and entry status to any
--     authenticated caller BEFORE lock. So it GAINS a lock condition as it
--     loses the league one, and pre-lock behaviour is unchanged.
--
-- Two players who share no league are used throughout, because a test where
-- the callers happen to be co-members proves nothing about a gate on
-- co-membership.
--
-- NOTE ON ARGUMENT ORDER, because the first draft of this file got it wrong and
-- the symptom was misleading: all three RPCs take the PLAYER first and the
-- tournament second — `get_player_profile(p_player_id, p_tournament_id)`,
-- `get_rival_entry(p_rival_id, p_tournament_id)`,
-- `get_h2h_rank_history(p_rival_id, p_tournament_id)`. Passing them the other
-- way round hands a player id to the tournament lookup and every call fails
-- with "Tournament not found", which reads like a seeding problem rather than a
-- caller mistake.

begin;
select plan(14);

create temporary table reveal (label text primary key, id uuid not null) on commit drop;

do $seed$
declare
  v_t uuid;
  v_a uuid := md5('c101-reveal-a')::uuid;
  v_b uuid := md5('c101-reveal-b')::uuid;
  v_ea uuid; v_eb uuid;
begin
  select id into v_t from public.tournaments where kind = 'tournament' order by year, name limit 1;

  -- Triggers suspended for auth.users only, matching the pattern established in
  -- 146; CHECK constraints stay in force under `replica`.
  set local session_replication_role = replica;
  insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values (v_a, 'reveal-a@example.test', 'authenticated', 'authenticated',
          '{}'::jsonb, '{}'::jsonb, now(), now()),
         (v_b, 'reveal-b@example.test', 'authenticated', 'authenticated',
          '{}'::jsonb, '{}'::jsonb, now(), now())
  on conflict (id) do nothing;
  set local session_replication_role = origin;

  insert into public.profiles (id, display_name)
  values (v_a, 'Reveal A'), (v_b, 'Reveal B')
  on conflict (id) do update set display_name = excluded.display_name;

  insert into public.entries (tournament_id, user_id) values (v_t, v_a)
  on conflict (tournament_id, user_id) do nothing;
  insert into public.entries (tournament_id, user_id) values (v_t, v_b)
  on conflict (tournament_id, user_id) do nothing;

  select id into v_ea from public.entries where tournament_id = v_t and user_id = v_a;
  select id into v_eb from public.entries where tournament_id = v_t and user_id = v_b;

  -- Both have SUBMITTED entries; neither shares a league with the other. The
  -- absence of a shared league is the whole point of the scenario.
  --
  -- Marking them submitted through the normal path would require a complete
  -- predicted knockout tree ("8 R16, 4 QF, 2 SF and 1 final"), which is a
  -- different contract's rule and nothing this file is testing. Triggers are
  -- suspended for this one update; the CHECK constraints stay in force.
  set local session_replication_role = replica;
  update public.entries set submitted_at = now() - interval '2 days'
   where id in (v_ea, v_eb);
  set local session_replication_role = origin;

  insert into reveal values ('tournament', v_t), ('a', v_a), ('b', v_b),
                            ('entry_a', v_ea), ('entry_b', v_eb);
end
$seed$;

select is(
  (select count(*)::integer
     from public.league_members ma
     join public.leagues l on l.id = ma.league_id
     join public.league_members mb on mb.league_id = ma.league_id
    where ma.user_id = (select id from reveal where label = 'a')
      and mb.user_id = (select id from reveal where label = 'b')),
  0,
  'the two players share NO league — otherwise nothing below tests a gate on shared leagues'
);

-- ---------------------------------------------------------------------------
-- BEFORE LOCK: nothing is revealed, to anyone. Unchanged behaviour.
-- ---------------------------------------------------------------------------

update public.tournaments set lock_at = now() + interval '10 days'
 where id = (select id from reveal where label = 'tournament');

select set_config('request.jwt.claim.sub',
  (select id::text from reveal where label = 'a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  format($$select public.get_rival_entry(%L::uuid, %L::uuid)$$,
    (select id from reveal where label = 'b'),
    (select id from reveal where label = 'tournament')),
  '42501',
  null,
  'before lock a rival entry is still hidden — the lock gate is untouched and remains the mandatory one'
);

select throws_ok(
  format($$select public.get_h2h_rank_history(%L::uuid, %L::uuid)$$,
    (select id from reveal where label = 'b'),
    (select id from reveal where label = 'tournament')),
  '42501',
  null,
  'and head-to-head rank history is still hidden before lock'
);

select throws_ok(
  format($$select public.get_player_profile(%L::uuid, %L::uuid)$$,
    (select id from reveal where label = 'b'),
    (select id from reveal where label = 'tournament')),
  '42501',
  null,
  'THE REGRESSION THIS GUARDS: before lock, a non-co-member still cannot read another profile. Deleting get_player_profile''s league gate outright would have opened this, because it had no lock gate of its own'
);

select lives_ok(
  format($$select public.get_player_profile(%L::uuid, %L::uuid)$$,
    (select id from reveal where label = 'a'),
    (select id from reveal where label = 'tournament')),
  'a player may always read their own profile, before lock as after'
);

-- ---------------------------------------------------------------------------
-- AFTER LOCK: the reveal, without a shared league.
-- ---------------------------------------------------------------------------

update public.tournaments set lock_at = now() - interval '1 day'
 where id = (select id from reveal where label = 'tournament');

select lives_ok(
  format($$select public.get_rival_entry(%L::uuid, %L::uuid)$$,
    (select id from reveal where label = 'b'),
    (select id from reveal where label = 'tournament')),
  'after lock a frozen rival entry is readable by an authenticated player who shares no league — this is the reveal D.2 asked for'
);

select lives_ok(
  format($$select public.get_h2h_rank_history(%L::uuid, %L::uuid)$$,
    (select id from reveal where label = 'b'),
    (select id from reveal where label = 'tournament')),
  'and so is head-to-head rank history'
);

select lives_ok(
  format($$select public.get_player_profile(%L::uuid, %L::uuid)$$,
    (select id from reveal where label = 'b'),
    (select id from reveal where label = 'tournament')),
  'and so is the profile'
);

select is(
  (select (public.get_player_profile(
    (select id from reveal where label = 'b'),
    (select id from reveal where label = 'tournament')) ->> 'locked')::boolean),
  true,
  'the profile reports itself locked, so a caller can tell a frozen reveal from a pre-lock one'
);

-- ---------------------------------------------------------------------------
-- Anonymous access is not opened anywhere.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  format($$select public.get_player_profile(%L::uuid, %L::uuid)$$,
    (select id from reveal where label = 'b'),
    (select id from reveal where label = 'tournament')),
  '42501',
  null,
  'an unauthenticated caller is still refused after lock — the reveal is to authenticated players, not to the public'
);

select throws_ok(
  format($$select public.get_rival_entry(%L::uuid, %L::uuid)$$,
    (select id from reveal where label = 'b'),
    (select id from reveal where label = 'tournament')),
  '42501',
  null,
  'and so is an unauthenticated rival-entry read'
);

-- ---------------------------------------------------------------------------
-- STRUCTURAL: what moved, and what deliberately did not.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_rival_entry', 'get_h2h_rank_history')
      and p.prosrc like '%league_members%'),
  0,
  'neither post-lock reveal function names league_members at all any more'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_league_match_picks'
      and p.prosrc like '%league_members%'),
  1,
  'but get_league_match_picks still does — D.2 is explicit that league-context match-pick reads stay league scoped'
);

select is(
  (select count(*)::integer
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_season_leaderboard'
      and p.prosrc like '%league_members%'),
  0,
  'and contract 95''s season leaderboard never named it — it gates on holding an entries row in the season, which is why ADR 0025 could confirm it was never an instance of this drift'
);

select * from finish();
rollback;
