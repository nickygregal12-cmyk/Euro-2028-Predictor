-- Contract 101: the Cup split as a distinct persisted stage (ADR 0025).
--
-- Contract 79 widened two Cup format constraints and deliberately stopped short
-- of `bonus_cup_fixtures.stage`, because a split stage would have violated
-- `bonus_cup_fixtures_group_shape` on the spot: that constraint required a
-- non-group stage to carry neither `group_id` nor `matchday`, and a split round
-- needs both. The answer was a decision, not a widening.
--
-- What is asserted here is that the split is expressible, that its own rules
-- hold, that the shapes it borrows from the league phase really are borrowed
-- (no bracket slot, no settlement) and — the part that matters most — that the
-- tournament path is untouched.

begin;
select plan(25);

create temporary table c101 (label text primary key, id uuid not null) on commit drop;

do $seed$
declare
  v_c uuid; v_t uuid; v_comp uuid; v_win uuid;
  v_initial uuid; v_top uuid; v_bottom uuid;
  v_u1 uuid := gen_random_uuid(); v_u2 uuid := gen_random_uuid();
begin
  insert into auth.users (id, email)
    values (v_u1, 'c101a@example.test'), (v_u2, 'c101b@example.test');
  insert into public.competitions (slug, name, sport)
    values ('contract-101-probe', 'Contract 101 probe', 'football') returning id into v_c;
  insert into public.tournaments
      (name, year, competition_id, season_key, kind, display_timezone, status)
    values ('Contract 101 probe', 2026, v_c, 'c101', 'league_season', 'Europe/London', 'active')
    returning id into v_t;
  insert into public.bonus_competitions
      (tournament_id, game_key, published, availability_status)
    values (v_t, 'predictor_cup', true, 'active') returning id into v_comp;
  insert into public.bonus_competition_entrants (competition_id, user_id)
    values (v_comp, v_u1), (v_comp, v_u2);
  insert into public.bonus_competition_windows (competition_id, tournament_id, sequence, label)
    values (v_comp, v_t, 1, 'W1') returning id into v_win;

  -- One league-phase group of twenty, then the two halves it splits into.
  insert into public.bonus_cup_groups (competition_id, tournament_id, ordinal, size)
    values (v_comp, v_t, 1, 20) returning id into v_initial;
  insert into public.bonus_cup_groups
      (competition_id, tournament_id, ordinal, size, phase_kind, parent_group_id)
    values (v_comp, v_t, 1, 10, 'split', v_initial) returning id into v_top;
  insert into public.bonus_cup_groups
      (competition_id, tournament_id, ordinal, size, phase_kind, parent_group_id)
    values (v_comp, v_t, 2, 10, 'split', v_initial) returning id into v_bottom;

  insert into c101 values
    ('competition', v_comp), ('tournament', v_t), ('window', v_win),
    ('initial', v_initial), ('top', v_top), ('bottom', v_bottom),
    ('u1', v_u1), ('u2', v_u2);
end
$seed$;

-- ---------------------------------------------------------------------------
-- Groups: phase and parentage.
-- ---------------------------------------------------------------------------

select is(
  (select phase_kind from public.bonus_cup_groups where id = (select id from c101 where label = 'initial')),
  'initial',
  'an existing group defaults to the initial phase, so every hosted row keeps its meaning without being rewritten'
);

select is(
  (select count(*)::integer from public.bonus_cup_groups
    where competition_id = (select id from c101 where label = 'competition')
      and phase_kind = 'split'
      and parent_group_id = (select id from c101 where label = 'initial')),
  2,
  'both halves point back at the single group they came from'
);

select is(
  (select count(*)::integer from public.bonus_cup_groups
    where competition_id = (select id from c101 where label = 'competition')
      and phase_kind = 'split' and ordinal = 1),
  1,
  'a split half may reuse ordinal 1 — ordinals are per phase, and the league group also holds ordinal 1'
);

select throws_ok(
  $$insert into public.bonus_cup_groups (competition_id, tournament_id, ordinal, size, phase_kind)
    select (select id from c101 where label = 'competition'),
           (select id from c101 where label = 'tournament'), 9, 10, 'split'$$,
  '23514',
  null,
  'a split group with no parent is refused — a half that came from nowhere is not a half'
);

select throws_ok(
  $$insert into public.bonus_cup_groups (competition_id, tournament_id, ordinal, size, parent_group_id)
    select (select id from c101 where label = 'competition'),
           (select id from c101 where label = 'tournament'), 9, 10,
           (select id from c101 where label = 'initial')$$,
  '23514',
  null,
  'and an initial group carrying a parent is refused — the constraint is an equivalence, so neither direction can drift'
);

select throws_ok(
  $$insert into public.bonus_cup_groups
      (competition_id, tournament_id, ordinal, size, phase_kind, parent_group_id)
    select (select id from c101 where label = 'competition'),
           (select id from c101 where label = 'tournament'), 9, 5, 'split',
           (select id from c101 where label = 'top')$$,
  '23503',
  null,
  'a CHAIN is unrepresentable: a split half cannot parent another, because the generated parent phase can only be initial'
);

