import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Stage C keeps `tournament_id` as the physical competition-season scope name.
 * This guard compares the reviewed compatibility inventory with the effective
 * committed migration history, so a column cannot be added, removed, renamed or
 * made nullable without an intentional inventory update in the same PR.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')
const inventoryPath = resolve(
  repositoryRoot,
  'docs/architecture/stage-c-tournament-id-compatibility.md',
)

type ColumnShape = {
  dataType: string
  nullable: boolean
}

type ColumnEvent =
  | { action: 'remove'; index: number; table: string }
  | { action: 'set'; index: number; shape: ColumnShape; table: string }
  | { action: 'set-nullability'; index: number; nullable: boolean; table: string }
  | { action: 'set-type'; index: number; dataType: string; table: string }

function blankCharacter(character: string): string {
  return character === '\n' ? '\n' : ' '
}

function stripNonCode(source: string): string {
  let output = ''
  let index = 0

  while (index < source.length) {
    if (source.startsWith('--', index)) {
      while (index < source.length && source[index] !== '\n') {
        output += ' '
        index += 1
      }
      continue
    }

    if (source.startsWith('/*', index)) {
      let depth = 1
      output += '  '
      index += 2
      while (index < source.length && depth > 0) {
        if (source.startsWith('/*', index)) {
          depth += 1
          output += '  '
          index += 2
          continue
        }
        if (source.startsWith('*/', index)) {
          depth -= 1
          output += '  '
          index += 2
          continue
        }
        output += blankCharacter(source[index])
        index += 1
      }
      continue
    }

    if (source[index] === "'") {
      output += ' '
      index += 1
      while (index < source.length) {
        if (source[index] === '\\' && index + 1 < source.length) {
          output += ` ${blankCharacter(source[index + 1])}`
          index += 2
          continue
        }
        if (source[index] === "'" && source[index + 1] === "'") {
          output += '  '
          index += 2
          continue
        }
        if (source[index] === "'") {
          output += ' '
          index += 1
          break
        }
        output += blankCharacter(source[index])
        index += 1
      }
      continue
    }

    if (source[index] === '$') {
      const dollarTag = source.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0]
      if (dollarTag) {
        output += ' '.repeat(dollarTag.length)
        index += dollarTag.length
        while (index < source.length && !source.startsWith(dollarTag, index)) {
          output += blankCharacter(source[index])
          index += 1
        }
        if (source.startsWith(dollarTag, index)) {
          output += ' '.repeat(dollarTag.length)
          index += dollarTag.length
        }
        continue
      }
    }

    output += source[index]
    index += 1
  }

  return output
}

function matchingParenthesis(source: string, openingIndex: number): number {
  let depth = 0
  for (let index = openingIndex; index < source.length; index += 1) {
    if (source[index] === '(') depth += 1
    if (source[index] === ')') depth -= 1
    if (depth === 0) return index
  }
  return -1
}

function publicTable(schema: string | undefined, table: string): string | null {
  if (schema && schema.toLowerCase() !== 'public') return null
  return table.toLowerCase()
}

