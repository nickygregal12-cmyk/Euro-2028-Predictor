-- Contract 104: completed predecessors must never re-enter current-game reads.

begin;
select plan(31);

select matches(
  pg_get_functiondef('predictor_internal.enforce_season_matchweek_lock()'::regprocedure),
  'predictor_internal\.live_competition_id\(',
  'matchweek lock resolves through the one live-public-instance authority'
);

select is(
  regexp_count(pg_get_functiondef('predictor_internal.enforce_season_matchweek_lock()'::regprocedure),
    'predictor_internal\.live_competition_id\('),
  1,
  'matchweek lock contains exactly one live-instance resolution rather than parallel filters'
);

select matches(
  pg_get_functiondef('predictor_internal.prepare_competition_season_scope()'::regprocedure),
  'predictor_internal\.live_competition_id\(',
  'season-scope trigger resolves through the one live-public-instance authority'
);

select is(
  regexp_count(pg_get_functiondef('predictor_internal.prepare_competition_season_scope()'::regprocedure),
    'predictor_internal\.live_competition_id\('),
  1,
  'season-scope trigger contains exactly one live-instance resolution rather than parallel filters'
);

select matches(
  pg_get_functiondef('predictor_internal.recompute_ko_predictor_for_match(uuid)'::regprocedure),
  'predictor_internal\.live_competition_id\(',
  'KO rederive resolves through the one live-public-instance authority'
);

select is(
  regexp_count(pg_get_functiondef('predictor_internal.recompute_ko_predictor_for_match(uuid)'::regprocedure),
    'predictor_internal\.live_competition_id\('),
  1,
  'KO rederive contains exactly one live-instance resolution rather than parallel filters'
);

select matches(
  pg_get_functiondef('predictor_internal.recompute_lms_for_tournament(uuid)'::regprocedure),
  'predictor_internal\.live_competition_id\(',
  'LMS rederive resolves through the one live-public-instance authority'
);

select is(
  regexp_count(pg_get_functiondef('predictor_internal.recompute_lms_for_tournament(uuid)'::regprocedure),
    'predictor_internal\.live_competition_id\('),
  1,
  'LMS rederive contains exactly one live-instance resolution rather than parallel filters'
);

select matches(
  pg_get_functiondef('public.create_league(uuid,text)'::regprocedure),
  'predictor_internal\.live_competition_id\(',
  'league compatibility RPC resolves through the one live-public-instance authority'
);

select is(
  regexp_count(pg_get_functiondef('public.create_league(uuid,text)'::regprocedure),
    'predictor_internal\.live_competition_id\('),
  1,
  'league compatibility RPC contains exactly one live-instance resolution rather than parallel filters'
);

select matches(
  pg_get_functiondef('public.get_bonus_games(uuid)'::regprocedure),
  'predictor_internal\.live_competition_id\(',
  'Bonus Games hub resolves through the one live-public-instance authority'
);

select is(
  regexp_count(pg_get_functiondef('public.get_bonus_games(uuid)'::regprocedure),
    'predictor_internal\.live_competition_id\('),
  1,
  'Bonus Games hub contains exactly one live-instance resolution rather than parallel filters'
);

select matches(
  pg_get_functiondef('public.get_competition_games(uuid)'::regprocedure),
  'predictor_internal\.live_competition_id\(',
  'competition game catalogue resolves through the one live-public-instance authority'
);

select is(
  regexp_count(pg_get_functiondef('public.get_competition_games(uuid)'::regprocedure),
    'predictor_internal\.live_competition_id\('),
  1,
  'competition game catalogue contains exactly one live-instance resolution rather than parallel filters'
);

select matches(
  pg_get_functiondef('public.get_ko_predictor_standings(uuid,integer,text)'::regprocedure),
  'predictor_internal\.live_competition_id\(',
  'KO standings resolves through the one live-public-instance authority'
);

select is(
  regexp_count(pg_get_functiondef('public.get_ko_predictor_standings(uuid,integer,text)'::regprocedure),
    'predictor_internal\.live_competition_id\('),
  1,
  'KO standings contains exactly one live-instance resolution rather than parallel filters'
);

select matches(
  pg_get_functiondef('public.get_my_cup(uuid)'::regprocedure),
  'predictor_internal\.live_competition_id\(',
  'Cup read resolves through the one live-public-instance authority'
);