select throws_ok(
  $$update public.bonus_cup_groups
       set parent_group_id = id
     where id = (select id from c101 where label = 'top')$$,
  '23514',
  null,
  'and a group cannot become its own parent'
);

select is(
  (select count(*)::integer from pg_catalog.pg_constraint
    where conrelid = 'public.bonus_cup_groups'::regclass
      and conname = 'bonus_cup_groups_competition_phase_ordinal_key'),
  1,
  'ordinal uniqueness is phase-aware; the competition-wide key it replaced would have forced the halves to continue the league numbering'
);

-- ---------------------------------------------------------------------------
-- Fixtures: the split borrows the league shape, and only where it should.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$insert into public.bonus_cup_fixtures
      (competition_id, tournament_id, stage, group_id, window_id, matchday, home_user_id, away_user_id)
    select (select id from c101 where label = 'competition'),
           (select id from c101 where label = 'tournament'), 'split',
           (select id from c101 where label = 'top'),
           (select id from c101 where label = 'window'), 8,
           (select id from c101 where label = 'u1'), (select id from c101 where label = 'u2')$$,
  'a split fixture carries a group and a matchday — the exact combination the old shape constraint forbade'
);

select is(
  (select matchday from public.bonus_cup_fixtures
    where competition_id = (select id from c101 where label = 'competition') and stage = 'split'),
  8::smallint,
  'and its matchday CONTINUES the competition''s round numbering rather than resetting to 1 at the split'
);

select throws_ok(
  $$insert into public.bonus_cup_fixtures
      (competition_id, tournament_id, stage, window_id, home_user_id, away_user_id)
    select (select id from c101 where label = 'competition'),
           (select id from c101 where label = 'tournament'), 'split',
           (select id from c101 where label = 'window'),
           (select id from c101 where label = 'u1'), (select id from c101 where label = 'u2')$$,
  '23514',
  null,
  'a split fixture without a group and matchday is refused'
);

select throws_ok(
  $$insert into public.bonus_cup_fixtures
      (competition_id, tournament_id, stage, group_id, window_id, matchday, bracket_slot,
       home_user_id, away_user_id)
    select (select id from c101 where label = 'competition'),
           (select id from c101 where label = 'tournament'), 'split',
           (select id from c101 where label = 'top'),
           (select id from c101 where label = 'window'), 9, 1,
           (select id from c101 where label = 'u1'), (select id from c101 where label = 'u2')$$,
  '23514',
  null,
  'a split fixture may not carry a bracket slot — the split is round-robin within a half, not a bracket'
);

select throws_ok(
  $$insert into public.bonus_cup_fixtures
      (competition_id, tournament_id, stage, group_id, window_id, matchday,
       home_user_id, away_user_id, winner_user_id, decided_by, settled_at)
    select (select id from c101 where label = 'competition'),
           (select id from c101 where label = 'tournament'), 'split',
           (select id from c101 where label = 'top'),
           (select id from c101 where label = 'window'), 9,
           (select id from c101 where label = 'u1'), (select id from c101 where label = 'u2'),
           (select id from c101 where label = 'u1'), 'points', now()$$,
  '23514',
  null,
  'NOBODY IS ELIMINATED AT THE SPLIT: a split fixture may not settle a winner, exactly as a league fixture may not'
);

select throws_ok(
  $$insert into public.bonus_cup_fixtures
      (competition_id, tournament_id, stage, group_id, window_id, matchday, bracket_slot, round_size,
       home_user_id, away_user_id)
    select (select id from c101 where label = 'competition'),
           (select id from c101 where label = 'tournament'), 'knockout',
           (select id from c101 where label = 'top'),
           (select id from c101 where label = 'window'), 9, 1, 8,
           (select id from c101 where label = 'u1'), (select id from c101 where label = 'u2')$$,
  '23514',
  null,
  'and the bracket branch is unchanged: a knockout fixture still may not carry a group or matchday'
);

select throws_ok(
  $$insert into public.bonus_cup_fixtures
      (competition_id, tournament_id, stage, group_id, window_id, matchday, home_user_id, away_user_id)
    select (select id from c101 where label = 'competition'),
           (select id from c101 where label = 'tournament'), 'final_series',
           (select id from c101 where label = 'top'),
           (select id from c101 where label = 'window'), 9,
           (select id from c101 where label = 'u1'), (select id from c101 where label = 'u2')$$,
  '23514',
  null,
  'an unknown stage is still refused — widening the domain added one value, not an open door'
);

-- ---------------------------------------------------------------------------
-- Split membership, in its own relation.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$insert into public.bonus_cup_split_members
      (competition_id, user_id, group_id, tournament_id, seeded_position)
    select (select id from c101 where label = 'competition'),
           (select id from c101 where label = 'u1'),
           (select id from c101 where label = 'top'),
           (select id from c101 where label = 'tournament'), 3$$,
  'an entrant is placed into a half'
);

