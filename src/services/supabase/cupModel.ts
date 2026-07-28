// Pure response parsing for the Predictor Cup foundation read (contract 54).

import type { EntrantOutcome } from '../../domain/competitions/competitionModel'

export type CupGroupMemberRead = {
  userId: string
  displayName: string
  drawNumber: number
}

export type CupFixtureResult =
  | 'win'
  | 'draw'
  | 'loss'
  | 'walkover_win'
  | 'walkover_loss'
  | 'void'

export type CupFixtureRead = {
  fixtureId: string
  stage: 'group' | 'playoff' | 'knockout'
  matchday: number | null
  windowLabel: string
  windowOpensAt: string | null
  windowLocksAt: string | null
  opponent: { userId: string; displayName: string }
  myPoints: number | null
  opponentPoints: number | null
  status: 'pending' | 'settled'
  result: CupFixtureResult | null
}

export type CupStandingRow = {
  userId: string
  displayName: string
  position: number
  played: number
  wins: number
  draws: number
  losses: number
  pointsFor: number
  pointsAgainst: number
  tablePoints: number
  windowPoints: number
}

export type CupRead = {
  serverNow: string
  competitionId: string
  registrationClosesAt: string | null
  drawCompletedAt: string | null
  entrant: { joinedAt: string; outcome: EntrantOutcome } | null
  entrantCount: number
  groupCount: number
  myGroup: {
    ordinal: number
    size: number
    members: CupGroupMemberRead[]
    standings: CupStandingRow[]
  } | null
  myFixtures: CupFixtureRead[]
}

const OUTCOMES: readonly EntrantOutcome[] = [
  'active',
  'qualified',
  'survived',
  'eliminated',
  'champion',
]

const STAGES = ['group', 'playoff', 'knockout'] as const
const RESULTS = ['win', 'draw', 'loss', 'walkover_win', 'walkover_loss', 'void'] as const

function recordOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Predictor Cup returned an invalid record.')
  }
  return value as Record<string, unknown>
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Predictor Cup returned an invalid ${field}.`)
  }
  return value
}

function textOrNull(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null
  return text(value, field)
}

function count(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Predictor Cup returned an invalid ${field}.`)
  }
  return value
}

function arrayOf(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Predictor Cup returned an invalid ${field}.`)
  }
  return value
}

export function mapCupResponse(value: unknown): CupRead {
  const root = recordOf(value)

  const serverNow = text(root.server_now, 'server time')
  if (Number.isNaN(new Date(serverNow).getTime())) {
    throw new Error('Predictor Cup returned an invalid server time.')
  }

  let entrant: CupRead['entrant'] = null
  if (root.entrant !== null && root.entrant !== undefined) {
    const row = recordOf(root.entrant)
    const outcome = text(row.outcome, 'entrant outcome')
    if (!(OUTCOMES as readonly string[]).includes(outcome)) {
      throw new Error('Predictor Cup returned an unknown entrant outcome.')
    }
    entrant = {
      joinedAt: text(row.joined_at, 'entrant joined instant'),
      outcome: outcome as EntrantOutcome,
    }
  }

  let myGroup: CupRead['myGroup'] = null
  if (root.my_group !== null && root.my_group !== undefined) {
    const group = recordOf(root.my_group)
    myGroup = {
      ordinal: count(group.ordinal, 'group ordinal'),
      size: count(group.size, 'group size'),
      members: arrayOf(group.members, 'group member list').map((entry) => {
        const member = recordOf(entry)
        return {
          userId: text(member.user_id, 'member id'),
          displayName: text(member.display_name, 'member name'),
          drawNumber: count(member.draw_number, 'draw number'),
        }
      }),
      standings:
        group.standings === null || group.standings === undefined
          ? []
          : arrayOf(group.standings, 'standings list').map((entry): CupStandingRow => {
              const row = recordOf(entry)
              return {
                userId: text(row.user_id, 'standing user id'),
                displayName: text(row.display_name, 'standing name'),
                position: count(row.position, 'standing position'),
                played: count(row.played, 'played count'),
                wins: count(row.wins, 'win count'),
                draws: count(row.draws, 'draw count'),
                losses: count(row.losses, 'loss count'),
                pointsFor: count(row.points_for, 'points for'),
                pointsAgainst: count(row.points_against, 'points against'),
                tablePoints: count(row.table_points, 'table points'),
                windowPoints: count(row.window_points, 'window points'),
              }
            }),
    }
  }

  const myFixtures = arrayOf(root.my_fixtures, 'fixture list').map(
    (entry): CupFixtureRead => {
      const fixture = recordOf(entry)
      const stage = text(fixture.stage, 'fixture stage')
      if (!(STAGES as readonly string[]).includes(stage)) {
        throw new Error('Predictor Cup returned an unknown fixture stage.')
      }
      const opponent = recordOf(fixture.opponent)
      const status = text(fixture.status ?? 'pending', 'fixture status')
      if (status !== 'pending' && status !== 'settled') {
        throw new Error('Predictor Cup returned an unknown fixture status.')
      }
      let result: CupFixtureRead['result'] = null
      if (fixture.result !== null && fixture.result !== undefined) {
        const value = text(fixture.result, 'fixture result')
        if (!(RESULTS as readonly string[]).includes(value)) {
          throw new Error('Predictor Cup returned an unknown fixture result.')
        }
        result = value as CupFixtureResult
      }
      return {
        fixtureId: text(fixture.fixture_id, 'fixture id'),
        stage: stage as CupFixtureRead['stage'],
        matchday:
          fixture.matchday === null || fixture.matchday === undefined
            ? null
            : count(fixture.matchday, 'fixture matchday'),
        windowLabel: text(fixture.window_label, 'window label'),
        windowOpensAt: textOrNull(fixture.window_opens_at, 'window open instant'),
        windowLocksAt: textOrNull(fixture.window_locks_at, 'window deadline'),
        opponent: {
          userId: text(opponent.user_id, 'opponent id'),
          displayName: text(opponent.display_name, 'opponent name'),
        },
        myPoints:
          fixture.my_points === null || fixture.my_points === undefined
            ? null
            : count(fixture.my_points, 'my points'),
        opponentPoints:
          fixture.opponent_points === null || fixture.opponent_points === undefined
            ? null
            : count(fixture.opponent_points, 'opponent points'),
        status,
        result,
      }
    },
  )

  return {
    serverNow,
    competitionId: text(root.competition_id, 'competition id'),
    registrationClosesAt: textOrNull(
      root.registration_closes_at,
      'registration close instant',
    ),
    drawCompletedAt: textOrNull(root.draw_completed_at, 'draw completion'),
    entrant,
    entrantCount: count(root.entrant_count, 'entrant count'),
    groupCount: count(root.group_count, 'group count'),
    myGroup,
    myFixtures,
  }
}
