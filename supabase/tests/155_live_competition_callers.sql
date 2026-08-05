-- Contract 104: operational callers use the live public row; read callers
-- retain the latest terminal result only when no live successor exists.

begin;
select plan(42);

select ok(to_regprocedure('predictor_internal.current_public_competition_id(uuid,text)') is not null,
  'the terminal-aware current-public resolver exists');
select is(regexp_count(pg_get_functiondef('predictor_internal.current_public_competition_id(uuid,text)'::regprocedure),
  'predictor_internal\.live_competition_id\('), 1,
  'the current-public resolver prefers the live authority exactly once');
select matches(pg_get_functiondef('predictor_internal.current_public_competition_id(uuid,text)'::regprocedure),
  'visibility_kind = ''public''',
  'the terminal fallback cannot cross into a private series');
select matches(pg_get_functiondef('predictor_internal.current_public_competition_id(uuid,text)'::regprocedure),
  'completed_at is not null',
  'the fallback is terminal-only rather than a second live-row definition');

select matches(
  pg_get_functiondef('predictor_internal.enforce_season_matchweek_lock()'::regprocedure),
  'predictor_internal\.live_competition_id\(',
  'matchweek lock resolves the live public instance'
);
select is(
  regexp_count(pg_get_functiondef('predictor_internal.enforce_season_matchweek_lock()'::regprocedure),
    'predictor_internal\.live_competition_id\('),
  1,
  'matchweek lock contains one live-instance resolution'
);

select matches(
  pg_get_functiondef('predictor_internal.prepare_competition_season_scope()'::regprocedure),
  'predictor_internal\.live_competition_id\(',
  'season-scope trigger resolves the live public instance'
);
select is(
  regexp_count(pg_get_functiondef('predictor_internal.prepare_competition_season_scope()'::regprocedure),
    'predictor_internal\.live_competition_id\('),
  1,
  'season-scope trigger contains one live-instance resolution'
);

select matches(
  pg_get_functiondef('predictor_internal.recompute_ko_predictor_for_match(uuid)'::regprocedure),
  'predictor_internal\.live_competition_id\(',
  'KO rederive resolves the live public instance'
);
select is(
  regexp_count(pg_get_functiondef('predictor_internal.recompute_ko_predictor_for_match(uuid)'::regprocedure),
    'predictor_internal\.live_competition_id\('),
  1,
  'KO rederive contains one live-instance resolution'
);

select matches(
  pg_get_functiondef('predictor_internal.recompute_lms_for_tournament(uuid)'::regprocedure),
  'predictor_internal\.live_competition_id\(',
  'LMS rederive resolves the live public instance'
);
select is(
  regexp_count(pg_get_functiondef('predictor_internal.recompute_lms_for_tournament(uuid)'::regprocedure),
    'predictor_internal\.live_competition_id\('),
  1,
  'LMS rederive contains one live-instance resolution'
);

select matches(
  pg_get_functiondef('public.create_league(uuid,text)'::regprocedure),
  'predictor_internal\.live_competition_id\(',
  'league compatibility RPC resolves the live public instance'
);
select is(
  regexp_count(pg_get_functiondef('public.create_league(uuid,text)'::regprocedure),
    'predictor_internal\.live_competition_id\('),
  1,
  'league compatibility RPC contains one live-instance resolution'
);

select matches(
  pg_get_functiondef('public.get_bonus_games(uuid)'::regprocedure),
  'predictor_internal\.current_public_competition_id\(',
  'Bonus Games hub resolves the current public instance'
);
select is(
  regexp_count(pg_get_functiondef('public.get_bonus_games(uuid)'::regprocedure),
    'predictor_internal\.current_public_competition_id\('),
  1,
  'Bonus Games hub contains one current-instance resolution'
);

select matches(
  pg_get_functiondef('public.get_competition_games(uuid)'::regprocedure),
  'predictor_internal\.current_public_competition_id\(',
  'competition game catalogue resolves the current public instance'
);
select is(
  regexp_count(pg_get_functiondef('public.get_competition_games(uuid)'::regprocedure),
    'predictor_internal\.current_public_competition_id\('),
  1,
  'competition game catalogue contains one current-instance resolution'
);