select throws_ok(
  $$insert into public.bonus_cup_split_members
      (competition_id, user_id, group_id, tournament_id)
    select (select id from c101 where label = 'competition'),
           (select id from c101 where label = 'u2'),
           (select id from c101 where label = 'initial'),
           (select id from c101 where label = 'tournament')$$,
  '23503',
  null,
  'but not into an INITIAL group — split membership belongs to a split-phase half, enforced by key rather than by trigger'
);

-- The reason this is a separate relation rather than a widened key on
-- `bonus_cup_members`: that table's primary key is (competition_id, user_id),
-- and sixteen readers select on it expecting exactly one row. Widening it would
-- have left them all correct until the first split row existed, then turned
-- them into arbitrary-row reads with no failing test to announce it.
select is(
  (select count(*)::integer from pg_catalog.pg_constraint
    where conrelid = 'public.bonus_cup_members'::regclass and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (competition_id, user_id)'),
  1,
  'bonus_cup_members keeps its (competition_id, user_id) key untouched, so no existing single-row read becomes ambiguous'
);

select is(
  (select count(*)::integer from public.bonus_cup_members
    where competition_id = (select id from c101 where label = 'competition')),
  0,
  'and this contract writes nothing to it — the original memberships are preserved by construction, not by discipline'
);

-- ---------------------------------------------------------------------------
-- Exposure. These decide a competition; no browser role may read them.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
     from unnest(array['anon', 'authenticated', 'service_role']) as role_name
    where pg_catalog.has_table_privilege(role_name, 'public.bonus_cup_split_members', 'SELECT')
       or pg_catalog.has_table_privilege(role_name, 'public.bonus_cup_split_members', 'INSERT')),
  0,
  'no browser or service role can read or write split membership'
);

select is(
  (select relrowsecurity from pg_catalog.pg_class
    where oid = 'public.bonus_cup_split_members'::regclass),
  true,
  'and row level security is enabled on it, matching bonus_cup_members'
);

-- ---------------------------------------------------------------------------
-- THE TOURNAMENT PATH IS UNTOUCHED.
--
-- The strongest claim in this contract, so it is exercised rather than
-- inspected: a real draw runs and is compared against what it has always
-- written. Fourteen entrants give two groups of four and two of three across
-- three matchdays, which is the tournament's format and the domain
-- `cupStoreDomains.test.ts` pins.
-- ---------------------------------------------------------------------------

create temporary table c101draw (label text primary key, id uuid not null) on commit drop;

do $draw$
declare
  v_c uuid; v_t uuid; v_comp uuid; v_u uuid; k integer;
begin
  insert into public.competitions (slug, name, sport)
    values ('contract-101-draw', 'Contract 101 draw', 'football') returning id into v_c;
  insert into public.tournaments
      (name, year, competition_id, season_key, kind, display_timezone, status)
    values ('Contract 101 draw', 2028, v_c, 'c101draw', 'tournament', 'Europe/London', 'active')
    returning id into v_t;
  insert into public.bonus_competitions
      (tournament_id, game_key, published, availability_status, registration_closes_at, draw_required)
    values (v_t, 'predictor_cup', true, 'active', now() - interval '1 day', true)
    returning id into v_comp;
  for k in 1..3 loop
    insert into public.bonus_competition_windows (competition_id, tournament_id, sequence, label)
      values (v_comp, v_t, k, 'MD' || k);
  end loop;
  for k in 1..14 loop
    v_u := ('00000000-0000-4000-8000-' || lpad(k::text, 12, '0'))::uuid;
    insert into auth.users (id, email) values (v_u, 'c101draw' || k || '@example.test');
    insert into public.bonus_competition_entrants (competition_id, user_id) values (v_comp, v_u);
  end loop;
  insert into c101draw values ('competition', v_comp);
end
$draw$;

select is(
  public.admin_draw_predictor_cup((select id from c101draw where label = 'competition'),
                                  'a-published-seed-value')
    - 'competition_id',
  '{"groups": 4, "entrants": 14, "fixtures": 18, "four_player_groups": 2, "three_player_groups": 2}'::jsonb,
  'the tournament draw still produces two groups of four and two of three from fourteen entrants, with eighteen fixtures'
);

select is(
  (select array_agg(distinct phase_kind order by phase_kind)
     from public.bonus_cup_groups
    where competition_id = (select id from c101draw where label = 'competition')),
  array['initial'],
  'every group it wrote is initial-phase — the draw did not learn about splits by accident'
);

select is(
  (select array_agg(distinct stage order by stage)
     from public.bonus_cup_fixtures
    where competition_id = (select id from c101draw where label = 'competition')),
  array['group'],
  'and every fixture it wrote is a group fixture, with no split among them'
);

select is(
  (select count(*)::integer from public.bonus_cup_split_members
    where competition_id = (select id from c101draw where label = 'competition')),
  0,
  'the draw writes no split membership, so the new relation stays empty until something deliberately splits'
);

select * from finish();
rollback;
