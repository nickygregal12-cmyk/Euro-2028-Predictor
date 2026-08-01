/**
 * SQL for the contract 64 → 65 rehearsal that carries real audit rows.
 *
 * Stage C1 gives `bonus_competition_audit` a derived `tournament_id`. That table
 * is the only backfill target guarded by a row-level BEFORE UPDATE OR DELETE
 * immutability trigger, and a row-level trigger does not fire when a statement
 * matches zero rows. Every disposable rebuild reaches Stage C1 with an empty
 * audit table, so the backfill was never executed against a row until hosted
 * development — which had nine audit rows — raised 42501 and rolled the whole
 * migration back.
 *
 * These scripts run against a database already at canonical contract 64. Each one
 * is a single transaction that is rolled back, so a case can seed rows, apply the
 * real migration text and probe destructive behaviour without leaving the
 * database anywhere other than where it started.
 */

/** Three competitions × three actions: the shape hosted development carried. */
const FIXTURE = `
insert into auth.users (id, email)
values ('4a1d0b7e-2f56-4a24-9d6e-6a1b0c2d3e4f', 'stage-c1-rehearsal@example.test');

insert into public.tournaments (id, name, year)
values ('1c0f6a2b-8d34-4c19-a0b7-9e5d4c3b2a11', 'Stage C1 Audit Rehearsal', 2028);

insert into public.bonus_competitions (id, tournament_id, game_key, published)
values
  ('2a1b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c51', '1c0f6a2b-8d34-4c19-a0b7-9e5d4c3b2a11', 'ko_predictor', true),
  ('2a1b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c52', '1c0f6a2b-8d34-4c19-a0b7-9e5d4c3b2a11', 'last_man_standing', true),
  ('2a1b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c53', '1c0f6a2b-8d34-4c19-a0b7-9e5d4c3b2a11', 'predictor_cup', true);

insert into public.bonus_competition_audit (competition_id, action, detail, actor_id, recorded_at)
select
  c.id,
  e.action,
  e.detail,
  case when e.actor then '4a1d0b7e-2f56-4a24-9d6e-6a1b0c2d3e4f'::uuid end,
  e.recorded_at
from public.bonus_competitions c
cross join (values
  ('competition_published', '{"seeded": "development bootstrap"}'::jsonb, false, timestamptz '2026-07-28 20:19:34.900752+00'),
  ('catalogue_published', '{"registration_open": false}'::jsonb, false, timestamptz '2026-07-29 08:40:34.801945+00'),
  ('entrant_registered', '{"user_id": "4a1d0b7e-2f56-4a24-9d6e-6a1b0c2d3e4f"}'::jsonb, true, timestamptz '2026-07-29 20:40:02.496039+00')
) as e(action, detail, actor, recorded_at)
where c.tournament_id = '1c0f6a2b-8d34-4c19-a0b7-9e5d4c3b2a11';
`

/**
 * Every column of every audit row, captured before the migration runs. The
 * comparison below is against this snapshot rather than against re-derived
 * expectations, so a backfill that rewrote history would have nothing to hide
 * behind.
 */
const CAPTURE_BEFORE = `
create temp table stage_c1_audit_before as
select id, competition_id, action, detail, actor_id, recorded_at
from public.bonus_competition_audit;

create temp table stage_c1_probe (name text primary key, value jsonb);
`

const EMIT_PROBE = `select coalesce(jsonb_object_agg(name, value), '{}'::jsonb) from stage_c1_probe;`

/** Audit-table state that must survive the transition untouched. */
const CONTENT_PROBES = `
insert into stage_c1_probe (name, value)
select 'row_count_before', to_jsonb(count(*)) from stage_c1_audit_before;

insert into stage_c1_probe (name, value)
select 'row_count_after', to_jsonb(count(*)) from public.bonus_competition_audit;

-- A full outer join on the primary key: a deleted row, a duplicated row and a
-- rewritten action/detail/actor/timestamp each land in exactly one of these.
insert into stage_c1_probe (name, value)
select 'rows_missing_after', to_jsonb(count(*))
from stage_c1_audit_before b
left join public.bonus_competition_audit a on a.id = b.id
where a.id is null;

insert into stage_c1_probe (name, value)
select 'rows_added_after', to_jsonb(count(*))
from public.bonus_competition_audit a
left join stage_c1_audit_before b on b.id = a.id
where b.id is null;

insert into stage_c1_probe (name, value)
select 'rows_with_changed_history', to_jsonb(count(*))
from public.bonus_competition_audit a
join stage_c1_audit_before b on b.id = a.id
where a.competition_id is distinct from b.competition_id
   or a.action is distinct from b.action
   or a.detail is distinct from b.detail
   or a.actor_id is distinct from b.actor_id
   or a.recorded_at is distinct from b.recorded_at;
`