select matches(
  pg_get_functiondef('public.get_ko_predictor_standings(uuid,integer,text)'::regprocedure),
  'predictor_internal\.current_public_competition_id\(',
  'KO standings resolves the current public instance'
);
select is(
  regexp_count(pg_get_functiondef('public.get_ko_predictor_standings(uuid,integer,text)'::regprocedure),
    'predictor_internal\.current_public_competition_id\('),
  1,
  'KO standings contains one current-instance resolution'
);

select matches(
  pg_get_functiondef('public.get_my_cup(uuid)'::regprocedure),
  'predictor_internal\.current_public_competition_id\(',
  'Cup read resolves the current public instance'
);
select is(
  regexp_count(pg_get_functiondef('public.get_my_cup(uuid)'::regprocedure),
    'predictor_internal\.current_public_competition_id\('),
  1,
  'Cup read contains one current-instance resolution'
);

select matches(
  pg_get_functiondef('public.get_my_lms(uuid)'::regprocedure),
  'predictor_internal\.current_public_competition_id\(',
  'LMS read resolves the current public instance'
);
select is(
  regexp_count(pg_get_functiondef('public.get_my_lms(uuid)'::regprocedure),
    'predictor_internal\.current_public_competition_id\('),
  1,
  'LMS read contains one current-instance resolution'
);

select ok(
  regexp_count(pg_get_functiondef('predictor_internal.prepare_competition_season_scope()'::regprocedure),
    'where id = new\.competition_id') >= 8,
  'the season-scope trigger keeps direct-ID branches direct'
);
select is(
  regexp_count(pg_get_functiondef('predictor_internal.recompute_ko_predictor_for_match(uuid)'::regprocedure),
    'from public\.bonus_competitions'), 0,
  'the KO rederive has no independent tournament+game query'
);
select is(
  regexp_count(pg_get_functiondef('predictor_internal.recompute_lms_for_tournament(uuid)'::regprocedure),
    'from public\.bonus_competitions'), 0,
  'the LMS rederive has no independent tournament+game query'
);
select matches(
  pg_get_functiondef('public.create_league(uuid,text)'::regprocedure),
  'live_competition_id\([[:space:]]*p_tournament_id,[[:space:]]*availability\.game_key[[:space:]]*\)',
  'league compatibility chooses a live public prediction-entry game'
);
select matches(
  pg_get_functiondef('public.get_bonus_games(uuid)'::regprocedure),
  'current_public_competition_id\([[:space:]]*p_tournament_id,[[:space:]]*candidate\.game_key[[:space:]]*\)',
  'the Bonus Games hub applies current-instance resolution per game key'
);
select matches(
  pg_get_functiondef('public.get_competition_games(uuid)'::regprocedure),
  'current_public_competition_id\([[:space:]]*p_tournament_id,[[:space:]]*availability\.game_key[[:space:]]*\)',
  'the competition catalogue applies current-instance resolution per game key'
);
select ok(
  regexp_count(pg_get_functiondef('public.get_my_cup(uuid)'::regprocedure),
    'member\.phase_kind = ''initial''') >= 2,
  'the Cup read preserves Contract 102 initial-phase membership semantics'
);
select matches(
  pg_get_functiondef('public.get_my_cup(uuid)'::regprocedure),
  'competition\.published',
  'the Cup read keeps its publication boundary'
);
select is(
  (select count(*)::integer from information_schema.role_routine_grants
   where routine_schema = 'predictor_internal'
     and routine_name = 'current_public_competition_id'
     and grantee in ('PUBLIC','anon','authenticated','service_role')),
  0,
  'the current-public resolver is internal-only'
);

create temporary table c104_probe (label text primary key, id uuid not null) on commit drop;

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  md5('c104-user')::uuid, 'c104@example.test',
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
);
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
values (md5('c104-user')::uuid, 'Contract 104 Player', now());

do $seed$
declare
  v_old public.bonus_competitions%rowtype;
  v_new uuid;
  v_user uuid;
