import { readFileSync, writeFileSync } from 'node:fs'

function read(path) {
  return readFileSync(path, 'utf8')
}

function write(path, value) {
  writeFileSync(path, value)
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before)
  if (first < 0) throw new Error(`Missing target: ${label}`)
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Non-unique target: ${label}`)
  }
  return source.slice(0, first) + after + source.slice(first + before.length)
}

function replaceRegexOnce(source, pattern, after, label) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const matches = [...source.matchAll(new RegExp(pattern.source, flags))]
  if (matches.length !== 1) {
    throw new Error(`Expected one ${label}, found ${matches.length}`)
  }
  return source.replace(pattern, () => after)
}

const migrationPath = 'supabase/migrations/20260803070000_c1b_game_catalogue_memberships.sql'
let migration = read(migrationPath)

migration = replaceRegexOnce(
  migration,
  /create or replace function predictor_internal\.record_game_membership_event\(\)[\s\S]*?revoke all on function predictor_internal\.record_game_membership_event\(\)\n  from public, anon, authenticated, service_role;/,
  `create or replace function predictor_internal.record_game_membership_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
  v_recorded_at timestamptz;
begin
  if tg_op = 'INSERT' then
    v_event := 'joined';
  elsif old.status = 'left' and new.status = 'active' then
    v_event := 'rejoined';
  elsif old.status is distinct from new.status and new.status = 'left' then
    v_event := 'left';
  elsif old.status is distinct from new.status and new.status = 'disqualified' then
    v_event := 'disqualified';
  else
    return new;
  end if;

  select greatest(
    case when tg_op = 'INSERT' then new.joined_at else clock_timestamp() end,
    coalesce(
      max(event.recorded_at) + interval '1 microsecond',
      '-infinity'::timestamptz
    )
  )
    into v_recorded_at
    from public.game_membership_events event
    where event.membership_id = new.id;

  insert into public.game_membership_events (
    membership_id,
    tournament_id,
    game_competition_id,
    user_id,
    event_type,
    detail,
    actor_id,
    recorded_at
  ) values (
    new.id,
    new.tournament_id,
    new.game_competition_id,
    new.user_id,
    v_event,
    jsonb_strip_nulls(jsonb_build_object(
      'previous_status', case when tg_op = 'UPDATE' then old.status else null end,
      'rejoin_count', new.rejoin_count,
      'reason', nullif(current_setting('predictor.membership_event_reason', true), '')
    )),
    (select auth.uid()),
    v_recorded_at
  );

  return new;
end;
$$;

create trigger record_game_membership_event
after insert or update of status
on public.game_memberships
for each row
execute function predictor_internal.record_game_membership_event();

revoke all on function predictor_internal.record_game_membership_event()
  from public, anon, authenticated, service_role;`,
  'membership event recorder',
)

migration = replaceRegexOnce(
  migration,
  /create or replace function public\.enforce_entry_lock_scores\(\)[\s\S]*?\n\$\$;\n\ncreate or replace function public\.enforce_entry_lock_generic\(\)/,
  `create or replace function public.enforce_entry_lock_scores()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tournament uuid;
  v_membership_id uuid;
  v_membership_status text;
  v_lock timestamptz;
  v_kickoff timestamptz;
  v_score_changed boolean;
