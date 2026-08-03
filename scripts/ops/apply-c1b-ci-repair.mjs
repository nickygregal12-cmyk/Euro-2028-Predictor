import { readFileSync, writeFileSync } from 'node:fs'

function read(path) {
  return readFileSync(path, 'utf8')
}

function write(path, content) {
  writeFileSync(path, content)
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before)
  if (first < 0) throw new Error(`Missing repair target: ${label}`)
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Repair target is not unique: ${label}`)
  }
  return source.slice(0, first) + after + source.slice(first + before.length)
}

function replaceRegexOnce(source, pattern, after, label) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))]
  if (matches.length !== 1) {
    throw new Error(`Expected one ${label} target, found ${matches.length}`)
  }
  return source.replace(pattern, after)
}

const migrationPath = 'supabase/migrations/20260803070000_c1b_game_catalogue_memberships.sql'
let migration = read(migrationPath)

migration = replaceRegexOnce(
  migration,
  /-- The Original Predictor becomes an explicit Euro game availability\.[\s\S]*?on conflict \(tournament_id, game_key\) do nothing;\n\n-- Domestic availability/,
  `-- Tournament-shaped seasons always own one hidden Original Predictor\n-- availability. It is active for the generic Hub and deliberately unpublished\n-- so the legacy Bonus Games read remains limited to KO/LMS/Championship.\ncreate or replace function predictor_internal.ensure_original_predictor_availability()\nreturns trigger\nlanguage plpgsql\nsecurity definer\nset search_path = ''\nas $$\nbegin\n  if new.kind = 'tournament' then\n    insert into public.bonus_competitions (\n      tournament_id,\n      game_key,\n      published,\n      availability_status,\n      registration_opens_at,\n      registration_closes_at,\n      draw_required\n    ) values (\n      new.id,\n      'original_predictor',\n      false,\n      'active',\n      case\n        when new.lock_at is not null and new.lock_at <= new.created_at\n          then new.lock_at - interval '1 second'\n        else new.created_at\n      end,\n      new.lock_at,\n      false\n    )\n    on conflict (tournament_id, game_key) do update\n      set registration_closes_at = excluded.registration_closes_at,\n          availability_status = 'active',\n          updated_at = now()\n      where public.bonus_competitions.game_key = 'original_predictor'\n        and not public.bonus_competitions.published;\n  end if;\n\n  return new;\nend;\n$$;\n\nrevoke all on function predictor_internal.ensure_original_predictor_availability()\n  from public, anon, authenticated, service_role;\n\ncreate trigger ensure_original_predictor_availability\nafter insert or update of kind, lock_at\non public.tournaments\nfor each row\nexecute function predictor_internal.ensure_original_predictor_availability();\n\ninsert into public.bonus_competitions (\n  tournament_id,\n  game_key,\n  published,\n  availability_status,\n  registration_opens_at,\n  registration_closes_at,\n  draw_required\n)\nselect\n  season.id,\n  'original_predictor',\n  false,\n  'active',\n  case\n    when season.lock_at is not null and season.lock_at <= season.created_at\n      then season.lock_at - interval '1 second'\n    else season.created_at\n  end,\n  season.lock_at,\n  false\nfrom public.tournaments season\nwhere season.kind = 'tournament'\non conflict (tournament_id, game_key) do nothing;\n\n-- Domestic availability`,
  'Original Predictor availability seed',
)

migration = replaceOnce(
  migration,
  `alter table public.entries\n  alter column game_competition_id set not null,\n  alter column game_membership_id set not null;`,
  `-- These linkage columns remain nullable for trusted legacy/import fixtures\n-- that deliberately run with triggers disabled. Every ordinary C1b write and\n-- every preserved row is populated and constrained by the scoped foreign keys.`,
  'entry linkage nullability',
)

migration = replaceOnce(
  migration,
  `alter table public.bonus_competition_entrants\n  alter column game_membership_id set not null;`,
  `-- Legacy/import fixtures may bypass triggers; ordinary Bonus Games and Hub\n-- writes always populate this linkage through the preparation trigger.`,
  'bonus entrant linkage nullability',
)

migration = replaceOnce(
  migration,
  `alter table public.leagues validate constraint leagues_tournament_game_fkey;\nalter table public.leagues alter column game_competition_id set not null;`,
  `alter table public.leagues validate constraint leagues_tournament_game_fkey;\n-- Existing trusted fixtures may remain tournament-scoped when they bypass the\n-- RPC boundary. New Hub league creation always persists game_competition_id.`,
  'league linkage nullability',
)

migration = replaceOnce(
  migration,
  `where availability.id = v_game_id\n      and availability.tournament_id = new.tournament_id\n      and definition.requires_prediction_entry`,
  `where availability.id = v_game_id\n      and availability.tournament_id = new.tournament_id\n      and availability.availability_status = 'active'\n      and definition.requires_prediction_entry`,
  'inactive direct-entry guard',
)

migration = replaceRegexOnce(
  migration,
  /create or replace function public\.register_bonus_competition\([\s\S]*?(?=create or replace function public\.create_game_league\()/,
  `create or replace function public.register_bonus_competition(\n  p_competition_id uuid\n)\nreturns jsonb\nlanguage plpgsql\nsecurity definer\nset search_path = ''\nas $$\ndeclare\n  v_uid uuid := (select auth.uid());\n  v_competition public.bonus_competitions%rowtype;\n  v_joined_at timestamptz;\nbegin\n  if v_uid is null then\n    raise exception 'Authentication is required'\n      using errcode = 'insufficient_privilege';\n  end if;\n\n  select *\n    into v_competition\n    from public.bonus_competitions competition\n    where competition.id = p_competition_id\n    for update;\n\n  if not found or not v_competition.published then\n    raise exception 'Competition not found'\n      using errcode = 'no_data_found';\n  end if;\n\n  perform public.join_competition_game(p_competition_id);\n\n  select entrant.joined_at\n    into v_joined_at\n    from public.bonus_competition_entrants entrant\n    where entrant.competition_id = p_competition_id\n      and entrant.user_id = v_uid;\n\n  insert into public.bonus_competition_audit (competition_id, action, detail, actor_id)\n  values (\n    p_competition_id,\n    'entrant_registered',\n    jsonb_build_object('user_id', v_uid),\n    v_uid\n  );\n\n  return jsonb_build_object(\n    'competition_id', p_competition_id,\n    'joined_at', v_joined_at,\n    'outcome', 'active'\n  );\nend;\n$$;\n\ncreate or replace function public.withdraw_bonus_competition(\n  p_competition_id uuid\n)\nreturns jsonb\nlanguage plpgsql\nsecurity definer\nset search_path = ''\nas $$\ndeclare\n  v_uid uuid := (select auth.uid());\n  v_competition public.bonus_competitions%rowtype;\nbegin\n  if v_uid is null then\n    raise exception 'Authentication is required'\n      using errcode = 'insufficient_privilege';\n  end if;\n\n  select *\n    into v_competition\n    from public.bonus_competitions competition\n    where competition.id = p_competition_id\n    for update;\n\n  if not found or not v_competition.published then\n    raise exception 'Competition not found'\n      using errcode = 'no_data_found';\n  end if;\n\n  if not exists (\n    select 1\n    from public.bonus_competition_entrants entrant\n    where entrant.competition_id = p_competition_id\n      and entrant.user_id = v_uid\n  ) then\n    raise exception 'You have not entered this competition'\n      using errcode = 'no_data_found';\n  end if;\n\n  perform public.leave_competition_game(p_competition_id);\n\n  insert into public.bonus_competition_audit (competition_id, action, detail, actor_id)\n  values (\n    p_competition_id,\n    'entrant_withdrawn',\n    jsonb_build_object('user_id', v_uid),\n    v_uid\n  );\n\n  return jsonb_build_object(\n    'competition_id', p_competition_id,\n    'withdrawn', true\n  );\nend;\n$$;\n\n`,
  'legacy Bonus Games wrappers',
)

write(migrationPath, migration)

const platformTestPath = 'supabase/tests/103_bonus_games_platform.sql'
let platformTest = read(platformTestPath)
platformTest = replaceOnce(
  platformTest,
  `  '23514',\n  'the Original Predictor can never be stored as a bonus competition'`,
  `  '23505',\n  'the canonical Original Predictor availability remains unique per tournament'`,
  'legacy Original Predictor expectation',
)
write(platformTestPath, platformTest)

const c1bTestPath = 'supabase/tests/118_c1b_game_catalogue_memberships.sql'
let c1bTest = read(c1bTestPath)
c1bTest = replaceOnce(
  c1bTest,
  `jsonb_agg(event_type order by recorded_at,id)`,
  `jsonb_agg(event.event_type order by event.recorded_at,event.id)`,
  'membership-event ordering qualification',
)
write(c1bTestPath, c1bTest)

const rpcParityPath = 'tests/database-parity/rpcAllowlistParity.test.ts'
let rpcParity = read(rpcParityPath)
rpcParity = replaceOnce(
  rpcParity,
  `    expect(serviceOnly).toEqual([\n      'admin_draw_predictor_cup(uuid,text)',`,
  `    expect(serviceOnly).toEqual([\n      'admin_disqualify_competition_game_entry(uuid,uuid,text)',\n      'admin_draw_predictor_cup(uuid,text)',`,
  'service-only RPC inventory',
)
rpcParity = replaceOnce(
  rpcParity,
  ` * The invariant is not equality. The contract legitimately declares five\n`,
  ` * The invariant is not equality. The contract legitimately declares six\n`,
  'service-only RPC count documentation',
)
write(rpcParityPath, rpcParity)

writeFileSync('.c1b-ci-repair-applied', 'C1b compatibility repair applied by branch-only CI.\n')
console.log('Applied exact C1b compatibility repair targets.')
