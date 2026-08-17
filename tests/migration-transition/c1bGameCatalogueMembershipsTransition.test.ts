import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * Contract 65 → 66 must be rehearsed with the existing Euro stores populated.
 * A zero-to-current rebuild proves the after-state but cannot prove that C1b's
 * entry, Bonus Games, audit and private-league backfills preserve real rows.
 *
 * The workflow resets to canonical contract 65 before this subject runs. The
 * canonical C1b migration is unwrapped only from its outer BEGIN/COMMIT so it
 * can execute inside a test-owned transaction and be rolled back after every
 * probe. No authored SQL statement inside the migration is changed.
 */

const databaseEnabled = process.env.DATABASE_PARITY === '1'
const databaseDescribe = databaseEnabled ? describe : describe.skip
const databaseContainer =
  process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_euro-2028-predictor-local'

const CONTRACT_65_MIGRATION = '20260730235602'
const C1B_MIGRATION = '20260803070000_c1b_game_catalogue_memberships.sql'

const canonicalMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations', C1B_MIGRATION),
  'utf8',
)

function unwrapOuterTransaction(source: string): string {
  const match = source.match(/^\s*begin;\s*([\s\S]*?)\s*commit;\s*$/i)
  if (!match) {
    throw new Error('C1b migration must retain one canonical outer BEGIN/COMMIT wrapper')
  }
  return at(match, 1)
}

const c1b = unwrapOuterTransaction(canonicalMigration)

