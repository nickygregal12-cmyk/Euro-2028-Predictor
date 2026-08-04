-- Contract 103: a competition can happen more than once (ADR 0025 decision 1).
--
-- The prerequisite the decision names as the larger half of the work.
-- `unique (tournament_id, game_key)` is an AVAILABILITY key doing an INSTANCE
-- row's job: because a season offers Last Man Standing once, the season could
-- only ever run it once, and `restart_all_reentered` was unrepresentable rather
-- than merely unimplemented.
--
-- What is asserted here is the replacement invariant — one live public
-- instance per season game, one live row per series, independent private-series
-- coexistence — plus lineage that cannot cross season, game or visibility scope.

begin;
select plan(31);

create temporary table lineage (label text primary key, id uuid not null) on commit drop;

do $seed$
declare
  v_t uuid; v_comp uuid; v_other uuid; v_euro uuid;
begin
  select id into v_t from public.tournaments where kind = 'league_season' order by name limit 1;
  select id into v_other from public.tournaments
   where kind = 'league_season' and id <> v_t order by name limit 1;
  select id into v_comp from public.bonus_competitions
   where tournament_id = v_t and game_key = 'last_man_standing'
     and visibility_kind = 'public' and completed_at is null;
  select id into v_euro from public.tournaments where kind = 'tournament' order by name limit 1;
  insert into lineage values
    ('season', v_t), ('other_season', v_other), ('first', v_comp), ('tournament', v_euro);
  insert into public.game_definitions (
    game_key, display_name, requires_prediction_entry, lock_scope, buffer_minutes, allow_rejoin
  ) values ('lineage_probe', 'Lineage probe', false, 'round', 0, false);
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

select is(
  (select count(*)::integer from public.bonus_competitions where visibility_kind <> 'public'),
  0,
  'all pre-existing availability rows backfill as public rather than becoming private by accident'
);

-- ---------------------------------------------------------------------------
-- THE INVARIANT. One live public instance per game, one live row per series.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.bonus_competitions
      (tournament_id, game_key, availability_status, series_id)
    select (select id from lineage where label = 'season'),
           'last_man_standing', 'active', gen_random_uuid()$$,
  '23505',
  null,
  'a second live PUBLIC instance of one game in one season is impossible'
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
      and game_key = 'last_man_standing'
      and visibility_kind = 'public'),
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
               and game_key = 'last_man_standing'
               and visibility_kind = 'public' and completed_at is null)$$,
  '23505',
  null,
  'a THIRD live instance is refused while the second is still running — completing is what frees the slot, not merely existing'
);

-- Private competitions are separate series. Two may run beside the public one.
select lives_ok(
  $$insert into public.bonus_competitions
      (id, tournament_id, game_key, published, availability_status,
       visibility_kind, series_id)
    values
      (md5('c103-private-a')::uuid,
       (select id from lineage where label = 'season'),
       'last_man_standing', false, 'active', 'private', md5('c103-private-a')::uuid),
      (md5('c103-private-b')::uuid,
       (select id from lineage where label = 'season'),
       'last_man_standing', false, 'active', 'private', md5('c103-private-b')::uuid)$$,
  'two independent private LMS series may coexist with the one live public instance'
);

select lives_ok(
  $$update public.bonus_competitions
       set completed_at = now(), completion_reason = 'no_winner_restarted'
     where id = md5('c103-private-a')::uuid$$,
  'a private series predecessor may complete without affecting the public slot'
);

select lives_ok(
  $$insert into public.bonus_competitions
      (id, tournament_id, game_key, published, availability_status,
       visibility_kind, series_id, series_sequence, predecessor_competition_id)
    values (
      md5('c103-private-a-2')::uuid,
      (select id from lineage where label = 'season'),
      'last_man_standing', false, 'active', 'private',
      md5('c103-private-a')::uuid, 2, md5('c103-private-a')::uuid
    )$$,
  'a private successor reuses its own series while another private series remains live'
);

select is(
  (select count(*)::integer from public.bonus_competitions
    where tournament_id = (select id from lineage where label = 'season')
      and game_key = 'last_man_standing'
      and visibility_kind = 'private'
      and completed_at is null),
  2,
  'private competitions coexist freely across independent live series'
);

