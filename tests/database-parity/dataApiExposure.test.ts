import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/** What browser roles can reach directly without a bounded RPC. */
const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

function migrationSources(): { migration: string; sql: string }[] {
  return readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((migration) => ({
      migration,
      sql: readFileSync(resolve(migrationsDirectory, migration), 'utf8'),
    }))
}

const sources = migrationSources()
const allSql = sources.map((source) => source.sql).join('\n')

/** Migration text with `--` comments removed, so prose cannot satisfy a check. */
const allStatements = allSql
  .split('\n')
  .map((line) => line.replace(/--.*$/, ''))
  .join('\n')

/**
 * Every view a migration creates, as `schema.name`.
 *
 * The schema is now CAPTURED rather than optionally skipped. The previous
 * pattern was `(?:public\.)?([a-z_0-9]+)`, which on `create or replace view
 * ai.valid_predictions` matched the schema and captured `ai` — so contract
 * 188's view arrived in this list as a relation called "ai", and the revoke
 * check then looked for `revoke all on ai`, which does not exist and never
 * would. The guard would have reported a view unrevoked for as long as any
 * non-public view existed, which is the shape of false alarm that gets a guard
 * disabled rather than read.
 */
function createdViews(): string[] {
  const views = new Set<string>()
  for (const { sql } of sources) {
    const pattern =
      /create (?:or replace )?(?:materialized )?view\s+(?:([a-z_0-9]+)\.)?([a-z_0-9]+)/gi
    for (const match of sql.matchAll(pattern)) views.add(`${match[1] ?? 'public'}.${match[2]}`)
  }
  return [...views].sort()
}

function browserRelationGrants(): string[] {
  const grants: string[] = []
  const pattern =
    /grant\s+([a-z, ]+?)\s+on\s+(?:table\s+|view\s+)?(?:public\.)?([a-z_0-9]+)\s+to\s+([^;]+);/gi
  for (const match of allSql.matchAll(pattern)) {
    const privileges = at(match, 1).trim()
    const relation = match[2]
    const roles = match[3]
    if (roles === undefined) continue
    if (!/\b(anon|authenticated)\b/.test(roles)) continue
    if (/\bexecute\b/.test(privileges)) continue
    grants.push(`${relation}:${privileges}`)
  }
  return grants.sort()
}

const views = createdViews()

describe('views are not reachable by browser roles', () => {
  it('finds the views at all', () => {
    expect(views).toEqual([
      // Contract 199's audit trail for which repeated advice counts as evidence.
      'ai.bet_advice_identity',
      // Contract 201's two fixture-first reductions, behind the same boundary.
      'ai.canonical_fixture_predictions',
      'ai.current_fixture_recommendations',
      // Contract 204's custody for withdrawn forecasts. `ai.valid_predictions`
      // is what still counts and deliberately excludes these, so a read that
      // needs to COUNT the exclusions cannot go through it; it goes through
      // here instead of joining ai.predictions, which
      // 236_quarantined_evidence_reads.sql forbids admin reads from doing.
      'ai.quarantined_predictions',
      'ai.valid_bets',
      'ai.valid_predictions',
      'public.entry_totals',
    ])
  })

  it('revokes every view from anon and authenticated', () => {
    const unrevoked = views.filter((qualified) => {
      const [schema, view] = qualified.split('.')
      // A whole-schema revoke covers a view: `all tables in schema` includes
      // views in PostgreSQL, and schema `ai` is revoked that way after every
      // object it adds. Contract 188's `ai.valid_predictions` is reachable
      // only through the two competition-admin definer RPCs above it.
      if (schema !== 'public') {
        const schemaRevoke = new RegExp(
          `revoke\\s+all\\s+on\\s+all\\s+tables\\s+in\\s+schema\\s+${schema}\\s+from\\s+([^;]+);`,
          'i',
        )
        const match = schemaRevoke.exec(allSql)
        if (!match) return true
        return !/\banon\b/.test(at(match, 1)) || !/\bauthenticated\b/.test(at(match, 1))
      }
      const revoke = new RegExp(
        `revoke\\s+all\\s+on\\s+(?:table\\s+|view\\s+)?(?:public\\.)?${view}\\s+from\\s+([^;]+);`,
        'i',
      )
      const match = revoke.exec(allSql)
      if (!match) return true
      const roles = match[1]
      if (roles === undefined) return true
      return !/\banon\b/.test(roles) || !/\bauthenticated\b/.test(roles)
    })

    expect(unrevoked).toEqual([])
  })

  it('keeps the reason for the entry_totals revoke attached to it', () => {
    const scoring = sources.find(
      (source) => source.migration === '20260720130000_add_scoring.sql',
    )?.sql
    expect(scoring).toMatch(/outside the leaderboard path/i)
  })
})

