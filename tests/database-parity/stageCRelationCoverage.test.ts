import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Every effective public relation must have a reviewed Stage C disposition.
 * Contract 65 implemented the four C1 relations. Contract 66 adds the C1b game
 * catalogue and membership lifecycle without authorising any C2 identity move.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')
const coverageManifestPath = resolve(repositoryRoot, 'docs/architecture/stage-c-schema-coverage.md')

type RelationKind = 'table' | 'view'
type RelationEvent = {
  action: 'create' | 'drop'
  index: number
  kind: RelationKind
  name: string
}

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

function relationEvents(source: string): RelationEvent[] {
  const sql = stripNonCode(source)
  const events: RelationEvent[] = []
  const createPattern = /\bcreate\s+(?:or\s+replace\s+)?(?:materialized\s+)?(table|view)\s+(?:if\s+not\s+exists\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)/gi
  const dropPattern = /\bdrop\s+(table|(?:materialized\s+)?view)\s+(?:if\s+exists\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)/gi

  for (const match of sql.matchAll(createPattern)) {
    const schema = match[2]?.toLowerCase()
    if (schema && schema !== 'public') continue
    events.push({
      action: 'create',
      index: match.index,
      kind: match[1].toLowerCase() as RelationKind,
      name: match[3].toLowerCase(),
    })
  }

  for (const match of sql.matchAll(dropPattern)) {
    const schema = match[2]?.toLowerCase()
    if (schema && schema !== 'public') continue
    events.push({
      action: 'drop',
      index: match.index,
      kind: /view/i.test(match[1]) ? 'view' : 'table',
      name: match[3].toLowerCase(),
    })
  }

  return events.sort((left, right) => left.index - right.index)
}

function effectivePublicRelations(): string[] {
  const relations = new Map<string, RelationKind>()
  for (const migration of readdirSync(migrationsDirectory).sort()) {
    if (!migration.endsWith('.sql')) continue
    const source = readFileSync(resolve(migrationsDirectory, migration), 'utf8')
    for (const event of relationEvents(source)) {
      if (event.action === 'drop') relations.delete(event.name)
      else relations.set(event.name, event.kind)
    }
  }
  return [...relations].map(([name, kind]) => `${kind}:${name}`).sort()
}

function manifestRows(section: string, firstColumn: string): string[] {
  const relations: string[] = []
  const rowPattern = new RegExp(`^\\|\\s*\\\`([a-z_][a-z0-9_]*)\\\`(\\s+view)?\\s*\\|`, 'gm')
  for (const match of section.matchAll(rowPattern)) {
    relations.push(`${match[2] ? 'view' : 'table'}:${match[1]}`)
  }
  expect(relations.length, `${firstColumn} manifest rows`).toBeGreaterThan(0)
  return relations
}

const manifest = readFileSync(coverageManifestPath, 'utf8')
const currentSection = manifest.split('## 4. Public relations')[1]?.split('## 5. New relations')[0]
const newSection = manifest.split('## 5. New relations')[1]?.split('## 6. Public functions and RPCs')[0]
expect(currentSection, 'current public-relations section').toBeTruthy()
expect(newSection, 'new C1 relations section').toBeTruthy()

const effectiveRelations = effectivePublicRelations()
const currentManifestRelations = manifestRows(currentSection!, 'current object')
const c1ManifestRelations = manifestRows(newSection!, 'new object')

const C1_RELATIONS = [
  'table:competition_awards',
  'table:competition_lock_events',
  'table:competition_rounds',
  'table:competitions',
]

const C1B_RELATIONS = [
  'table:game_definitions',
  'table:game_membership_events',
  'table:game_memberships',
]

/**
 * Contract 68. The season fixture container: a league season could not hold a
 * fixture, and `matches` defends a tournament shape that widening would have
 * broken (see the migration header).
 */
const SEASON_RELATIONS = [
  'table:season_fixtures',
  // Contract 69. The season card: a scoreline per fixture, and a Joker keyed
  // by matchweek because ADR 0012 doubles the whole matchweek, never one
  // fixture — which a per-fixture flag cannot express.
  'table:season_predictions',
  'table:season_matchweek_jokers',
  // Contract 72. Last Man Standing setup and entrant state: contract 71 added
  // the rule as a pure function because nothing stored what it spends.
  'table:season_lms_setups',
  'table:season_lms_entrant_state',
  // Contract 77. The season Cup's window/fixture link. Separate from
  // `bonus_window_fixtures` rather than a widening of it: that table's
  // `match_id` is NOT NULL against `public.matches` and sits inside its primary
  // key, so serving a season from it would mean destructive change to a
  // production-hosted tournament table. Contract 68 answered the same question
  // the same way when season fixtures became `season_fixtures`.
  'table:season_cup_window_fixtures',
  // Contract 81. Where a matchweek card stands, and what the lock recorded.
  // `status` permits only 'provisional' and 'confirmed': a player who never
  // engaged has NO ROW, because rolling entry means absence, and storing an
  // explicit 'no_submission' would make every registered player a candidate
  // for auto-completion at the next lock.
  'table:season_matchweek_cards',
  // Append-only, keyed by lock instant, mirroring
  // `entry_automatic_submission_outcomes` — which is what lets the recurring
  // scheduler ask "have I processed this?" truthfully after a retry or a
  // crash, and reprocess a matchweek whose lock moved.
  'table:season_matchweek_submission_outcomes',
]

const reviewedRelations = [
  ...new Set([
    ...currentManifestRelations,
    ...c1ManifestRelations,
    ...C1B_RELATIONS,
    ...SEASON_RELATIONS,
  ]),
].sort()

describe('Stage C public-relation coverage after C1b and the season fixtures', () => {
  it('keeps parser positive controls at the contract-81 schema boundary', () => {
    // Raised 47 → 49 by contract 81's two season card-status relations. This
    // count is a positive control on the migration parser: if it silently
    // stopped recognising `create table`, every disposition below would be
    // vacuously satisfied by an empty set.
    expect(effectiveRelations.filter((relation) => relation.startsWith('table:'))).toHaveLength(49)
    expect(effectiveRelations.filter((relation) => relation.startsWith('view:'))).toEqual([
      'view:entry_totals',
    ])
  })

  it('gives every effective public table/view one reviewed disposition', () => {
    expect(reviewedRelations).toEqual(effectiveRelations)
  })

  it('retains exactly the four reviewed C1 relations', () => {
    expect(c1ManifestRelations.sort()).toEqual(C1_RELATIONS)
    for (const relation of C1_RELATIONS) expect(effectiveRelations).toContain(relation)
  })

  it('adds exactly the three reviewed C1b relations', () => {
    for (const relation of C1B_RELATIONS) expect(effectiveRelations).toContain(relation)
  })
})