select throws_ok(
  $$insert into public.bonus_competitions
      (tournament_id, game_key, published, availability_status,
       visibility_kind, series_id, series_sequence, predecessor_competition_id)
    values (
      (select id from lineage where label = 'season'),
      'last_man_standing', false, 'active', 'private',
      md5('c103-private-a')::uuid, 3, md5('c103-private-a-2')::uuid
    )$$,
  '23505',
  null,
  'one private series cannot have two live instances even though other private series may coexist'
);

-- ---------------------------------------------------------------------------
-- Lineage rules.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.bonus_competitions
      (tournament_id, game_key, availability_status, series_id, series_sequence)
    select (select id from lineage where label = 'season'),
           'lineage_probe', 'active', gen_random_uuid(), 2$$,
  '23514',
  null,
  'a later instance with no predecessor is refused — a restart that came from nothing is not a restart'
);

select throws_ok(
  $$insert into public.bonus_competitions
      (tournament_id, game_key, availability_status, series_id, series_sequence,
       predecessor_competition_id)
    select (select id from lineage where label = 'season'),
           'lineage_probe', 'active', gen_random_uuid(), 1,
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
       and game_key = 'last_man_standing'
       and visibility_kind = 'public' and completed_at is null$$,
  '23503',
  null,
  'a successor cannot be moved into a DIFFERENT series while keeping its predecessor — the composite key pins a chain to one series rather than letting it wander'
);

select throws_ok(
  $$update public.bonus_competitions
       set tournament_id = (select id from lineage where label = 'other_season')
     where id = md5('c103-private-a-2')::uuid$$,
  '23503',
  null,
  'a successor cannot move to another season while retaining its predecessor'
);

select throws_ok(
  $$update public.bonus_competitions
       set game_key = 'lineage_probe'
     where id = md5('c103-private-a-2')::uuid$$,
  '23503',
  null,
  'a successor cannot change game while retaining its predecessor'
);

select throws_ok(
  $$update public.bonus_competitions
       set visibility_kind = 'public'
     where id = md5('c103-private-a')::uuid$$,
  '23503',
  null,
  'a completed predecessor cannot change public/private scope under its successor'
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
-- The lineage default trigger: an insert that says nothing about lineage
-- becomes instance 1 of its own NEW series.
--
-- This is also a semantic worth pinning, not just a default: a bare re-create
-- after completion does NOT continue the old series. Continuing one is an
-- explicit act — the restart driver passes series_id, sequence and
-- predecessor — so nothing can extend a chain by accident.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$update public.bonus_competitions
       set completed_at = now(), completion_reason = 'abandoned'
     where tournament_id = (select id from lineage where label = 'season')
       and game_key = 'predictor_cup' and completed_at is null;
    insert into public.bonus_competitions (tournament_id, game_key, availability_status)
    select (select id from lineage where label = 'season'), 'predictor_cup', 'active'$$,
  'a bare insert naming no lineage at all is accepted once the slot is free — every existing inserter stays correct without learning about series'
);

select is(
  (select (series_id = id) and series_sequence = 1 and predecessor_competition_id is null
     from public.bonus_competitions
    where tournament_id = (select id from lineage where label = 'season')
      and game_key = 'predictor_cup' and completed_at is null),
  true,
  'and the trigger self-seeded it as instance 1 of its own NEW series — a bare re-create never silently continues the old chain'
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
       and game_key = 'last_man_standing'
       and visibility_kind = 'public' and completed_at is null$$,
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
-- The resolver. One definition of "the live instance", before the measured callers
-- move onto it in contract 104.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$update public.tournaments
       set lock_at = lock_at
     where id = (select id from lineage where label = 'tournament')$$,
  'the Original Predictor availability trigger still upserts after the total key becomes partial'
);

select matches(
  pg_get_functiondef(
    'predictor_internal.ensure_original_predictor_availability()'::regprocedure
  ),
  'ON CONFLICT \(tournament_id, game_key\)[[:space:]]+WHERE \(\(visibility_kind = ''public''::text\) AND \(completed_at IS NULL\)\)',
  'the live writer names the partial public-instance conflict target explicitly'
);

select is(
  predictor_internal.live_competition_id(
    (select id from lineage where label = 'season'), 'last_man_standing'),
  (select id from public.bonus_competitions
    where tournament_id = (select id from lineage where label = 'season')
      and game_key = 'last_man_standing'
      and visibility_kind = 'public' and completed_at is null),
  'the resolver returns the live PUBLIC successor, ignoring two live private competitions'
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
