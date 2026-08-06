import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Stage C1 may generalise competition-season scope, locks and timezone authority,
 * but it must leave the complete C2 starting point untouched.
 *
 * This guard deliberately permits additional season predicates in an existing
 * ownership policy. It freezes the ownership anchor itself: the policy set,
 * direct `auth.uid()` comparison and current auth-owned foreign-key matrix.
 * Profile ownership, `profiles.auth_user_id`, deletion functions and related RLS
 * remain owned by issue #272.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

function migrationFiles(): string[] {
  return readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
}

function sourceOf(migration: string): string {
  return readFileSync(resolve(migrationsDirectory, migration), 'utf8')
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

type DeleteAction = 'cascade' | 'restrict' | 'set null' | 'undeclared'
type AuthReference = {
  action: DeleteAction
  column: string
  table: string
}

function authUserReferences(): AuthReference[] {
  const found: AuthReference[] = []

  for (const migration of migrationFiles()) {
    const lines = stripComments(sourceOf(migration)).split('\n')

    lines.forEach((line, index) => {
      if (!/references\s+auth\.users/i.test(line)) return

      let table = 'unknown'
      for (let cursor = index; cursor >= 0; cursor -= 1) {
        const match =
          // Any schema, not only `public`. Contract 125 creates
          // `predictor_internal.season_fixture_result_revisions`, and a
          // `public.`-only prefix made the parser read the SCHEMA as the table
          // name and pin the column as `predictor_internal.actor_id`.
          lines[cursor].match(/create table (?:if not exists )?(?:[a-z_]+\.)?([a-z_]+)/i) ??
          lines[cursor].match(/alter table (?:[a-z_]+\.)?([a-z_]+)/i)
        if (match) {
          table = match[1].toLowerCase()
          break
        }
      }

      const column =
        (line.match(/^\s*(?:add column\s+)?([a-z_]+)\s+uuid/i) ??
          line.match(/foreign key \(([a-z_]+)\)/i))?.[1]?.toLowerCase() ?? 'unknown'
      const declared = line.match(/on delete (cascade|restrict|set null)/i)?.[1].toLowerCase()

      found.push({
        table,
        column,
        action: (declared as DeleteAction) ?? 'undeclared',
      })
    })
  }

  return found
}

function effectiveAuthUserReferences(): string[] {
  const effective = new Map<string, DeleteAction>()
  for (const reference of authUserReferences()) {
    effective.set(`${reference.table}.${reference.column}`, reference.action)
  }

  return [...effective]
    .map(([site, action]) => `${site} -> ${action}`)
    .sort()
}

const EXPECTED_AUTH_USER_REFERENCES = [
  'actual_third_place_resolution_revisions.actor_id -> set null',
  'actual_third_place_resolutions.updated_by -> set null',
  'bonus_competition_audit.actor_id -> set null',
  'bonus_competition_entrants.user_id -> cascade',
  'bonus_cup_fixtures.winner_user_id -> restrict',
  'bonus_knockout_predictions.user_id -> cascade',
  'entries.user_id -> cascade',
  'game_membership_events.actor_id -> set null',
  'game_memberships.user_id -> cascade',
  'league_members.user_id -> cascade',
  'leagues.owner_id -> restrict',
  'match_result_revisions.actor_id -> set null',
  // Contract 125, the season counterpart of the row above it.
  'season_fixture_result_revisions.actor_id -> set null',
  'profiles.id -> cascade',
  'rank_history.user_id -> cascade',
  'rate_limit_events.user_id -> cascade',
].sort()

type PolicyDefinition = {
  command: string
  name: string
  normalized: string
  table: string
}
type PolicyEvent =
  | { action: 'drop'; key: string }
  | { action: 'set'; key: string; policy: PolicyDefinition }

function normalizeSql(source: string): string {
  return source
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),=])\s*/g, '$1')
    .trim()
}

function policyEvents(source: string): PolicyEvent[] {
  const events: PolicyEvent[] = []

  for (const statement of stripComments(source).split(';')) {
    const drop = statement.match(
      /\bdrop\s+policy\s+(?:if\s+exists\s+)?(?:"([^"]+)"|([a-z_][a-z0-9_]*))\s+on\s+(?:public\.)?([a-z_][a-z0-9_]*)/i,
    )
    if (drop) {
      const name = (drop[1] ?? drop[2]).toLowerCase()
      const table = drop[3].toLowerCase()
      events.push({ action: 'drop', key: `${table}.${name}` })
      continue
    }

    const create = statement.match(
      /\bcreate\s+policy\s+(?:"([^"]+)"|([a-z_][a-z0-9_]*))\s+on\s+(?:public\.)?([a-z_][a-z0-9_]*)/i,
    )
    if (!create) continue

    const name = (create[1] ?? create[2]).toLowerCase()
    const table = create[3].toLowerCase()
    const command = statement.match(/\bfor\s+(all|select|insert|update|delete)\b/i)?.[1] ?? 'all'
    const policy: PolicyDefinition = {
      name,
      table,
      command: command.toLowerCase(),
      normalized: normalizeSql(statement),
    }
    events.push({ action: 'set', key: `${table}.${name}`, policy })
  }

  return events
}

