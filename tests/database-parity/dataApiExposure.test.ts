import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * What the browser roles can reach directly, without going through an RPC.
 *
 * `schemaSecurityInvariants.test.ts` asserts every `public` table has RLS. That
 * is the right guard for tables and it does not reach views: **a view carries no
 * row-level security**. For a view, the grant is the whole of the protection.
 *
 * There is one view — `entry_totals`, every entry's summed score — and its
 * migration says why it is revoked: "keep it off the client roles so it can't be
 * used to read totals outside the leaderboard path." That leaderboard path is
 * deliberately bounded and paginated, with a validated cursor and an operating
 * cap. Reading the view directly would bypass all of it and return every
 * player's total in one request.
 *
 * So the revoke is not tidiness — it is the only thing standing between a
 * `select` and the whole scoreboard. Nothing checked it, and nothing would have
 * noticed a second view arriving without one.
 *
 * Text-based over the committed migrations, so it needs no database.
 */

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

/** Views created anywhere in the migration set. */
function createdViews(): string[] {
  const views = new Set<string>()
  for (const { sql } of sources) {
    const pattern = /create (?:or replace )?(?:materialized )?view\s+(?:public\.)?([a-z_0-9]+)/gi
    for (const match of sql.matchAll(pattern)) views.add(match[1])
  }
  return [...views].sort()
}

/** Relation grants to a browser role, as `relation:privileges`. */
function browserRelationGrants(): string[] {
  const grants: string[] = []
  const pattern =
    /grant\s+([a-z, ]+?)\s+on\s+(?:table\s+|view\s+)?(?:public\.)?([a-z_0-9]+)\s+to\s+([^;]+);/gi
  for (const match of allSql.matchAll(pattern)) {
    const privileges = match[1].trim()
    const relation = match[2]
    const roles = match[3]
    if (!/\b(anon|authenticated)\b/.test(roles)) continue
    // `grant execute on function …` is a different surface, guarded by
    // supabase/tests/080_function_privileges.sql and rpcAllowlistParity.
    if (/\bexecute\b/.test(privileges)) continue
    grants.push(`${relation}:${privileges}`)
  }
  return grants.sort()
}

const views = createdViews()

describe('views are not reachable by browser roles', () => {
  it('finds the views at all', () => {
    // Without this, a changed `create view` idiom would empty the list and make
    // the revoke assertion below pass while checking nothing.
    expect(views).toEqual(['entry_totals'])
  })

  it('revokes every view from anon and authenticated', () => {
    // A view has no RLS, so an ungranted-but-not-revoked view is exposed by
    // Supabase's default privileges on `public` with nothing in the way.
    const unrevoked = views.filter((view) => {
      const revoke = new RegExp(
        `revoke\\s+all\\s+on\\s+(?:table\\s+|view\\s+)?(?:public\\.)?${view}\\s+from\\s+([^;]+);`,
        'i',
      )
      const match = revoke.exec(allSql)
      if (!match) return true
      const roles = match[1]
      return !/\banon\b/.test(roles) || !/\bauthenticated\b/.test(roles)
    })

    expect(unrevoked).toEqual([])
  })

  it('keeps the reason for the entry_totals revoke attached to it', () => {
    const scoring = sources.find(
      (source) => source.migration === '20260720130000_add_scoring.sql',
    )?.sql

    // Without the rationale the revoke reads as an obstruction, and the next
    // person to want a totals read removes it instead of using the bounded
    // leaderboard RPC.
    expect(scoring).toMatch(/outside the leaderboard path/i)
  })
})

describe('direct table access granted to browser roles', () => {
  it('grants exactly the pinned relations', () => {
    // Everything else the browser reads goes through a security-definer RPC,
    // which is what lets those RPCs bound, paginate and cap what they return.
    // A new entry here is a new surface that skips that.
    expect(browserRelationGrants()).toEqual([
      'entries:select, insert',
      'match_predictions:select, insert, update',
      'predicted_group_positions:select',
      'predicted_progression:select',
    ])
  })

  it('grants anon no relation at all', () => {
    // Anonymous visitors have exactly one capability, the capacity read, and it
    // is a function. Any relation reachable before sign-in is a pre-auth data
    // exposure.
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
