import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * What deleting an account does to settled competition history.
 *
 * Every competition table keys its owner on `auth.users (id)` directly, so the
 * `on delete` action on each of those references *is* the account-deletion
 * design — there is no deletion RPC, no anonymisation step and no application
 * flow between the request and the cascade. Nothing tested that design, in
 * either this suite or pgTAP, so the actions were free to disagree with each
 * other as tables were added.
 *
 * They now do disagree, in three ways worth keeping visible:
 *
 *   - most references cascade, so removing one account destroys that player's
 *     entry, every row hanging off it, and their rank-history snapshots — a
 *     settled table silently changes and other players' preserved ranks stop
 *     agreeing with a recomputation;
 *   - `leagues.owner_id` restricts instead, which *blocks* deletion until owned
 *     leagues are handed over. That one is deliberate and documented in
 *     `20260720120000_league_fk_semantics.sql`, which states the hand-over the
 *     future deletion flow must perform;
 *   - `bonus_cup_fixtures.winner_user_id` declares no action at all, so it takes
 *     PostgreSQL's `no action` default and blocks deletion too — undeclared and
 *     undocumented, unlike every other reference in these migrations.
 *
 * The Stage C design decides this differently (anonymise the competition record,
 * erase the identity record, by repointing these keys at `profiles (id)`). These
 * tests are the before-side of that change: they assert what the schema does
 * today so the repoint has to arrive as a visible edit here, and so a *new*
 * reference to `auth.users` cannot join the set without a declared action.
 *
 * Text-based over the committed migrations, so it needs no database.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

type AuthUserReference = {
  migration: string
  table: string
  column: string
  /** The declared action, or `undeclared` when the clause is absent. */
  action: 'cascade' | 'restrict' | 'set null' | 'undeclared'
}

/**
 * Every `references auth.users` site in migration order, with the table it sits
 * in and the action it declares. Inline column definitions and separate
 * `add constraint` statements are both read, because the league FKs use one of
 * each.
 */
function collectAuthUserReferences(): AuthUserReference[] {
  const found: AuthUserReference[] = []

  for (const migration of readdirSync(migrationsDirectory).sort()) {
    if (!migration.endsWith('.sql')) continue
    const lines = readFileSync(resolve(migrationsDirectory, migration), 'utf8').split('\n')

    lines.forEach((line, index) => {
      if (!/references\s+auth\.users/i.test(line)) return

      let table = 'unknown'
      for (let cursor = index; cursor >= 0; cursor -= 1) {
        const match =
          lines[cursor].match(/create table (?:if not exists )?(?:public\.)?([a-z_]+)/i) ??
          lines[cursor].match(/alter table (?:public\.)?([a-z_]+)/i)
        if (match) {
          table = match[1]
          break
        }
      }

      const column =
        (line.match(/^\s*(?:add column\s+)?([a-z_]+)\s+uuid/i) ??
          line.match(/foreign key \(([a-z_]+)\)/i))?.[1] ?? 'unknown'

      const declared = line.match(/on delete (cascade|restrict|set null)/i)?.[1].toLowerCase()

      found.push({
        migration,
        table,
        column,
        action: (declared as AuthUserReference['action']) ?? 'undeclared',
      })
    })
  }

  return found
}

const references = collectAuthUserReferences()

/**
 * The action actually in force per `table.column`: migrations apply in filename
 * order and a later `add constraint` replaces an earlier inline definition, so
 * the last declaration wins.
 *
 * Classifying on the raw list instead would report `leagues.owner_id` as a
 * cascade — its original inline action — when the effective action has been
 * `restrict` since `league_fk_semantics.sql`, i.e. it would name a
 * deletion-blocking reference as a history-destroying one.
 */
const effectiveActions = new Map<string, AuthUserReference['action']>()
for (const reference of references) {
  effectiveActions.set(`${reference.table}.${reference.column}`, reference.action)
}

function sitesOf(action: AuthUserReference['action']): string[] {
  return [...effectiveActions]
    .filter(([, effective]) => effective === action)
    .map(([site]) => site)
    .sort()
}