begin
  v_score_changed := tg_op = 'INSERT'
    or new.home_score is distinct from old.home_score
    or new.away_score is distinct from old.away_score;

  if not v_score_changed then
    return new;
  end if;

  select
    entry.tournament_id,
    entry.game_membership_id,
    membership.status,
    tournament.lock_at
    into v_tournament, v_membership_id, v_membership_status, v_lock
    from public.entries entry
    left join public.game_memberships membership on membership.id = entry.game_membership_id
    join public.tournaments tournament on tournament.id = entry.tournament_id
    where entry.id = new.entry_id;

  if v_tournament is null then
    raise exception 'Prediction references a missing entry'
      using errcode = 'foreign_key_violation';
  end if;

  if v_membership_id is not null
     and v_membership_status is distinct from 'active' then
    raise exception 'Join or rejoin this game before editing predictions'
      using errcode = 'insufficient_privilege';
  end if;

  if v_lock is null then
    raise exception 'Predictions are unavailable — the tournament lock is not configured'
      using errcode = 'check_violation';
  end if;

  if clock_timestamp() >= v_lock then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

  select match.kickoff_at into v_kickoff
  from public.matches match where match.id = new.match_id;

  if v_kickoff is not null and clock_timestamp() >= v_kickoff then
    raise exception 'This prediction is locked — the match has kicked off'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_entry_lock_generic()`,
  'score lock compatibility function',
)

migration = replaceRegexOnce(
  migration,
  /create or replace function public\.enforce_entry_lock_generic\(\)[\s\S]*?\n\$\$;\n\ncreate or replace function public\.enforce_joker_rules\(\)/,
  `create or replace function public.enforce_entry_lock_generic()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_entry uuid;
  v_match uuid;
  v_tournament uuid;
  v_membership_id uuid;
  v_membership_status text;
  v_lock timestamptz;
  v_kickoff timestamptz;
  v_server_position_refresh boolean :=
    tg_table_schema = 'public'
    and tg_table_name = 'predicted_group_positions'
    and current_user = 'postgres'
    and coalesce(current_setting('predictor.auto_submission_refresh', true), '') = 'on';
