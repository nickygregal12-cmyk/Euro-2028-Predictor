-- Contract 102: a competition can happen more than once (ADR 0025 decision 1).
--
-- The prerequisite the decision names as the larger half of the work.
-- `unique (tournament_id, game_key)` is an AVAILABILITY key doing an INSTANCE
-- row's job: because a season offers Last Man Standing once, the season could
-- only ever run it once, and `restart_all_reentered` was unrepresentable rather
-- than merely unimplemented.
--
-- What is asserted here is the replacement invariant — at most one LIVE
-- instance per (tournament, game) — the lineage that makes a chain of instances
-- readable, and the equivalence that makes this safe to land before its
-- callers move.

begin;
select plan(18);

create temporary table lineage (label text primary key, id uuid not null) on commit drop;

do $seed$
declare
  v_t uuid; v_comp uuid;
begin
  select id into v_t from public.tournaments where kind = 'league_season' order by name limit 1;
  select id into v_comp from public.bonus_competitions
   where tournament_id = v_t and game_key = 'last_man_standing';
  insert into lineage values ('season', v_t), ('first', v_comp);
end
$seed$;

-- ---------------------------------------------------------------------------
-- The backfill. Every existing row is instance one of its own series.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.bonus_competitions
    where series_id is distinct from id or series_sequence <> 1
       or predecessor_competition_id is not null),
  0,
  'every pre-existing competition is instance 1 of a series that is itself — no row needed a new identifier and none gained a predecessor'
);

select is(
  (select count(*)::integer from public.bonus_competitions where completed_at is not null),
  0,
  'and none is completed, which is what makes the partial index below equivalent to the constraint it replaces'
);

-- ---------------------------------------------------------------------------
-- THE INVARIANT. At most one live instance per (tournament, game).
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.bonus_competitions
      (tournament_id, game_key, availability_status, series_id)
    select (select id from lineage where label = 'season'),
           'last_man_standing', 'active', gen_random_uuid()$$,
  '23505',
  null,
  'a second LIVE instance of one game in one season is still impossible — this is the assumption twenty single-row readers rely on, and it is not weakened'
);

select lives_ok(
  $$update public.bonus_competitions
       set completed_at = now(), completion_reason = 'no_winner_restarted'
     where id = (select id from lineage where label = 'first')$$,
  'the first instance completes, with a reason recording WHY rather than only that it finished'
);

select lives_ok(
  $$insert into public.bonus_competitions
      (tournament_id, game_key, availability_status, series_id, series_sequence,
       predecessor_competition_id)
    select (select id from lineage where label = 'season'),
           'last_man_standing', 'active',
           (select series_id from public.bonus_competitions
             where id = (select id from lineage where label = 'first')),
           2,
           (select id from lineage where label = 'first')$$,
  'and NOW a successor is accepted alongside its completed predecessor — the restart becomes representable, which is the whole contract'
);

select is(
  (select count(*)::integer from public.bonus_competitions
    where tournament_id = (select id from lineage where label = 'season')
      and game_key = 'last_man_standing'),
  2,
  'both instances coexist — the completed predecessor is preserved, not overwritten'
);

select throws_ok(
  $$insert into public.bonus_competitions
      (tournament_id, game_key, availability_status, series_id, series_sequence,
       predecessor_competition_id)
    select (select id from lineage where label = 'season'),
           'last_man_standing', 'active',
           (select series_id from public.bonus_competitions
             where id = (select id from lineage where label = 'first')),
           3,
           (select id from public.bonus_competitions
             where tournament_id = (select id from lineage where label = 'season')
               and game_key = 'last_man_standing' and completed_at is null)$$,
  '23505',
  null,
  'a THIRD live instance is refused while the second is still running — completing is what frees the slot, not merely existing'
);

-- ---------------------------------------------------------------------------
-- Lineage rules.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.bonus_competitions
      (tournament_id, game_key, availability_status, series_id, series_sequence)
    select (select id from lineage where label = 'season'),
           'predictor_cup_probe', 'active', gen_random_uuid(), 2$$,
  '23514',
  null,
  'a later instance with no predecessor is refused — a restart that came from nothing is not a restart'
);

