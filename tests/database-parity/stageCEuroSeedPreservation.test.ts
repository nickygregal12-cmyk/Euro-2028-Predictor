import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Repository half of CS-012. The seed can pin Euro's natural identifiers and
 * complete fixture graph; UUID preservation is a same-database migration-rehearsal
 * concern documented in the companion architecture oracle.
 */

const seedPath = resolve(process.cwd(), 'supabase/seed.sql')
const seed = readFileSync(seedPath, 'utf8')

const EXPECTED_DIGEST =
  '9047e1e86aebb0ee0da7d461fc7beb479c723a77922a8378e3e8d11e6816c00e'

type Scalar = number | string

type GroupFixture = [
  matchRef: string,
  group: string,
  matchday: number,
  homeSlot: string,
  awaySlot: string,
  date: string,
  venue: string,
]

type KnockoutFixture = [
  matchRef: string,
  round: string,
  homeSource: string,
  awaySource: string,
  date: string,
  venue: string,
]

function sectionBetween(source: string, start: string, end: string): string {
  const section = source.split(start)[1]?.split(end)[0]
  expect(section, `seed section ${start}`).toBeTruthy()
  return section!
}

function tupleBlock(source: string, alias: 'k' | 'm'): string {
  const pattern = new RegExp(
    `cross\\s+join\\s*\\(values([\\s\\S]*?)\\)\\s+as\\s+${alias}\\s*\\(`,
    'i',
  )
  const match = source.match(pattern)
  expect(match, `${alias} fixture values`).toBeTruthy()
  return match![1]
}

function parseTuple(tuple: string): Scalar[] {
  const values: Scalar[] = []
  const tokenPattern = /'((?:''|[^'])*)'|(-?\d+)/g

  for (const match of tuple.matchAll(tokenPattern)) {
    if (match[1] !== undefined) {
      values.push(match[1].replaceAll("''", "'"))
    } else {
      values.push(Number(match[2]))
    }
  }

  return values
}

function parseTuples(block: string): Scalar[][] {
  const tuples: Scalar[][] = []
  const tuplePattern = /\(([^()]*)\)/g

  for (const match of block.matchAll(tuplePattern)) {
    const values = parseTuple(match[1])
    if (values.length > 0) tuples.push(values)
  }

  return tuples
}

function tournamentIdentity(): [string, number, string, string] {
  const match = seed.match(
    /select\s+'([^']+)'\s*,\s*(\d+)\s*,\s*'(\d{4}-\d{2}-\d{2})'\s*,\s*'(\d{4}-\d{2}-\d{2})'\s*\nwhere\s+not\s+exists/i,
  )
  expect(match, 'Euro tournament seed identity').toBeTruthy()
  return [match![1], Number(match![2]), match![3], match![4]]
}

function groupLetters(): string[] {
  const section = sectionBetween(seed, '-- Groups A–F.', '-- 24 placeholder teams')
  return [...section.matchAll(/\('([A-F])'\)/g)].map((match) => match[1])
}

function teamSlots(): number[] {
  const section = sectionBetween(
    seed,
    '-- 24 placeholder teams: "Team A1" … "Team F4".',
    '-- Place each team in its group slot',
  )

  const values = section.match(/cross\s+join\s+\(values\s+([\s\S]*?)\)\s+as\s+s\(n\)/i)?.[1]
  expect(values, 'placeholder team slot values').toBeTruthy()
  return [...values!.matchAll(/\((\d+)\)/g)].map((match) => Number(match[1]))
}

const groups = groupLetters()
const slots = teamSlots()
const teams = groups.flatMap((group) => slots.map((slot) => `Team ${group}${slot}`))
const groupFixtures = parseTuples(tupleBlock(seed, 'm')) as GroupFixture[]
const knockoutFixtures = parseTuples(tupleBlock(seed, 'k')) as KnockoutFixture[]
const tournament = tournamentIdentity()

const canonicalPayload = [tournament, groups, teams, groupFixtures, knockoutFixtures]
const canonicalDigest = createHash('sha256')
  .update(JSON.stringify(canonicalPayload))
  .digest('hex')

function countBy<T>(values: T[], key: (value: T) => string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) {
    const itemKey = key(value)
    counts.set(itemKey, (counts.get(itemKey) ?? 0) + 1)
  }
  return counts
}

describe('Stage C Euro 2028 seed preservation oracle', () => {
  it('pins the Euro tournament identity and bounded dates', () => {
    expect(tournament).toEqual([
      'UEFA Euro 2028',
      2028,
      '2028-06-09',
      '2028-07-09',
    ])
  })

  it('pins six groups and twenty-four placeholder team slots', () => {
    expect(groups).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    expect(slots).toEqual([1, 2, 3, 4])
    expect(teams).toHaveLength(24)
    expect(new Set(teams).size).toBe(24)
    expect(teams.at(0)).toBe('Team A1')
    expect(teams.at(-1)).toBe('Team F4')
  })

  it('pins the 36-match group-stage shape', () => {
    expect(groupFixtures).toHaveLength(36)
    expect(new Set(groupFixtures.map(([matchRef]) => matchRef)).size).toBe(36)

    const fixturesByGroupAndMatchday = countBy(
      groupFixtures,
      ([, group, matchday]) => `${group}:${matchday}`,
    )
    expect([...fixturesByGroupAndMatchday.values()].every((count) => count === 2)).toBe(
      true,
    )
    expect(fixturesByGroupAndMatchday.size).toBe(18)

    for (const group of groups) {
      const pairs = groupFixtures
        .filter(([, fixtureGroup]) => fixtureGroup === group)
        .map(([, , , home, away]) => [home, away].sort().join('-'))

      expect(new Set(pairs).size, `unique ${group} slot pairings`).toBe(6)
    }
  })

  it('pins the knockout source graph and round distribution', () => {
    expect(knockoutFixtures).toHaveLength(15)
    expect(countBy(knockoutFixtures, ([, round]) => round)).toEqual(
      new Map([
        ['r16', 8],
        ['qf', 4],
        ['sf', 2],
        ['final', 1],
      ]),
    )
    expect(knockoutFixtures.at(-1)).toEqual([
      'FINAL',
      'final',
      'W-SF-1',
      'W-SF-2',
      '2028-07-09',
      'Wembley',
    ])
  })

  it('pins all 51 fixture references and the complete canonical seed payload', () => {
    const matchRefs = [
      ...groupFixtures.map(([matchRef]) => matchRef),
      ...knockoutFixtures.map(([matchRef]) => matchRef),
    ]

    expect(matchRefs).toHaveLength(51)
    expect(new Set(matchRefs).size).toBe(51)
    expect(canonicalDigest).toBe(EXPECTED_DIGEST)
  })

  it('keeps UUID preservation as a migration-rehearsal oracle, not a seed claim', () => {
    const tournamentInsert = sectionBetween(
      seed,
      '-- Tournament (idempotent guard so a re-run doesn\'t create a second one).',
      '-- Groups A–F.',
    )

    expect(tournamentInsert).toContain(
      'insert into tournaments (name, year, starts_on, ends_on)',
    )
    expect(tournamentInsert).not.toMatch(/insert\s+into\s+tournaments\s*\([^)]*\bid\b/i)
  })
})
