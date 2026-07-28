import {
  KNOCKOUT_STAGE_ORDER,
  KNOCKOUT_STAGE_POINTS,
  type KnockoutStage,
} from './scoringConfig'

export type KnockoutRound = 'group' | 'r16' | 'qf' | 'sf' | 'final'

export type KnockoutMatchSnapshot = {
  round: KnockoutRound
  homeTeamId: string | null
  awayTeamId: string | null
  winnerTeamId: string | null
  resulted: boolean
}

export type KnockoutState = {
  reachedByTeam: Map<string, Set<KnockoutStage>>
  eliminatedTeamIds: Set<string>
}

export type BracketHealthStatus = 'secured' | 'possible' | 'lost'

export type BracketHealthMilestone = {
  teamId: string
  stage: KnockoutStage
  points: number
  status: BracketHealthStatus
}

export type BracketHealth = {
  securedPoints: number
  possiblePoints: number
  lostPoints: number
  totalPredictedPoints: number
  milestones: BracketHealthMilestone[]
}

const ROUND_STAGE: Partial<Record<KnockoutRound, KnockoutStage>> = {
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  final: 'FINAL',
}

const NEXT_STAGE: Partial<Record<KnockoutRound, KnockoutStage>> = {
  r16: 'QF',
  qf: 'SF',
  sf: 'FINAL',
  final: 'CHAMPION',
}

function markReached(
  reachedByTeam: Map<string, Set<KnockoutStage>>,
  teamId: string | null,
  stage: KnockoutStage | undefined,
): void {
  if (!teamId || !stage) return
  const reached = reachedByTeam.get(teamId) ?? new Set<KnockoutStage>()
  const stageIndex = KNOCKOUT_STAGE_ORDER.indexOf(stage)
  for (let index = 0; index <= stageIndex; index += 1) {
    reached.add(KNOCKOUT_STAGE_ORDER[index])
  }
  reachedByTeam.set(teamId, reached)
}

/**
 * Build the authoritative knockout state from fixture participants and winners.
 * A participant has reached that round; a winner has reached the next milestone.
 * Once every group match is resulted, teams absent from the R16 are eliminated.
 */
export function deriveKnockoutState(input: {
  teamIds: string[]
  matches: KnockoutMatchSnapshot[]
}): KnockoutState {
  const reachedByTeam = new Map<string, Set<KnockoutStage>>()
  const eliminatedTeamIds = new Set<string>()
  const groupMatches = input.matches.filter((match) => match.round === 'group')
  const groupsComplete = groupMatches.length > 0 && groupMatches.every((match) => match.resulted)

  for (const match of input.matches) {
    const stage = ROUND_STAGE[match.round]
    if (!stage) continue

    markReached(reachedByTeam, match.homeTeamId, stage)
    markReached(reachedByTeam, match.awayTeamId, stage)

    if (!match.resulted || !match.winnerTeamId) continue

    markReached(reachedByTeam, match.winnerTeamId, NEXT_STAGE[match.round])
    for (const participant of [match.homeTeamId, match.awayTeamId]) {
      if (participant && participant !== match.winnerTeamId) {
        eliminatedTeamIds.add(participant)
      }
    }
  }

  if (groupsComplete) {
    for (const teamId of input.teamIds) {
      if (!reachedByTeam.get(teamId)?.has('R16')) {
        eliminatedTeamIds.add(teamId)
      }
    }
  }

  return { reachedByTeam, eliminatedTeamIds }
}

/**
 * Split the stacked knockout value of an entry into points already secured,
 * points still achievable, and points that can no longer be won.
 */
export function computeBracketHealth(
  progression: { teamId: string; stage: KnockoutStage }[],
  state: KnockoutState,
): BracketHealth {
  const milestones: BracketHealthMilestone[] = []

  for (const prediction of progression) {
    const furthestIndex = KNOCKOUT_STAGE_ORDER.indexOf(prediction.stage)
    if (furthestIndex < 0) continue

    for (let index = 0; index <= furthestIndex; index += 1) {
      const stage = KNOCKOUT_STAGE_ORDER[index]
      const status: BracketHealthStatus = state.reachedByTeam.get(prediction.teamId)?.has(stage)
        ? 'secured'
        : state.eliminatedTeamIds.has(prediction.teamId)
          ? 'lost'
          : 'possible'
      milestones.push({
        teamId: prediction.teamId,
        stage,
        points: KNOCKOUT_STAGE_POINTS[stage],
        status,
      })
    }
  }

  const pointsFor = (status: BracketHealthStatus) =>
    milestones
      .filter((milestone) => milestone.status === status)
      .reduce((sum, milestone) => sum + milestone.points, 0)

  const securedPoints = pointsFor('secured')
  const possiblePoints = pointsFor('possible')
  const lostPoints = pointsFor('lost')

  return {
    securedPoints,
    possiblePoints,
    lostPoints,
    totalPredictedPoints: securedPoints + possiblePoints + lostPoints,
    milestones,
  }
}
