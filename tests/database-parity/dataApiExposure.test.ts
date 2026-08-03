import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

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

function createdViews(): string[] {
  const views = new Set<string>()
  for (const { sql } of sources) {
    const pattern = /create (?:or replace )?(?:materialized )?view\s+(?:public\.)?([a-z_0-9]+)/gi
    for (const match of sql.matchAll(pattern)) views.add(match[1])
  }
  return [...views].sort()
}

function browserRelationGrants(): string[] {
  const grants: string[] = []
  const pattern =
    /grant\s+([a-z, ]+?)\s+on\s+(?:table\s+|view\s+)?(?:public\.)?([a-z_0-9]+)\s+to\s+([^;]+);/gi
  for (const match of allSql.matchAll(pattern)) {
    const privileges = match[1].trim()
    const relation = match[2]
    const roles = match[3]
    if (!/\b(anon|authenticated)\b/.test(roles)) continue
    if (/\bexecute\b/.test(privileges)) continue
    grants.push(`${relation}:${privileges}`)
  }
  return grants.sort()
}

const views = createdViews()

describe('views are not reachable by browser roles', () => {
  it('finds the views at all', () => {
    expect(views).toEqual(['entry_totals'])
  })

  it('revokes every view from anon and authenticated', () => {
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