function effectivePolicies(): Map<string, PolicyDefinition> {
  const policies = new Map<string, PolicyDefinition>()

  for (const migration of migrationFiles()) {
    for (const event of policyEvents(sourceOf(migration))) {
      if (event.action === 'drop') policies.delete(event.key)
      else policies.set(event.key, event.policy)
    }
  }

  return policies
}

const ownershipPolicies = [...effectivePolicies()]
  .filter(([, policy]) => policy.normalized.includes('auth.uid()'))
  .map(([key, policy]) => ({ key, ...policy }))
  .sort((left, right) => left.key.localeCompare(right.key))

const EXPECTED_OWNERSHIP_POLICIES = [
  'bonus_predictions.own bonus_predictions:all',
  'entries.own entries insert:insert',
  'entries.own entries select:select',
  'game_memberships.own game memberships readable:select',
  'league_members.own memberships readable:select',
  'leagues.member leagues readable:select',
  'match_predictions.own match_predictions insert:insert',
  'match_predictions.own match_predictions select:select',
  'match_predictions.own match_predictions update:update',
  'predicted_group_positions.own predicted_group_positions select:select',
  'predicted_progression.own predicted_progression select:select',
  'predicted_tie_resolutions.own predicted_tie_resolutions:all',
  'profiles.own profile:all',
  'rank_history.own rank_history readable:select',
  'score_events.own score_events readable:select',
].sort()

const OWNERSHIP_ANCHOR_BY_TABLE: Record<string, string> = {
  bonus_predictions: 'e.user_id=(select auth.uid())',
  entries: 'user_id=(select auth.uid())',
  game_memberships: 'user_id=(select auth.uid())',
  league_members: 'user_id=(select auth.uid())',
  leagues: 'm.user_id=(select auth.uid())',
  match_predictions: 'e.user_id=(select auth.uid())',
  predicted_group_positions: 'e.user_id=(select auth.uid())',
  predicted_progression: 'e.user_id=(select auth.uid())',
  predicted_tie_resolutions: 'e.user_id=(select auth.uid())',
  profiles: 'id=(select auth.uid())',
  rank_history: 'user_id=(select auth.uid())',
  score_events: 'e.user_id=(select auth.uid())',
}

function migrationCode(): string {
  return migrationFiles()
    .map((migration) => stripComments(sourceOf(migration)))
    .join('\n')
}

function effectiveFunctionNames(): string[] {
  const names = new Set<string>()
  const pattern = /create (?:or replace )?function\s+(?:[a-z_0-9]+\.)?([a-z_0-9]+)\s*\(/gi
  for (const match of migrationCode().matchAll(pattern)) names.add(match[1].toLowerCase())
  return [...names].sort()
}

describe('Stage C1 non-interference with C2 ownership and deletion', () => {
  it('pins the complete effective auth.users foreign-key matrix', () => {
    expect(effectiveAuthUserReferences()).toEqual(EXPECTED_AUTH_USER_REFERENCES)
  })

  it('keeps competitive ownership off profiles throughout C1', () => {
    const code = migrationCode()
    expect(code).not.toMatch(/references\s+(?:public\.)?profiles\s*\(/i)
    expect(code).not.toMatch(/\bauth_user_id\b/i)
  })

  it('pins the effective ownership-policy set while allowing added season predicates', () => {
    expect(
      ownershipPolicies.map((policy) => `${policy.key}:${policy.command}`).sort(),
    ).toEqual(EXPECTED_OWNERSHIP_POLICIES)
  })

  it('keeps every ownership policy anchored directly on the current auth-owned row', () => {
    for (const policy of ownershipPolicies) {
      expect(policy.normalized, `${policy.key} target role`).toContain('to authenticated')
      expect(policy.normalized, `${policy.key} must not use profiles.auth_user_id`).not.toContain(
        'auth_user_id',
      )
      expect(policy.normalized, `${policy.key} auth ownership anchor`).toContain(
        OWNERSHIP_ANCHOR_BY_TABLE[policy.table],
      )
    }
  })

  it('does not introduce an account-erasure or pseudonymisation function in C1', () => {
    const c2OnlyFunctions = effectiveFunctionNames().filter((name) =>
      /(?:delete|erase|anonym|pseudonym).*(?:account|user)|(?:account|user).*(?:delete|erase|anonym|pseudonym)/i.test(
        name,
      ),
    )
    expect(c2OnlyFunctions).toEqual([])
  })
})