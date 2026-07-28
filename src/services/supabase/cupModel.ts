// Pure response parsing for the Predictor Cup foundation read (contract 54).

import type { EntrantOutcome } from '../../domain/competitions/competitionModel'

export type CupGroupMemberRead = {
  userId: string
  displayName: string
  drawNumber: number
}

export type CupFixtureRead = {
  fixtureId: string
  stage: 'group' | 'playoff' | 'knockout'
  matchday: number | null
  windowLabel: string
  windowOpensAt: string | null
  windowLocksAt: string | null
  opponent: { userId: string; displayName: string }
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