begin
  v_entry := case when tg_op = 'DELETE' then old.entry_id else new.entry_id end;

  select
    entry.tournament_id,
    entry.game_membership_id,
    membership.status,
    tournament.lock_at
    into v_tournament, v_membership_id, v_membership_status, v_lock
    from public.entries entry
    left join public.game_memberships membership on membership.id = entry.game_membership_id
    join public.tournaments tournament on tournament.id = entry.tournament_id
    where entry.id = v_entry;

  if v_tournament is null then
    raise exception 'Prediction references a missing entry'
      using errcode = 'foreign_key_violation';
  end if;

  if v_membership_id is not null
     and v_membership_status is distinct from 'active'
     and not v_server_position_refresh then
    raise exception 'Join or rejoin this game before editing predictions'
      using errcode = 'insufficient_privilege';
  end if;

  if v_lock is null and not v_server_position_refresh then
    raise exception 'Predictions are unavailable — the tournament lock is not configured'
      using errcode = 'check_violation';
  end if;

  if v_lock is not null and clock_timestamp() >= v_lock
     and not v_server_position_refresh then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

  if tg_table_name = 'match_predictions' then
    v_match := case when tg_op = 'DELETE' then old.match_id else new.match_id end;
    select match.kickoff_at into v_kickoff
    from public.matches match where match.id = v_match;

    if v_kickoff is not null and clock_timestamp() >= v_kickoff then
      raise exception 'This prediction is locked — the match has kicked off'
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.enforce_joker_rules()`,
  'generic lock compatibility function',
)

write(migrationPath, migration)

const capPath = 'supabase/tests/100_operating_cap_enforcement.sql'
let cap = read(capPath)
cap = replaceOnce(
  cap,
  `(select id::text from public.tournaments order by created_at, id limit 1),`,
  `(select id::text from public.tournaments where name = 'UEFA Euro 2028'),`,
  'operating-cap tournament fixture',
)
cap = replaceOnce(
  cap,
  `select set_config(
  'test.cap_owner_id',`,
  `select set_config(
  'test.cap_game_id',
  (
    select availability.id::text
    from public.bonus_competitions availability
    where availability.tournament_id = current_setting('test.cap_tournament_id')::uuid
      and availability.game_key = 'original_predictor'
  ),
  true
);
select set_config(
  'test.cap_owner_id',`,
  'operating-cap game fixture config',
)
cap = replaceOnce(
  cap,
  `insert into public.leagues (
  id,
  tournament_id,
  owner_id,
  name,
  invite_code
) values (
  '43000000-0000-0000-0000-000000000201',
  current_setting('test.cap_tournament_id')::uuid,
  current_setting('test.cap_owner_id')::uuid,
  'Operating Cap Baseline League',
  'CAPBAS'
);`,
  `insert into public.leagues (
  id,
  tournament_id,
  game_competition_id,
  owner_id,
  name,
  invite_code
) values (
  '43000000-0000-0000-0000-000000000201',
  current_setting('test.cap_tournament_id')::uuid,
  current_setting('test.cap_game_id')::uuid,
  current_setting('test.cap_owner_id')::uuid,
  'Operating Cap Baseline League',
  'CAPBAS'
);`,
  'operating-cap baseline league scope',
)
cap = replaceOnce(
  cap,
  `-- The legacy tournament-scoped league RPC now resolves the season's
-- Main/Original game and therefore requires the same canonical membership as
-- the product flow. Create that membership through the ordinary entry trigger.
insert into public.entries (user_id, tournament_id)
values (
  current_setting('test.cap_owner_id')::uuid,
  current_setting('test.cap_tournament_id')::uuid
);`,
  `-- The tournament-scoped compatibility RPC resolves the season's
-- Main/Original game. Both the owner and the later joiner therefore need the
-- same canonical game membership as the product flow.
insert into public.entries (user_id, tournament_id)
values
  (
    current_setting('test.cap_owner_id')::uuid,
    current_setting('test.cap_tournament_id')::uuid
  ),
  (
    current_setting('test.cap_member_id')::uuid,
    current_setting('test.cap_tournament_id')::uuid
  );`,
  'operating-cap canonical memberships',
)
write(capPath, cap)

const profilePath = 'supabase/tests/102_other_player_profiles.sql'
let profile = read(profilePath)
profile = replaceOnce(
  profile,
  `(select id::text from public.tournaments order by created_at, id limit 1),`,
  `(select id::text from public.tournaments where name = 'UEFA Euro 2028'),`,
  'other-player-profile tournament fixture',
)
write(profilePath, profile)

const c1bPath = 'supabase/tests/118_c1b_game_catalogue_memberships.sql'
let c1b = read(c1bPath)
c1b = replaceOnce(
  c1b,
  `select is(
  (select game_competition_id from public.leagues where name='C1b Main League'),
  current_setting('test.c1b_main_game')::uuid,
  'the private league stores its game availability explicitly'
);`,
  `select is(
  (select game_competition_id from public.leagues where name='C1b Main League'),
  current_setting('test.c1b_main_game')::uuid,
  'the private league stores its game availability explicitly'
);

select set_config(
  'test.c1b_main_league_code',
  (select invite_code from public.leagues where name='C1b Main League'),
  true
);`,
  'C1b private league invite fixture',
)
c1b = replaceOnce(
  c1b,
  `$sql$select * from public.join_league((select invite_code from public.leagues where name='C1b Main League'))$sql$`,
  `$sql$select * from public.join_league(current_setting('test.c1b_main_league_code'))$sql$`,
  'C1b non-member league join probe',
)
c1b = replaceOnce(
  c1b,
  `$sql$select * from public.join_league((select invite_code from public.leagues where name='C1b Main League'))$sql$`,
  `$sql$select * from public.join_league(current_setting('test.c1b_main_league_code'))$sql$`,
  'C1b active-member league join probe',
)
write(c1bPath, c1b)

const coveragePath = 'docs/architecture/stage-c-schema-coverage.md'
let coverage = read(coveragePath)
coverage = replaceOnce(
  coverage,
  `- \`get_bonus_games\`
- \`get_h2h_rank_history\``,
  `- \`get_bonus_games\`
- \`get_competition_games\`
- \`get_h2h_rank_history\``,
  'Stage C retained tournament-parameter inventory',
)
write(coveragePath, coverage)

writeFileSync('.c1b-final-repair-applied', 'applied\n')
console.log('Applied final C1b compatibility, fixture and manifest repairs.')
