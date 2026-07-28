// Pure response parsing for the Predictor Cup reads (contracts 54–56).

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

export type CupDecidedBy =
  | 'points'
  | 'extra_time'
  | 'penalty_number'
  | 'walkover'
  | 'admin_walkover'

export type CupFixtureRead = {
  fixtureId: string
  stage: 'group' | 'playoff' | 'knockout'
  matchday: number | null
  roundSize: number | null
  bracketSlot: number | null
  windowLabel: string
  windowOpensAt: string | null
  windowLocksAt: string | null
  opponent: { userId: string; displayName: string }
  myPoints: number | null
  opponentPoints: number | null
  decidedBy: CupDecidedBy | null
  status: 'pending' | 'settled'
  result: CupFixtureResult | null
}

export type CupMemberRead = {
  drawNumber: number
  groupPosition: number | null
  qualifiedAs: 'winner' | 'runner_up' | 'wildcard' | null
  seed: number | null
}

export type CupPenaltyNumberRead = {
  windowId: string
  windowLabel: string
  lane: 'odd' | 'even'
  value: number | null
  version: number | null
  locksAt: string | null
  locked: boolean
}

export type CupBracketTieRead = {
  stage: 'playoff' | 'knockout'
  roundSize: number | null
  bracketSlot: number
  windowSequence: number
  windowLabel: string
  home: { userId: string; displayName: string }
  away: { userId: string; displayName: string }
  winnerUserId: string | null
  decidedBy: CupDecidedBy | null
}

export type CupGoldenRow = {
  userId: string
  displayName: string
  points: number
  rank: number
}