describe('account deletion — declared foreign-key semantics', () => {
  it('pins every reference to auth.users', () => {
    // A new competition table keyed on auth.users is a new thing that either
    // vanishes or blocks when an account is deleted. It should not be possible
    // to add one without this list changing.
    expect(
      references.map(
        (reference) => `${reference.migration} ${reference.table}.${reference.column} → ${reference.action}`,
      ),
    ).toEqual([
      '20260719120000_init_v0_1.sql profiles.id → cascade',
      '20260719120000_init_v0_1.sql entries.user_id → cascade',
      // Both superseded below by 20260720120000_league_fk_semantics.sql.
      '20260719180000_add_leagues.sql leagues.owner_id → cascade',
      '20260719180000_add_leagues.sql league_members.user_id → cascade',
      '20260720120000_league_fk_semantics.sql league_members.user_id → cascade',
      '20260720120000_league_fk_semantics.sql leagues.owner_id → restrict',
      '20260720180000_add_rank_history.sql rank_history.user_id → cascade',
      '20260720210000_rate_limits.sql rate_limit_events.user_id → cascade',
      '20260723183000_knockout_result_lifecycle.sql match_result_revisions.actor_id → set null',
      '20260727163339_actual_third_place_resolution.sql actual_third_place_resolutions.updated_by → set null',
      '20260727163339_actual_third_place_resolution.sql actual_third_place_resolution_revisions.actor_id → set null',
      '20260728150000_bonus_games_platform.sql bonus_competition_entrants.user_id → cascade',
      '20260728150000_bonus_games_platform.sql bonus_competition_audit.actor_id → set null',
      '20260728190000_shared_knockout_prediction_store.sql bonus_knockout_predictions.user_id → cascade',
      '20260729050000_predictor_cup_knockouts.sql bonus_cup_fixtures.winner_user_id → undeclared',
    ])
  })

  it('resolves the league references to the later migration', () => {
    // `add_leagues.sql` used `create table if not exists`, so its inline actions
    // may never have applied. `league_fk_semantics.sql` drops and re-adds both
    // explicitly, which is what makes the later pair the effective one — assert
    // the drop-then-add rather than trusting file order alone.
    const semantics = readFileSync(
      resolve(migrationsDirectory, '20260720120000_league_fk_semantics.sql'),
      'utf8',
    )

    for (const constraint of ['league_members_user_id_fkey', 'leagues_owner_id_fkey']) {
      expect(semantics).toContain(`drop constraint if exists ${constraint}`)
      expect(semantics).toContain(`add constraint ${constraint}`)
    }
  })

  it('records exactly one reference with no declared action', () => {
    // PostgreSQL defaults an omitted clause to `no action`, which blocks the
    // delete. Every other reference in these migrations states its action, so
    // this is the one place the deletion behaviour is implied rather than
    // chosen. Pinned, not fixed: changing it is a migration, and a migration
    // needs the applied-state and pgTAP evidence this environment cannot
    // currently produce.
    expect(sitesOf('undeclared')).toEqual(['bonus_cup_fixtures.winner_user_id'])
  })
})

describe('account deletion — consequences', () => {
  it('names the references that block deletion outright', () => {
    // Deleting an account is not currently a thing that simply succeeds. Only
    // the first of these has a documented hand-over flow.
    expect([...sitesOf('restrict'), ...sitesOf('undeclared')]).toEqual([
      'leagues.owner_id',
      'bonus_cup_fixtures.winner_user_id',
    ])
  })

  it('keeps the documented rationale attached to the restricting reference', () => {
    const semantics = readFileSync(
      resolve(migrationsDirectory, '20260720120000_league_fk_semantics.sql'),
      'utf8',
    )

    // The restrict is only safe because the required flow is written down. If
    // the rationale is deleted, the constraint reads as an obstruction and the
    // next person removes it.
    expect(semantics).toMatch(/leagues are never orphaned/i)
    expect(semantics).toMatch(/account-deletion flow MUST hand owned/i)
  })

  it('names the references that silently destroy settled history', () => {
    // The §5b subject. `profiles.id` and `rate_limit_events.user_id` are the two
    // that *should* go — identity and housekeeping. The rest are competition
    // record.
    expect(sitesOf('cascade')).toEqual([
      'bonus_competition_entrants.user_id',
      'bonus_knockout_predictions.user_id',
      'entries.user_id',
      'league_members.user_id',
      'profiles.id',
      'rank_history.user_id',
      'rate_limit_events.user_id',
    ])
  })

  it('keeps audit trails attributable-or-null rather than deleted', () => {
    // Result revisions and the bonus audit log survive the actor's deletion with
    // a null actor. That is the shape the competition tables do not have.
    expect(sitesOf('set null')).toEqual([
      'actual_third_place_resolution_revisions.actor_id',
      'actual_third_place_resolutions.updated_by',
      'bonus_competition_audit.actor_id',
      'match_result_revisions.actor_id',
    ])
  })

  it('carries the entry cascade into every dependent competition table', () => {
    // `entries.user_id` cascading is not one row. Each of these hangs off
    // `entries (id)` with its own cascade, so one account deletion removes the
    // predictions and score events behind a settled table.
    const dependants = new Set<string>()
    for (const migration of readdirSync(migrationsDirectory).sort()) {
      if (!migration.endsWith('.sql')) continue
      const source = readFileSync(resolve(migrationsDirectory, migration), 'utf8')
      const lines = source.split('\n')
      lines.forEach((line, index) => {
        if (!/references\s+(?:public\.)?entries\s*\(/i.test(line)) return
        if (!/on delete cascade/i.test(line)) return
        for (let cursor = index; cursor >= 0; cursor -= 1) {
          const match = lines[cursor].match(/create table (?:if not exists )?(?:public\.)?([a-z_]+)/i)
          if (match) {
            dependants.add(match[1])
            break
          }
        }
      })
    }

    expect(dependants.size).toBeGreaterThanOrEqual(7)
  })

  it('leaves profiles with no dependants of its own', () => {
    // What makes the Stage C repoint cheap: `profiles.id` already holds the auth
    // user id, and nothing keys on `profiles`, so moving the competition keys
    // there is a constraint swap with no data movement. If something starts
    // referencing `profiles`, that assessment needs redoing.
    const referencesProfiles = readdirSync(migrationsDirectory)
      .filter((migration) => migration.endsWith('.sql'))
      .filter((migration) =>
        /references\s+(?:public\.)?profiles\s*\(/i.test(
          readFileSync(resolve(migrationsDirectory, migration), 'utf8'),
        ),
      )

    expect(referencesProfiles).toEqual([])
  })
})