/** Scope, constraint and trigger state Stage C1 is required to reach. */
const SCHEMA_PROBES = `
insert into stage_c1_probe (name, value)
select 'rows_without_scope', to_jsonb(count(*))
from public.bonus_competition_audit
where tournament_id is null;

insert into stage_c1_probe (name, value)
select 'rows_scoped_to_parent', to_jsonb(count(*))
from public.bonus_competition_audit a
join public.bonus_competitions c on c.id = a.competition_id
where a.tournament_id = c.tournament_id;

insert into stage_c1_probe (name, value)
select 'audit_scope_not_null', to_jsonb(bool_or(attnotnull))
from pg_catalog.pg_attribute
where attrelid = 'public.bonus_competition_audit'::regclass
  and attname = 'tournament_id'
  and not attisdropped;

insert into stage_c1_probe (name, value)
select 'season_scope_fkey_validated', to_jsonb(bool_or(convalidated))
from pg_catalog.pg_constraint
where conrelid = 'public.bonus_competition_audit'::regclass
  and conname = 'bonus_audit_tournament_competition_fkey';

insert into stage_c1_probe (name, value)
select 'immutability_trigger_state', to_jsonb(max(tgenabled::text))
from pg_catalog.pg_trigger
where tgrelid = 'public.bonus_competition_audit'::regclass
  and tgname = 'block_bonus_audit_mutation'
  and not tgisinternal;

-- Nothing else may be left suspended: a broadened \`disable trigger\` would show
-- up here even if the audit trigger itself came back enabled.
insert into stage_c1_probe (name, value)
select 'disabled_triggers_anywhere', coalesce(jsonb_agg(tgname order by tgname), '[]'::jsonb)
from pg_catalog.pg_trigger
where not tgisinternal
  and tgenabled = 'D';
`

/**
 * Destructive probes. plpgsql's exception block is an implicit subtransaction, so
 * a blocked UPDATE or DELETE is captured as a SQLSTATE and rolled back without
 * poisoning the surrounding transaction.
 */
const IMMUTABILITY_PROBES = `
do $stage_c1_immutability$
declare
  v_update text;
  v_delete text;
begin
  begin
    update public.bonus_competition_audit set action = 'tampered';
    v_update := 'no-error';
  exception when others then
    v_update := sqlstate;
  end;

  begin
    delete from public.bonus_competition_audit;
    v_delete := 'no-error';
  exception when others then
    v_delete := sqlstate;
  end;

  insert into stage_c1_probe (name, value)
  values ('update_sqlstate', to_jsonb(v_update)), ('delete_sqlstate', to_jsonb(v_delete));
end
$stage_c1_immutability$;
`

/** Pre-migration state, re-read after a rollback to prove it was restored. */
const PRE_MIGRATION_PROBES = `
insert into stage_c1_probe (name, value)
select 'audit_scope_column_exists', to_jsonb(count(*) > 0)
from pg_catalog.pg_attribute
where attrelid = 'public.bonus_competition_audit'::regclass
  and attname = 'tournament_id'
  and not attisdropped;

insert into stage_c1_probe (name, value)
select 'immutability_trigger_state', to_jsonb(max(tgenabled::text))
from pg_catalog.pg_trigger
where tgrelid = 'public.bonus_competition_audit'::regclass
  and tgname = 'block_bonus_audit_mutation'
  and not tgisinternal;
`

/**
 * The contract-64 state the rehearsal depends on. Run before anything else: if
 * the database were already at contract 65, every case below would pass while
 * proving nothing about the transition.
 */
export function contractSixtyFourPrecondition(): string {
  return `\\set ON_ERROR_STOP on
select jsonb_build_object(
  'audit_scope_column_exists', exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.bonus_competition_audit'::regclass
      and attname = 'tournament_id'
      and not attisdropped
  ),
  'latest_migration', (
    select max(version) from supabase_migrations.schema_migrations
  ),
  'immutability_trigger_state', (
    select max(tgenabled::text) from pg_catalog.pg_trigger
    where tgrelid = 'public.bonus_competition_audit'::regclass
      and tgname = 'block_bonus_audit_mutation'
      and not tgisinternal
  )
);`
}

/** Nine populated audit rows crossing 64 → 65, then probed and rolled back. */
export function populatedTransition(migration: string): string {
  return `\\set ON_ERROR_STOP on
begin;
${FIXTURE}
${CAPTURE_BEFORE}
${migration}
${CONTENT_PROBES}
${SCHEMA_PROBES}
${IMMUTABILITY_PROBES}
${EMIT_PROBE}
rollback;`
}

/**
 * The empty-table rebuild the disposable pipeline already exercises, kept as an
 * explicit case so the fix cannot regress it while chasing the populated one.
 */
export function emptyTransition(migration: string): string {
  return `\\set ON_ERROR_STOP on
begin;
${CAPTURE_BEFORE}
${migration}
${CONTENT_PROBES}
${SCHEMA_PROBES}
${EMIT_PROBE}
rollback;`
}

/**
 * A failure after the backfill must leave the trigger and schema as they were.
 * `ON_ERROR_STOP` is lifted only across the induced failure so the aborted
 * subtransaction can be rolled back and the restored state read back.
 */
export function rollbackRestoresPreMigrationState(migration: string): string {
  return `\\set ON_ERROR_STOP on
begin;
${FIXTURE}
${CAPTURE_BEFORE}
savepoint before_stage_c1;
${migration}
\\set ON_ERROR_STOP off
do $stage_c1_induced$ begin
  raise exception 'induced Stage C1 failure after the audit scope backfill';
end $stage_c1_induced$;
\\set ON_ERROR_STOP on
rollback to savepoint before_stage_c1;
${CONTENT_PROBES}
${PRE_MIGRATION_PROBES}
${IMMUTABILITY_PROBES}
${EMIT_PROBE}
rollback;`
}