function runScript(script: string): Record<string, unknown> {
  const output = execFileSync(
    'docker',
    [
      'exec',
      '-i',
      databaseContainer,
      'psql',
      '-X',
      '-q',
      '-t',
      '-A',
      '-U',
      'postgres',
      '-d',
      'postgres',
    ],
    { encoding: 'utf8', input: script, stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim()

  const payload = output.split('\n').filter(Boolean).at(-1)
  expect(payload, 'psql produced no C1b transition probe payload').toBeTruthy()
  return JSON.parse(payload!) as Record<string, unknown>
}

const FIXTURE = `
create temp table c1b_fixture_season as
select id as tournament_id
from public.tournaments
where name = 'UEFA Euro 2028' and year = 2028;

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('65000000-0000-4000-8000-000000000001', 'c1b-entry@example.test', 'authenticated', 'authenticated', '{}', '{}', '2026-01-01 10:00:00+00', '2026-01-01 10:00:00+00'),
  ('65000000-0000-4000-8000-000000000002', 'c1b-bonus@example.test', 'authenticated', 'authenticated', '{}', '{}', '2026-01-01 10:01:00+00', '2026-01-01 10:01:00+00');
set local session_replication_role = origin;

insert into public.profiles (id, display_name, created_at)
values
  ('65000000-0000-4000-8000-000000000001', 'C1b Entry Owner', '2026-01-01 10:00:00+00'),
  ('65000000-0000-4000-8000-000000000002', 'C1b Bonus Entrant', '2026-01-01 10:01:00+00');

insert into public.entries (id, user_id, tournament_id, created_at)
select
  '65000000-0000-4000-8000-000000000011',
  '65000000-0000-4000-8000-000000000001',
  tournament_id,
  '2026-01-02 09:00:00+00'
from c1b_fixture_season;

insert into public.bonus_competitions (
  id, tournament_id, game_key, published,
  registration_opens_at, registration_closes_at, draw_required,
  created_at, updated_at
)
select
  '65000000-0000-4000-8000-000000000021',
  tournament_id,
  'ko_predictor',
  true,
  '2026-01-01 00:00:00+00',
  '2027-01-01 00:00:00+00',
  false,
  '2026-01-01 00:00:00+00',
  '2026-01-01 00:00:00+00'
from c1b_fixture_season;

insert into public.bonus_competition_entrants (
  competition_id, user_id, joined_at, outcome, updated_at
) values (
  '65000000-0000-4000-8000-000000000021',
  '65000000-0000-4000-8000-000000000002',
  '2026-01-03 11:00:00+00',
  'active',
  '2026-01-03 11:00:00+00'
);

insert into public.bonus_competition_audit (
  id, competition_id, action, detail, actor_id, recorded_at
) values (
  '65000000-0000-4000-8000-000000000031',
  '65000000-0000-4000-8000-000000000021',
  'entrant_registered',
  '{"source":"contract-65-transition"}'::jsonb,
  '65000000-0000-4000-8000-000000000002',
  '2026-01-03 11:00:01+00'
);

insert into public.leagues (
  id, tournament_id, owner_id, name, invite_code, created_at
)
select
  '65000000-0000-4000-8000-000000000041',
  tournament_id,
  '65000000-0000-4000-8000-000000000001',
  'Contract 65 League',
  'C1B001',
  '2026-01-04 12:00:00+00'
from c1b_fixture_season;

insert into public.league_members (league_id, user_id, role, joined_at)
values (
  '65000000-0000-4000-8000-000000000041',
  '65000000-0000-4000-8000-000000000001',
  'owner',
  '2026-01-04 12:00:00+00'
);
`

const CAPTURE_BEFORE = `
create temp table c1b_euro_before as
select id, name, year, starts_on, ends_on, created_at, lock_at,
       golden_boot_player_id, competition_id, season_key, kind,
       display_timezone, status
from public.tournaments
where name = 'UEFA Euro 2028' and year = 2028;

create temp table c1b_entry_before as
select id, user_id, tournament_id, submitted_at, created_at
from public.entries
where id = '65000000-0000-4000-8000-000000000011';

create temp table c1b_entrant_before as
select competition_id, user_id, joined_at, outcome, updated_at, tournament_id
from public.bonus_competition_entrants
where competition_id = '65000000-0000-4000-8000-000000000021'
  and user_id = '65000000-0000-4000-8000-000000000002';

create temp table c1b_audit_before as
select id, competition_id, action, detail, actor_id, recorded_at, tournament_id
from public.bonus_competition_audit
where id = '65000000-0000-4000-8000-000000000031';

create temp table c1b_league_before as
select id, tournament_id, owner_id, name, invite_code, created_at
from public.leagues
where id = '65000000-0000-4000-8000-000000000041';

create temp table c1b_auth_fks_before as
select conname, confdeltype
from pg_catalog.pg_constraint
where conname in (
  'profiles_id_fkey',
  'entries_user_id_fkey',
  'bonus_competition_entrants_user_id_fkey',
  'leagues_owner_id_fkey'
);

create temp table c1b_transition_probe (name text primary key, value jsonb);
`

const SUCCESS_PROBES = `
insert into c1b_transition_probe (name, value)
select 'euro_identity_unchanged', to_jsonb(not exists (
  select * from c1b_euro_before
  except
  select id, name, year, starts_on, ends_on, created_at, lock_at,
         golden_boot_player_id, competition_id, season_key, kind,
         display_timezone, status
  from public.tournaments
  where name = 'UEFA Euro 2028' and year = 2028
) and not exists (
  select id, name, year, starts_on, ends_on, created_at, lock_at,
         golden_boot_player_id, competition_id, season_key, kind,
         display_timezone, status
  from public.tournaments
  where name = 'UEFA Euro 2028' and year = 2028
  except
  select * from c1b_euro_before
));

insert into c1b_transition_probe (name, value)
select 'legacy_entry_unchanged', to_jsonb(not exists (
  select * from c1b_entry_before
  except
  select id, user_id, tournament_id, submitted_at, created_at
  from public.entries
  where id = '65000000-0000-4000-8000-000000000011'
));

insert into c1b_transition_probe (name, value)
select 'legacy_entrant_unchanged', to_jsonb(not exists (
  select * from c1b_entrant_before
  except
  select competition_id, user_id, joined_at, outcome, updated_at, tournament_id
  from public.bonus_competition_entrants
  where competition_id = '65000000-0000-4000-8000-000000000021'
    and user_id = '65000000-0000-4000-8000-000000000002'
));

insert into c1b_transition_probe (name, value)
select 'audit_history_unchanged', to_jsonb(not exists (
  select * from c1b_audit_before
  except
  select id, competition_id, action, detail, actor_id, recorded_at, tournament_id
  from public.bonus_competition_audit
  where id = '65000000-0000-4000-8000-000000000031'
));

insert into c1b_transition_probe (name, value)
select 'legacy_league_unchanged', to_jsonb(not exists (
  select * from c1b_league_before
  except
  select id, tournament_id, owner_id, name, invite_code, created_at
  from public.leagues
  where id = '65000000-0000-4000-8000-000000000041'
));

insert into c1b_transition_probe (name, value)
select 'existing_auth_fk_actions_unchanged', to_jsonb(not exists (
  select * from c1b_auth_fks_before
  except
  select conname, confdeltype
  from pg_catalog.pg_constraint
  where conname in (
    'profiles_id_fkey',
    'entries_user_id_fkey',
    'bonus_competition_entrants_user_id_fkey',
    'leagues_owner_id_fkey'
  )
));

insert into c1b_transition_probe (name, value)
select 'game_definition_shape', coalesce(jsonb_agg(jsonb_build_object(
  'key', game_key,
  'scope', lock_scope,
  'buffer', buffer_minutes,
  'rejoin', allow_rejoin
) order by game_key), '[]'::jsonb)
from public.game_definitions;

insert into c1b_transition_probe (name, value)
select 'entry_linked', to_jsonb(count(*) = 1)
from public.entries entry
join public.bonus_competitions availability
  on availability.id = entry.game_competition_id
 and availability.tournament_id = entry.tournament_id
 and availability.game_key = 'original_predictor'
join public.game_memberships membership
  on membership.id = entry.game_membership_id
 and membership.game_competition_id = entry.game_competition_id
 and membership.tournament_id = entry.tournament_id
 and membership.user_id = entry.user_id
 and membership.status = 'active'
where entry.id = '65000000-0000-4000-8000-000000000011';

insert into c1b_transition_probe (name, value)
select 'bonus_entrant_linked', to_jsonb(count(*) = 1)
from public.bonus_competition_entrants entrant
join public.game_memberships membership
  on membership.id = entrant.game_membership_id
 and membership.game_competition_id = entrant.competition_id
 and membership.tournament_id = entrant.tournament_id
 and membership.user_id = entrant.user_id
 and membership.status = 'active'
where entrant.competition_id = '65000000-0000-4000-8000-000000000021'
  and entrant.user_id = '65000000-0000-4000-8000-000000000002';

insert into c1b_transition_probe (name, value)
select 'league_linked_to_original', to_jsonb(count(*) = 1)
from public.leagues league
join public.bonus_competitions availability
  on availability.id = league.game_competition_id
 and availability.tournament_id = league.tournament_id
 and availability.game_key = 'original_predictor'
where league.id = '65000000-0000-4000-8000-000000000041';

insert into c1b_transition_probe (name, value)
select 'fixture_memberships', to_jsonb(count(*))
from public.game_memberships
where user_id in (
  '65000000-0000-4000-8000-000000000001',
  '65000000-0000-4000-8000-000000000002'
);

insert into c1b_transition_probe (name, value)
select 'fixture_joined_events', to_jsonb(count(*))
from public.game_membership_events
where user_id in (
  '65000000-0000-4000-8000-000000000001',
  '65000000-0000-4000-8000-000000000002'
) and event_type = 'joined';

insert into c1b_transition_probe (name, value)
select 'domestic_season_roots', to_jsonb(count(*))
from public.tournaments season
join public.competitions competition on competition.id = season.competition_id
where competition.slug in ('premier-league', 'scottish-premiership')
  and season.season_key = '2026-27'
  and season.kind = 'league_season'
  and season.status = 'draft'
  and season.starts_on is null
  and season.ends_on is null
  and season.lock_at is null;

insert into c1b_transition_probe (name, value)
select 'domestic_fixture_count', to_jsonb(count(*))
from public.matches match
join public.tournaments season on season.id = match.tournament_id
join public.competitions competition on competition.id = season.competition_id
where competition.slug in ('premier-league', 'scottish-premiership')
  and season.season_key = '2026-27';

insert into c1b_transition_probe (name, value)
select 'disabled_public_triggers', coalesce(jsonb_agg(trigger_row.tgname order by trigger_row.tgname), '[]'::jsonb)
from pg_catalog.pg_trigger trigger_row
join pg_catalog.pg_class relation on relation.oid = trigger_row.tgrelid
join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and not trigger_row.tgisinternal
  and trigger_row.tgenabled = 'D';

do $c1b_immutability$
declare
  v_audit_update text;
  v_event_update text;
begin
  begin
    update public.bonus_competition_audit
    set action = 'tampered'
    where id = '65000000-0000-4000-8000-000000000031';
    v_audit_update := 'no-error';
  exception when others then
    v_audit_update := sqlstate;
  end;

  begin
    update public.game_membership_events
    set detail = '{"tampered":true}'::jsonb
    where user_id = '65000000-0000-4000-8000-000000000001';
    v_event_update := 'no-error';
  exception when others then
    v_event_update := sqlstate;
  end;

  insert into c1b_transition_probe (name, value)
  values
    ('audit_update_sqlstate', to_jsonb(v_audit_update)),
    ('membership_event_update_sqlstate', to_jsonb(v_event_update));
end
$c1b_immutability$;
`

const ROLLBACK_PROBES = `
create temp table c1b_transition_probe (name text primary key, value jsonb);

insert into c1b_transition_probe (name, value)
select 'game_definitions_absent', to_jsonb(to_regclass('public.game_definitions') is null);

insert into c1b_transition_probe (name, value)
select 'entry_link_columns_absent', to_jsonb(count(*) = 0)
from information_schema.columns
where table_schema = 'public'
  and table_name = 'entries'
  and column_name in ('game_competition_id', 'game_membership_id');

insert into c1b_transition_probe (name, value)
select 'fixture_entry_restored', to_jsonb(count(*) = 1)
from public.entries
where id = '65000000-0000-4000-8000-000000000011';

insert into c1b_transition_probe (name, value)
select 'fixture_entrant_restored', to_jsonb(count(*) = 1)
from public.bonus_competition_entrants
where competition_id = '65000000-0000-4000-8000-000000000021'
  and user_id = '65000000-0000-4000-8000-000000000002';

insert into c1b_transition_probe (name, value)
select 'fixture_audit_restored', to_jsonb(count(*) = 1)
from public.bonus_competition_audit
where id = '65000000-0000-4000-8000-000000000031';

insert into c1b_transition_probe (name, value)
select 'fixture_league_restored', to_jsonb(count(*) = 1)
from public.leagues
where id = '65000000-0000-4000-8000-000000000041';

insert into c1b_transition_probe (name, value)
select 'disabled_public_triggers', coalesce(jsonb_agg(trigger_row.tgname order by trigger_row.tgname), '[]'::jsonb)
from pg_catalog.pg_trigger trigger_row
join pg_catalog.pg_class relation on relation.oid = trigger_row.tgrelid
join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and not trigger_row.tgisinternal
  and trigger_row.tgenabled = 'D';

do $c1b_rollback_immutability$
declare
  v_audit_update text;
begin
  begin
    update public.bonus_competition_audit
    set action = 'tampered'
    where id = '65000000-0000-4000-8000-000000000031';
    v_audit_update := 'no-error';
  exception when others then
    v_audit_update := sqlstate;
  end;

  insert into c1b_transition_probe (name, value)
  values ('audit_update_sqlstate', to_jsonb(v_audit_update));
end
$c1b_rollback_immutability$;
`

function contractSixtyFivePrecondition(): string {
  return `\\set ON_ERROR_STOP on
select jsonb_build_object(
  'latest_migration', (select max(version) from supabase_migrations.schema_migrations),
  'euro_count', (select count(*) from public.tournaments where name='UEFA Euro 2028' and year=2028),
  'game_definitions_absent', to_regclass('public.game_definitions') is null,
  'entry_link_columns_absent', not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='entries'
      and column_name in ('game_competition_id','game_membership_id')
  )
);`
}

function populatedTransition(): string {
  return `\\set ON_ERROR_STOP on
begin;
${FIXTURE}
${CAPTURE_BEFORE}
${c1b}
${SUCCESS_PROBES}
select coalesce(jsonb_object_agg(name, value), '{}'::jsonb) from c1b_transition_probe;
rollback;`
}

function rollbackRestoresContractSixtyFive(): string {
  return `\\set ON_ERROR_STOP on
begin;
${FIXTURE}
savepoint before_c1b;
${c1b}
\\set ON_ERROR_STOP off
do $c1b_induced_failure$ begin
  raise exception 'induced failure after the C1b backfills';
end $c1b_induced_failure$;
\\set ON_ERROR_STOP on
rollback to savepoint before_c1b;
${ROLLBACK_PROBES}
select coalesce(jsonb_object_agg(name, value), '{}'::jsonb) from c1b_transition_probe;
rollback;`
}

databaseDescribe('C1b populated contract 65 → 66 transition', () => {
  let probe: Record<string, unknown>

  beforeAll(() => {
    const state = runScript(contractSixtyFivePrecondition())
    expect(state.latest_migration).toBe(CONTRACT_65_MIGRATION)
    expect(state.euro_count).toBe(1)
    expect(state.game_definitions_absent).toBe(true)
    expect(state.entry_link_columns_absent).toBe(true)

    probe = runScript(populatedTransition())
  }, 120_000)

  it('preserves Euro identity and every populated legacy store', () => {
    expect(probe.euro_identity_unchanged).toBe(true)
    expect(probe.legacy_entry_unchanged).toBe(true)
    expect(probe.legacy_entrant_unchanged).toBe(true)
    expect(probe.audit_history_unchanged).toBe(true)
    expect(probe.legacy_league_unchanged).toBe(true)
    expect(probe.existing_auth_fk_actions_unchanged).toBe(true)
  })

  it('backfills one canonical membership truth across entry, bonus and league rows', () => {
    expect(probe.entry_linked).toBe(true)
    expect(probe.bonus_entrant_linked).toBe(true)
    expect(probe.league_linked_to_original).toBe(true)
    expect(probe.fixture_memberships).toBe(2)
    expect(probe.fixture_joined_events).toBe(2)
  })

  it('persists the exact game-owned lock and rejoin catalogue', () => {
    expect(probe.game_definition_shape).toEqual([
      { key: 'ko_predictor', scope: 'match', buffer: 0, rejoin: true },
      { key: 'last_man_standing', scope: 'round', buffer: 30, rejoin: false },
      { key: 'main_predictor', scope: 'round', buffer: 0, rejoin: true },
      { key: 'original_predictor', scope: 'entry', buffer: 0, rejoin: true },
      { key: 'predictor_cup', scope: 'round', buffer: 0, rejoin: true },
    ])
  })

  it('seeds only draft domestic roots and no invented fixtures or dates', () => {
    expect(probe.domestic_season_roots).toBe(2)
    expect(probe.domestic_fixture_count).toBe(0)
  })

  it('restores every trigger and keeps both old and new evidence append-only', () => {
    expect(probe.disabled_public_triggers).toEqual([])
    expect(probe.audit_update_sqlstate).toBe('42501')
    expect(probe.membership_event_update_sqlstate).toBe('42501')
  })

  it('rolls the complete schema and backfill back after a later failure', () => {
    const rollback = runScript(rollbackRestoresContractSixtyFive())

    expect(rollback.game_definitions_absent).toBe(true)
    expect(rollback.entry_link_columns_absent).toBe(true)
    expect(rollback.fixture_entry_restored).toBe(true)
    expect(rollback.fixture_entrant_restored).toBe(true)
    expect(rollback.fixture_audit_restored).toBe(true)
    expect(rollback.fixture_league_restored).toBe(true)
    expect(rollback.disabled_public_triggers).toEqual([])
    expect(rollback.audit_update_sqlstate).toBe('42501')
  }, 120_000)
})