select is(
  regexp_count(pg_get_functiondef('public.get_my_cup(uuid)'::regprocedure),
    'predictor_internal\.live_competition_id\('),
  1,
  'Cup read contains exactly one live-instance resolution rather than parallel filters'
);

select matches(
  pg_get_functiondef('public.get_my_lms(uuid)'::regprocedure),
  'predictor_internal\.live_competition_id\(',
  'LMS read resolves through the one live-public-instance authority'
);

select is(
  regexp_count(pg_get_functiondef('public.get_my_lms(uuid)'::regprocedure),
    'predictor_internal\.live_competition_id\('),
  1,
  'LMS read contains exactly one live-instance resolution rather than parallel filters'
);

select ok(
  regexp_count(pg_get_functiondef('predictor_internal.prepare_competition_season_scope()'::regprocedure),
    'where id = new\.competition_id') >= 8,
  'the season-scope trigger keeps its direct-ID branches direct; only the KO fallback resolves current state'
);

select unlike(
  pg_get_functiondef('predictor_internal.recompute_ko_predictor_for_match(uuid)'::regprocedure),
  'from public\.bonus_competitions',
  'the KO rederive no longer performs an independent tournament+game lookup'
);

select unlike(
  pg_get_functiondef('predictor_internal.recompute_lms_for_tournament(uuid)'::regprocedure),
  'from public\.bonus_competitions',
  'the LMS rederive no longer performs an independent tournament+game lookup'
);

select matches(
  pg_get_functiondef('public.create_league(uuid,text)'::regprocedure),
  'live_competition_id\(p_tournament_id, availability\.game_key\)',
  'league compatibility chooses only a live public prediction-entry game'
);

select matches(
  pg_get_functiondef('public.get_bonus_games(uuid)'::regprocedure),
  'live_competition_id\(p_tournament_id, candidate\.game_key\)',
  'the legacy Bonus Games listing filters every game key through the resolver'
);

select matches(
  pg_get_functiondef('public.get_competition_games(uuid)'::regprocedure),
  'live_competition_id\(p_tournament_id, availability\.game_key\)',
  'the current game catalogue filters every game key through the resolver'
);

select matches(
  pg_get_functiondef('public.get_my_cup(uuid)'::regprocedure),
  'competition\.published',
  'the Cup read keeps its publication boundary while changing instance resolution'
);

-- Real predecessor/successor proof for both catalogue RPCs.
create temporary table c104_probe (label text primary key, id uuid not null) on commit drop;

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
    and competition.published
  order by competition.game_key, competition.id
  limit 1;

  if v_old.id is null then
    raise exception 'Contract 104 proof needs one published public competition';
  end if;

  select id into v_user from public.profiles order by id limit 1;
  if v_user is null then
    raise exception 'Contract 104 proof needs one seeded profile';
  end if;

  update public.bonus_competitions
  set completed_at = now(), completion_reason = 'abandoned'
  where id = v_old.id;

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
  (select count(*)::integer
   from jsonb_array_elements(public.get_bonus_games(
     (select id from c104_probe where label = 'tournament')
   )->'competitions') item
   where (item->>'id')::uuid = (select id from c104_probe where label = 'new')),
  1,
  'the Bonus Games hub returns the live successor'
);

select is(
  (select count(*)::integer
   from jsonb_array_elements(public.get_bonus_games(
     (select id from c104_probe where label = 'tournament')
   )->'competitions') item
   where (item->>'id')::uuid = (select id from c104_probe where label = 'old')),
  0,
  'the Bonus Games hub never leaks the completed predecessor'
);

select is(
  (select count(*)::integer
   from jsonb_array_elements(public.get_competition_games(
     (select id from c104_probe where label = 'tournament')
   )->'games') item
   where (item->>'id')::uuid = (select id from c104_probe where label = 'new')),
  1,
  'the competition catalogue returns the live successor'
);

select is(
  (select count(*)::integer
   from jsonb_array_elements(public.get_competition_games(
     (select id from c104_probe where label = 'tournament')
   )->'games') item
   where (item->>'id')::uuid = (select id from c104_probe where label = 'old')),
  0,
  'the competition catalogue never leaks the completed predecessor'
);

select * from finish();
rollback;