function columnEvents(source: string): ColumnEvent[] {
  const sql = stripNonCode(source)
  const events: ColumnEvent[] = []
  const createPattern = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)\s*\(/gi

  for (const match of sql.matchAll(createPattern)) {
    const table = publicTable(match[1], match[2])
    if (!table) continue
    const openingIndex = match.index + match[0].lastIndexOf('(')
    const closingIndex = matchingParenthesis(sql, openingIndex)
    if (closingIndex < 0) continue
    const body = sql.slice(openingIndex + 1, closingIndex)
    const declaration = body.match(/\btournament_id\s+uuid\b([^,]*)/i)
    if (!declaration) continue
    events.push({
      action: 'set',
      index: match.index,
      shape: { dataType: 'uuid', nullable: !/\bnot\s+null\b/i.test(declaration[1]) },
      table,
    })
  }

  const addPattern = /\balter\s+table\s+(?:if\s+exists\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?tournament_id\s+uuid\b([^;]*)/gi
  for (const match of sql.matchAll(addPattern)) {
    const table = publicTable(match[1], match[2])
    if (!table) continue
    events.push({
      action: 'set',
      index: match.index,
      shape: { dataType: 'uuid', nullable: !/\bnot\s+null\b/i.test(match[3]) },
      table,
    })
  }

  const dropColumnPattern = /\balter\s+table\s+(?:if\s+exists\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)\s+drop\s+column\s+(?:if\s+exists\s+)?tournament_id\b/gi
  for (const match of sql.matchAll(dropColumnPattern)) {
    const table = publicTable(match[1], match[2])
    if (table) events.push({ action: 'remove', index: match.index, table })
  }

  const nullabilityPattern = /\balter\s+table\s+(?:if\s+exists\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)\s+alter\s+column\s+tournament_id\s+(set|drop)\s+not\s+null\b/gi
  for (const match of sql.matchAll(nullabilityPattern)) {
    const table = publicTable(match[1], match[2])
    if (!table) continue
    events.push({
      action: 'set-nullability',
      index: match.index,
      nullable: match[3].toLowerCase() === 'drop',
      table,
    })
  }

  const typePattern = /\balter\s+table\s+(?:if\s+exists\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)\s+alter\s+column\s+tournament_id\s+(?:set\s+data\s+)?type\s+([a-z_][a-z0-9_]*)/gi
  for (const match of sql.matchAll(typePattern)) {
    const table = publicTable(match[1], match[2])
    if (!table) continue
    events.push({
      action: 'set-type',
      dataType: match[3].toLowerCase(),
      index: match.index,
      table,
    })
  }

  const dropTablePattern = /\bdrop\s+table\s+(?:if\s+exists\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)\b/gi
  for (const match of sql.matchAll(dropTablePattern)) {
    const table = publicTable(match[1], match[2])
    if (table) events.push({ action: 'remove', index: match.index, table })
  }

  return events.sort((left, right) => left.index - right.index)
}

function effectiveTournamentIdColumns(): string[] {
  const columns = new Map<string, ColumnShape>()
  for (const migration of readdirSync(migrationsDirectory).sort()) {
    if (!migration.endsWith('.sql')) continue
    const source = readFileSync(resolve(migrationsDirectory, migration), 'utf8')
    for (const event of columnEvents(source)) {
      if (event.action === 'remove') {
        columns.delete(event.table)
      } else if (event.action === 'set') {
        columns.set(event.table, event.shape)
      } else {
        const current = columns.get(event.table)
        if (!current) continue
        columns.set(
          event.table,
          event.action === 'set-nullability'
            ? { ...current, nullable: event.nullable }
            : { ...current, dataType: event.dataType },
        )
      }
    }
  }

  return [...columns]
    .map(([table, shape]) => `${table}.tournament_id ${shape.dataType}${shape.nullable ? '' : ' not null'}`)
    .sort()
}

function inventoryColumns(): string[] {
  const inventory = readFileSync(inventoryPath, 'utf8')
  const section = inventory.split('## Current direct columns')[1]?.split('## Change rules')[0]
  expect(section, 'current tournament_id inventory section').toBeTruthy()
  const columns: string[] = []
  const rowPattern = /^\|\s*`([a-z_][a-z0-9_]*\.tournament_id)`\s*\|/gm
  for (const match of section!.matchAll(rowPattern)) columns.push(`${match[1]} uuid not null`)
  return columns.sort()
}

const effectiveColumns = effectiveTournamentIdColumns()
const reviewedColumns = inventoryColumns()

describe('Stage C tournament_id compatibility inventory after C1b', () => {
  it('keeps the parser positive control at the contract-81 boundary', () => {
    // Raised 38 → 40 by contract 81's two season card-status relations.
    expect(effectiveColumns).toHaveLength(40)
    expect(effectiveColumns).toContain('entries.tournament_id uuid not null')
    expect(effectiveColumns).toContain('game_memberships.tournament_id uuid not null')
    // Contract 68: the season fixture carries the same season scope every other
    // competition-season object does, so a fixture cannot drift between seasons.
    expect(effectiveColumns).toContain('season_fixtures.tournament_id uuid not null')
    expect(effectiveColumns).toContain('season_predictions.tournament_id uuid not null')
    expect(effectiveColumns).toContain('season_matchweek_jokers.tournament_id uuid not null')
    expect(effectiveColumns).toContain('game_membership_events.tournament_id uuid not null')
    expect(effectiveColumns).toContain('matches.tournament_id uuid not null')
    expect(effectiveColumns).toContain('competition_rounds.tournament_id uuid not null')
    expect(effectiveColumns).not.toContain('tournaments.tournament_id uuid not null')
  })

  it('reviews every effective direct tournament_id column exactly once', () => {
    expect(reviewedColumns).toEqual(effectiveColumns)
  })

  it('keeps every current direct tournament_id column non-null UUID', () => {
    expect(effectiveColumns.every((column) => column.endsWith(' uuid not null'))).toBe(true)
  })
})