describe('direct table access granted to browser roles', () => {
  it('grants exactly the pinned relations', () => {
    expect(browserRelationGrants()).toEqual([
      'entries:select, insert',
      'game_memberships:select',
      'match_predictions:select, insert, update',
      'predicted_group_positions:select',
      'predicted_progression:select',
    ])
  })

  it('grants anon no relation at all', () => {
    const anonGrants = browserRelationGrants().filter((grant) => {
      const pattern = new RegExp(
        `grant\\s+[a-z, ]+\\s+on\\s+(?:table\\s+|view\\s+)?(?:public\\.)?${grant.split(':')[0]}\\s+to\\s+([^;]+);`,
        'i',
      )
      return /\banon\b/.test(pattern.exec(allSql)?.[1] ?? '')
    })

    expect(anonGrants).toEqual([])
  })
})

/**
 * Tables in `public` that browser roles can still reach, and the ones they cannot.
 *
 * The two suites above read `grant` statements, which is only half the picture:
 * Supabase's default privileges in `public` hand every ordinary privilege on a
 * newly created table to `anon` and `authenticated` without any migration
 * writing a `grant`. So a table is reachable unless a migration takes it away,
 * and the guards that pinned explicit grants could not see that.
 *
 * `DB-005` is what that blind spot cost. `20260720210000_rate_limits.sql`
 * created `rate_limit_events` under the comment "No client access at all", and
 * both browser roles held `select`, `insert`, `update`, `delete`, `truncate`,
 * `references` and `trigger` on it for three weeks, denied only by a policy-less
 * row-level security — one control where the design intended two. Contract 134
 * revoked it, which is why it is not in the list below.
 *
 * The list is therefore the point of this suite. Every table on it is reachable
 * by a signed-in browser role and protected by row-level security alone: the
 * original Euro tournament schema, which the application reads directly. A new
 * table joins it only by a deliberate edit here, in the same change that decides
 * a browser may read it — not by nobody remembering to revoke.
 *
 * What it cannot check, stated so the coverage is not overread: whether the RLS
 * policies on those tables are *correct*. `schemaSecurityInvariants.test.ts`
 * proves every one of them has RLS enabled; the policy bodies are the subject of
 * the pgTAP suite, not of a text scan.
 */
const RLS_ONLY_TABLES = [
  'bonus_predictions',
  'entries',
  'group_teams',
  'groups',
  'league_members',
  'leagues',
  'match_predictions',
  'matches',
  'players',
  'predicted_group_positions',
  'predicted_progression',
  'predicted_tie_resolutions',
  'profiles',
  'score_events',
  'teams',
  'tournaments',
] as const

function createdPublicTables(): string[] {
  const tables = new Set<string>()
  const pattern = /create table\s+(?:if not exists\s+)?(?:([a-z_0-9]+)\.)?([a-z_0-9]+)/gi
  for (const match of allStatements.matchAll(pattern)) {
    if ((match[1] ?? 'public') !== 'public') continue
    tables.add(at(match, 2))
  }
  return [...tables].sort()
}

/** Tables a migration revokes from BOTH browser roles. One of the two is not enough. */
function tablesRevokedFromBrowserRoles(): Set<string> {
  const revoked = new Set<string>()
  const pattern =
    /revoke\s+all[a-z ]*\s+on\s+(?:table\s+)?(?:public\.)?([a-z_0-9]+)\s+from\s+([^;]+);/gi
  for (const match of allStatements.matchAll(pattern)) {
    const roles = match[2]
    if (roles === undefined) continue
    if (!/\banon\b/.test(roles) || !/\bauthenticated\b/.test(roles)) continue
    revoked.add(at(match, 1))
  }
  return revoked
}

describe('every public table is either revoked from browser roles or pinned as RLS-only', () => {
  it('finds the public tables at all', () => {
    // Without this, a changed `create table` shape would empty the comparison
    // and make the assertion below pass while proving nothing.
    expect(createdPublicTables().length).toBeGreaterThan(40)
  })

  it('leaves exactly the pinned RLS-only tables reachable', () => {
    const revoked = tablesRevokedFromBrowserRoles()
    const reachable = createdPublicTables().filter((table) => !revoked.has(table))

    expect(reachable).toEqual([...RLS_ONLY_TABLES])
  })

  it('does not pin a table that is in fact revoked', () => {
    // The reverse drift: a table revoked later but left on the list, which would
    // quietly widen the allowance the list is supposed to bound.
    const revoked = tablesRevokedFromBrowserRoles()

    expect(RLS_ONLY_TABLES.filter((table) => revoked.has(table))).toEqual([])
  })

  it('keeps the rate-limit log revoked from both browser roles', () => {
    // The `DB-005` regression itself, named rather than left implicit in the list
    // above: this table's own migration says browser roles have no access, and
    // for three weeks they had all of it.
    const revoked = tablesRevokedFromBrowserRoles()

    expect(revoked.has('rate_limit_events')).toBe(true)
  })
})