select throws_ok(
  $$insert into public.bonus_competitions
      (tournament_id, game_key, availability_status, series_id, series_sequence,
       predecessor_competition_id)
    select (select id from lineage where label = 'season'),
           'predictor_cup_probe', 'active', gen_random_uuid(), 1,
           (select id from lineage where label = 'first')$$,
  '23514',
  null,
  'and a FIRST instance carrying a predecessor is refused — the constraint is an equivalence, so neither direction drifts'
);

select throws_ok(
  $$update public.bonus_competitions
       set predecessor_competition_id = id, series_sequence = 2
     where id = (select id from lineage where label = 'first')$$,
  '23514',
  null,
  'a competition cannot be its own predecessor'
);

select throws_ok(
  $$update public.bonus_competitions set series_id = gen_random_uuid()
     where tournament_id = (select id from lineage where label = 'season')
       and game_key = 'last_man_standing' and completed_at is null$$,
  '23503',
  null,
  'a successor cannot be moved into a DIFFERENT series while keeping its predecessor — the composite key pins a chain to one series rather than letting it wander'
);

-- Inserted already COMPLETED, deliberately: a live duplicate would be refused
-- by the live-instance index first and this assertion would pass for the wrong
-- reason, proving nothing about sequence uniqueness.
select throws_ok(
  $$insert into public.bonus_competitions
      (tournament_id, game_key, availability_status, series_id, series_sequence,
       predecessor_competition_id, completed_at, completion_reason)
    select (select id from lineage where label = 'season'),
           'last_man_standing', 'closed',
           (select series_id from public.bonus_competitions
             where id = (select id from lineage where label = 'first')),
           2,
           (select id from lineage where label = 'first'),
           now(), 'abandoned'$$,
  '23505',
  null,
  'and sequence 2 cannot be claimed twice within one series, even by a completed instance the live-instance index would not have caught'
);

-- ---------------------------------------------------------------------------
-- The completion reason.
-- ---------------------------------------------------------------------------

select is(
  (select completion_reason from public.bonus_competitions
    where id = (select id from lineage where label = 'first')),
  'no_winner_restarted',
  'the terminal state ADR 0025 names is storable, so a restarted competition is afterwards distinguishable from a won one'
);

select throws_ok(
  $$update public.bonus_competitions set completion_reason = 'won'
     where tournament_id = (select id from lineage where label = 'season')
       and game_key = 'last_man_standing' and completed_at is null$$,
  '23514',
  null,
  'a completion reason on a competition that has not completed is refused'
);

select throws_ok(
  $$update public.bonus_competitions set completion_reason = 'gave_up'
     where id = (select id from lineage where label = 'first')$$,
  '23514',
  null,
  'and an unknown reason is refused — the domain is three values, not free text'
);

-- ---------------------------------------------------------------------------
-- The resolver. One definition of "the live instance", before twenty callers
-- each invent their own filter in contract 103.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.live_competition_id(
    (select id from lineage where label = 'season'), 'last_man_standing'),
  (select id from public.bonus_competitions
    where tournament_id = (select id from lineage where label = 'season')
      and game_key = 'last_man_standing' and completed_at is null),
  'the resolver returns the live successor, not the completed predecessor'
);

select is(
  predictor_internal.live_competition_id(
    (select id from lineage where label = 'season'), 'last_man_standing')
    = (select id from lineage where label = 'first'),
  false,
  'and specifically NOT the row that a pre-contract-102 lookup would have found by (tournament_id, game_key) alone'
);

select is(
  (select count(*)::integer
     from unnest(array['anon', 'authenticated', 'service_role']) as role_name
    where pg_catalog.has_function_privilege(
      role_name, 'predictor_internal.live_competition_id(uuid, text)', 'EXECUTE')),
  0,
  'and no browser or service role may call it'
);

select * from finish();
rollback;