begin
  select * into v_old
  from public.bonus_competitions competition
  where competition.visibility_kind = 'public'
    and competition.completed_at is null
    and competition.game_key = 'last_man_standing'
  order by competition.id
  limit 1;
  if v_old.id is null then raise exception 'Contract 104 needs the canonical live public LMS competition'; end if;
  v_user := md5('c104-user')::uuid;
  update public.bonus_competitions
  set published = true,
      availability_status = 'active',
      completed_at = now(),
      completion_reason = 'abandoned'
  where id = v_old.id;
  v_old.published := true;
  v_old.availability_status := 'active';
  insert into public.bonus_competitions (
    tournament_id, game_key, published, availability_status,
    registration_opens_at, registration_closes_at, draw_required,
    draw_completed_at, visibility_kind, series_id, series_sequence,
    predecessor_competition_id
  ) values (
    v_old.tournament_id, v_old.game_key, v_old.published, v_old.availability_status,
    v_old.registration_opens_at, v_old.registration_closes_at, v_old.draw_required,
    null, 'public', v_old.series_id, v_old.series_sequence + 1, v_old.id
  ) returning id into v_new;
  insert into c104_probe values ('tournament', v_old.tournament_id),
    ('old', v_old.id), ('new', v_new), ('user', v_user);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end
$seed$;

select is(
  predictor_internal.live_competition_id(
    (select id from c104_probe where label='tournament'),
    (select game_key from public.bonus_competitions where id=(select id from c104_probe where label='new'))
  ), (select id from c104_probe where label='new'),
  'the live resolver returns the successor'
);
select is(
  predictor_internal.current_public_competition_id(
    (select id from c104_probe where label='tournament'),
    (select game_key from public.bonus_competitions where id=(select id from c104_probe where label='new'))
  ), (select id from c104_probe where label='new'),
  'the current resolver prefers the live successor'
);
select is((select count(*)::integer from jsonb_array_elements(public.get_bonus_games(
  (select id from c104_probe where label='tournament'))->'competitions') item
  where (item->>'id')::uuid=(select id from c104_probe where label='new')), 1,
  'the Bonus Games hub returns the successor'
);
select is((select count(*)::integer from jsonb_array_elements(public.get_bonus_games(
  (select id from c104_probe where label='tournament'))->'competitions') item
  where (item->>'id')::uuid=(select id from c104_probe where label='old')), 0,
  'the Bonus Games hub excludes the predecessor while a successor is live'
);
select is((select count(*)::integer from jsonb_array_elements(public.get_competition_games(
  (select id from c104_probe where label='tournament'))->'games') item
  where (item->>'id')::uuid=(select id from c104_probe where label='new')), 1,
  'the competition catalogue returns the successor'
);
select is((select count(*)::integer from jsonb_array_elements(public.get_competition_games(
  (select id from c104_probe where label='tournament'))->'games') item
  where (item->>'id')::uuid=(select id from c104_probe where label='old')), 0,
  'the competition catalogue excludes the predecessor while a successor is live'
);
update public.bonus_competitions
set completed_at = now() + interval '1 second', completion_reason = 'abandoned'
where id = (select id from c104_probe where label='new');
select is(
  predictor_internal.current_public_competition_id(
    (select id from c104_probe where label='tournament'),
    (select game_key from public.bonus_competitions where id=(select id from c104_probe where label='new'))
  ), (select id from c104_probe where label='new'),
  'without a live row, the current resolver retains the latest terminal result'
);
select is((select count(*)::integer from jsonb_array_elements(public.get_bonus_games(
  (select id from c104_probe where label='tournament'))->'competitions') item
  where (item->>'id')::uuid=(select id from c104_probe where label='new')), 1,
  'the Bonus Games hub retains the latest terminal result'
);
select is((select count(*)::integer from jsonb_array_elements(public.get_competition_games(
  (select id from c104_probe where label='tournament'))->'games') item
  where (item->>'id')::uuid=(select id from c104_probe where label='new')), 1,
  'the competition catalogue retains the latest terminal result'
);

select * from finish();
rollback;