export type CupPenaltySaveRead = {
  windowId: string
  value: number
  version: number
  locksAt: string | null
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
  completedAt: string | null
  myMember: CupMemberRead | null
  myGroup: {
    ordinal: number
    size: number
    members: CupGroupMemberRead[]
    standings: CupStandingRow[]
  } | null
  myFixtures: CupFixtureRead[]
  penaltyNumber: CupPenaltyNumberRead | null
  bracket: CupBracketTieRead[] | null
  champion: { userId: string; displayName: string } | null
  goldenPredictor: {
    top: CupGoldenRow[]
    me: { points: number; rank: number } | null
  } | null
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
const DECIDERS = [
  'points',
  'extra_time',
  'penalty_number',
  'walkover',
  'admin_walkover',
] as const
const QUALIFICATIONS = ['winner', 'runner_up', 'wildcard'] as const

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
      let decidedBy: CupFixtureRead['decidedBy'] = null
      if (fixture.decided_by !== null && fixture.decided_by !== undefined) {
        const value = text(fixture.decided_by, 'fixture decider')
        if (!(DECIDERS as readonly string[]).includes(value)) {
          throw new Error('Predictor Cup returned an unknown fixture decider.')
        }
        decidedBy = value as CupDecidedBy
      }
      return {
        fixtureId: text(fixture.fixture_id, 'fixture id'),
        stage: stage as CupFixtureRead['stage'],
        matchday:
          fixture.matchday === null || fixture.matchday === undefined
            ? null
            : count(fixture.matchday, 'fixture matchday'),
        roundSize:
          fixture.round_size === null || fixture.round_size === undefined
            ? null
            : count(fixture.round_size, 'round size'),
        bracketSlot:
          fixture.bracket_slot === null || fixture.bracket_slot === undefined
            ? null
            : count(fixture.bracket_slot, 'bracket slot'),
        decidedBy,
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

  let myMember: CupRead['myMember'] = null
  if (root.my_member !== null && root.my_member !== undefined) {
    const member = recordOf(root.my_member)
    let qualifiedAs: CupMemberRead['qualifiedAs'] = null
    if (member.qualified_as !== null && member.qualified_as !== undefined) {
      const value = text(member.qualified_as, 'qualification')
      if (!(QUALIFICATIONS as readonly string[]).includes(value)) {
        throw new Error('Predictor Cup returned an unknown qualification.')
      }
      qualifiedAs = value as CupMemberRead['qualifiedAs']
    }
    myMember = {
      drawNumber: count(member.draw_number, 'draw number'),
      groupPosition:
        member.group_position === null || member.group_position === undefined
          ? null
          : count(member.group_position, 'group position'),
      qualifiedAs,
      seed:
        member.seed === null || member.seed === undefined
          ? null
          : count(member.seed, 'seed'),
    }
  }

  let penaltyNumber: CupRead['penaltyNumber'] = null
  if (root.penalty_number !== null && root.penalty_number !== undefined) {
    const row = recordOf(root.penalty_number)
    const lane = text(row.lane, 'penalty lane')
    if (lane !== 'odd' && lane !== 'even') {
      throw new Error('Predictor Cup returned an unknown penalty lane.')
    }
    penaltyNumber = {
      windowId: text(row.window_id, 'penalty window id'),
      windowLabel: text(row.window_label, 'penalty window label'),
      lane,
      value:
        row.value === null || row.value === undefined
          ? null
          : count(row.value, 'penalty number'),
      version:
        row.version === null || row.version === undefined
          ? null
          : count(row.version, 'penalty version'),
      locksAt: textOrNull(row.locks_at, 'penalty lock instant'),
      locked: row.locked === true,
    }
  }

  let bracket: CupRead['bracket'] = null
  if (root.bracket !== null && root.bracket !== undefined) {
    bracket = arrayOf(root.bracket, 'bracket list').map((entry): CupBracketTieRead => {
      const tie = recordOf(entry)
      const stage = text(tie.stage, 'bracket stage')
      if (stage !== 'playoff' && stage !== 'knockout') {
        throw new Error('Predictor Cup returned an unknown bracket stage.')
      }
      let decidedBy: CupBracketTieRead['decidedBy'] = null
      if (tie.decided_by !== null && tie.decided_by !== undefined) {
        const value = text(tie.decided_by, 'bracket decider')
        if (!(DECIDERS as readonly string[]).includes(value)) {
          throw new Error('Predictor Cup returned an unknown bracket decider.')
        }
        decidedBy = value as CupDecidedBy
      }
      const home = recordOf(tie.home)
      const away = recordOf(tie.away)
      return {
        stage,
        roundSize:
          tie.round_size === null || tie.round_size === undefined
            ? null
            : count(tie.round_size, 'bracket round size'),
        bracketSlot: count(tie.bracket_slot, 'bracket slot'),
        windowSequence: count(tie.window_sequence, 'bracket window sequence'),
        windowLabel: text(tie.window_label, 'bracket window label'),
        home: {
          userId: text(home.user_id, 'bracket home id'),
          displayName: text(home.display_name, 'bracket home name'),
        },
        away: {
          userId: text(away.user_id, 'bracket away id'),
          displayName: text(away.display_name, 'bracket away name'),
        },
        winnerUserId: textOrNull(tie.winner_user_id, 'bracket winner'),
        decidedBy,
      }
    })
  }

  let champion: CupRead['champion'] = null
  if (root.champion !== null && root.champion !== undefined) {
    const row = recordOf(root.champion)
    champion = {
      userId: text(row.user_id, 'champion id'),
      displayName: text(row.display_name, 'champion name'),
    }
  }

  let goldenPredictor: CupRead['goldenPredictor'] = null
  if (root.golden_predictor !== null && root.golden_predictor !== undefined) {
    const row = recordOf(root.golden_predictor)
    let me: { points: number; rank: number } | null = null
    if (row.me !== null && row.me !== undefined) {
      const mine = recordOf(row.me)
      me = {
        points: count(mine.points, 'golden points'),
        rank: count(mine.rank, 'golden rank'),
      }
    }
    goldenPredictor = {
      top: arrayOf(row.top, 'golden leaderboard').map((entry): CupGoldenRow => {
        const leader = recordOf(entry)
        return {
          userId: text(leader.user_id, 'golden user id'),
          displayName: text(leader.display_name, 'golden name'),
          points: count(leader.points, 'golden points'),
          rank: count(leader.rank, 'golden rank'),
        }
      }),
      me,
    }
  }

  return {
    serverNow,
    competitionId: text(root.competition_id, 'competition id'),
    registrationClosesAt: textOrNull(
      root.registration_closes_at,
      'registration close instant',
    ),
    drawCompletedAt: textOrNull(root.draw_completed_at, 'draw completion'),
    completedAt: textOrNull(root.completed_at, 'completion instant'),
    entrant,
    entrantCount: count(root.entrant_count, 'entrant count'),
    groupCount: count(root.group_count, 'group count'),
    myMember,
    myGroup,
    myFixtures,
    penaltyNumber,
    bracket,
    champion,
    goldenPredictor,
  }
}

export function mapCupPenaltySaveResponse(value: unknown): CupPenaltySaveRead {
  const root = recordOf(value)
  return {
    windowId: text(root.window_id, 'penalty window id'),
    value: count(root.value, 'penalty number'),
    version: count(root.version, 'penalty version'),
    locksAt: textOrNull(root.locks_at, 'penalty lock instant'),
  }
}
