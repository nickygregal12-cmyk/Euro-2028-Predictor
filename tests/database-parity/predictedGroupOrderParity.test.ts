import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import fixtures from '../../fixtures/predicted-group-order.json'
import {
  resolveGroupTies,
  type ResolveGroupTiesResult,
} from '../../src/domain/tournament/resolveGroupTies'
import type { MatchScore } from '../../src/domain/tournament/calculateGroupTable'
import type { TieResolution } from '../../src/domain/tournament/tieResolutions'

type ScoreTuple = [string, string, number, number]

type Fixture = {
  name: string
  teams: string[]
  matches: ScoreTuple[]
}

type ParityCase = {
  name: string
  teams: string[]
  matches: ScoreTuple[]
  resolutions?: TieResolution[]
}

const databaseEnabled = process.env.DATABASE_PARITY === '1'
const databaseDescribe = databaseEnabled ? describe : describe.skip
const databaseContainer =
  process.env.SUPABASE_DB_CONTAINER ??
  'supabase_db_euro-2028-predictor-local'

function toMatches(matches: ScoreTuple[]): MatchScore[] {
  return matches.map(([homeTeamId, awayTeamId, homeScore, awayScore]) => ({
    homeTeamId,
    awayTeamId,
    homeScore,
    awayScore,
  }))
}

function sqlLiteral(value: unknown): string {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
}

function resolveInPostgres(testCase: ParityCase): ResolveGroupTiesResult {
  const sql = `select predictor_internal.resolve_predicted_group_order(
    ${sqlLiteral(testCase.teams)},
    ${sqlLiteral(testCase.matches)},
    ${sqlLiteral(testCase.resolutions ?? [])}
  )::text;`

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
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
    ],
    {
      input: sql,
      encoding: 'utf8',
    },
  ).trim()

  return JSON.parse(output) as ResolveGroupTiesResult
}

function canonicalUnresolved(groups: string[][]): string[][] {
  return groups
    .map((group) => [...group].sort())
    .sort((left, right) => left.join('|').localeCompare(right.join('|')))
}

function normalize(result: ResolveGroupTiesResult) {
  return {
    standings: result.standings.map((standing) => ({
      teamId: standing.teamId,
      played: standing.played,
      won: standing.won,
      drawn: standing.drawn,
      lost: standing.lost,
      goalsFor: standing.goalsFor,
      goalsAgainst: standing.goalsAgainst,
      goalDifference: standing.goalDifference,
      points: standing.points,
      rank: standing.rank,
      tiedUnresolved: standing.tiedUnresolved,
    })),
    unresolvedGroups: canonicalUnresolved(result.unresolvedGroups),
  }
}

const allDraws: ScoreTuple[] = [
  ['a', 'b', 1, 1],
  ['a', 'c', 1, 1],
  ['a', 'd', 1, 1],
  ['b', 'c', 1, 1],
  ['b', 'd', 1, 1],
  ['c', 'd', 1, 1],
]

const changedTie: ScoreTuple[] = allDraws.map((match) =>
  match[0] === 'a' && match[1] === 'b'
    ? ['a', 'b', 2, 1]
    : match,
) as ScoreTuple[]

const manualCases: ParityCase[] = [
  {
    name: 'manual-keep-displayed-order',
    teams: ['a', 'b', 'c', 'd'],
    matches: allDraws,
    resolutions: [
      {
        teamIds: ['d', 'c', 'b', 'a'],
        order: ['a', 'b', 'c', 'd'],
      },
    ],
  },
  {
    name: 'manual-rearranged-order',
    teams: ['d', 'b', 'a', 'c'],
    matches: [...allDraws].reverse(),
    resolutions: [
      {
        teamIds: ['d', 'b', 'a', 'c'],
        order: ['d', 'c', 'b', 'a'],
      },
    ],
  },
  {
    name: 'hostile-row-before-valid-row',
    teams: ['a', 'b', 'c', 'd'],
    matches: allDraws,
    resolutions: [
      {
        teamIds: ['a', 'b', 'c', 'd'],
        order: ['a', 'a', 'c', 'd'],
      },
      {
        teamIds: ['d', 'c', 'b', 'a'],
        order: ['b', 'a', 'd', 'c'],
      },
    ],
  },
  {
    name: 'stale-resolution-after-score-change',
    teams: ['a', 'b', 'c', 'd'],
    matches: changedTie,
    resolutions: [
      {
        teamIds: ['a', 'b', 'c', 'd'],
        order: ['d', 'c', 'b', 'a'],
      },
    ],
  },
]

const parityCases: ParityCase[] = [
  ...(fixtures as Fixture[]).map((fixture) => ({
    name: fixture.name,
    teams: fixture.teams,
    matches: fixture.matches,
  })),
  ...manualCases,
]

databaseDescribe('TypeScript/PostgreSQL predicted-group-order parity', () => {
  for (const testCase of parityCases) {
    it(testCase.name, () => {
      const typescript = resolveGroupTies(
        testCase.teams,
        toMatches(testCase.matches),
        testCase.resolutions ?? [],
      )
      const postgres = resolveInPostgres(testCase)

      expect(normalize(postgres)).toEqual(normalize(typescript))
    })
  }
})
