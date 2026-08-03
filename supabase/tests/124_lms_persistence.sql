-- Contract 72: Last Man Standing setup and entrant state.
--
-- The parity test reads the constraints. This exercises them, against the two
-- cases that would otherwise reach real entrants quietly: a public competition
-- running rules nobody chose, and an entrant holding more lives than their
-- competition granted.

begin;
select plan(12);

select has_table('public', 'season_lms_setups', 'season_lms_setups exists');
select has_table('public', 'season_lms_entrant_state', 'season_lms_entrant_state exists');

select is(
  (select count(*)::integer from pg_class
    where relname in ('season_lms_setups', 'season_lms_entrant_state')
      and relnamespace = 'public'::regnamespace
      and relrowsecurity),
  2,
  'both Last Man Standing tables have row level security enabled'
);

select is(
  (select count(*)::integer
     from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('season_lms_setups', 'season_lms_entrant_state')
      and grantee in ('anon', 'authenticated')),
  0,
  'no browser role holds a direct grant on either table'
);

-- ---------------------------------------------------------------------------
-- A Last Man Standing availability to hang a setup on.
-- ---------------------------------------------------------------------------

create temporary table lms_probe as
select (select id from public.tournaments where kind = 'league_season' order by name limit 1) as season_id;

insert into public.bonus_competitions (tournament_id, game_key, published, availability_status)
select season_id, 'last_man_standing', true, 'active' from lms_probe;

create temporary table lms_competition as
select c.id as competition_id, p.season_id
  from public.bonus_competitions c, lms_probe p
 where c.tournament_id = p.season_id and c.game_key = 'last_man_standing';

-- The three presets are all legal.
select lives_ok(
  $$
    insert into public.season_lms_setups
      (competition_id, lives, saves, draws_rule, endgame_scope, endgame_on_wipeout)
    select competition_id, 1, 1, 'eliminate', 'private', 'play_on' from lms_competition
  $$,
  'a Second Chance private setup is accepted'
);

-- Public is Classic, and only Classic. This is the assertion that stops an
-- unreviewed rule reaching a public competition.
select throws_ok(
  $$
    update public.season_lms_setups
       set lives = 2, saves = 0, draws_rule = 'eliminate',
           endgame_scope = 'public', endgame_on_wipeout = null
  $$,
  '23514',
  null,
  'a public competition cannot grant lives'
);

select lives_ok(
  $$
    update public.season_lms_setups
       set lives = 0, saves = 0, draws_rule = 'eliminate',
           endgame_scope = 'public', endgame_on_wipeout = null
  $$,
  'a public competition on Classic values is accepted'
);

-- A private endgame must say what a wipeout does; a public one must not.
select throws_ok(
  $$
    update public.season_lms_setups
       set endgame_scope = 'private', endgame_on_wipeout = null
  $$,
  '23514',
  null,
  'a private endgame cannot omit its wipeout rule'
);

-- Bounds match validateLmsSetup.
select throws_ok(
  $$
    update public.season_lms_setups
       set endgame_scope = 'private', endgame_on_wipeout = 'play_on', lives = 4
  $$,
  '23514',
  null,
  'four lives is refused: custom is permitted only inside the recorded bounds'
);

-- ---------------------------------------------------------------------------
-- Entrant state cannot exceed the setup.
-- ---------------------------------------------------------------------------

update public.season_lms_setups
   set lives = 1, saves = 1, draws_rule = 'eliminate',
       endgame_scope = 'private', endgame_on_wipeout = 'play_on';

set local session_replication_role = replica;
insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values (md5('lms-state-user')::uuid,'lms-state@example.test','authenticated','authenticated','{}','{}',now(),now());
set local session_replication_role = origin;

insert into public.bonus_competition_entrants (competition_id, user_id)
select competition_id, md5('lms-state-user')::uuid from lms_competition;

select lives_ok(
  $$
    insert into public.season_lms_entrant_state
      (competition_id, user_id, lives_remaining, saves_remaining)
    select competition_id, md5('lms-state-user')::uuid, 1, 1 from lms_competition
  $$,
  'an entrant may hold exactly what the setup granted'
);

select throws_ok(
  $$
    update public.season_lms_entrant_state set lives_remaining = 2
  $$,
  '23514',
  null,
  'an entrant cannot hold more lives than the setup granted'
);

select throws_ok(
  $$
    update public.season_lms_entrant_state set saves_remaining = 2
  $$,
  '23514',
  null,
  'an entrant cannot hold more saves than the setup granted'
);

select * from finish();
rollback;
