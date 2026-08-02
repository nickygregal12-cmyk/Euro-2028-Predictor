export type CompetitionKind = 'tournament' | 'league_season'

export type CompetitionBounds = {
  startsAt: string
  endsAt: string
}

type CompetitionConfigBase = {
  id: string
  name: string
  /**
   * The zone the competition's own calendar is kept in: which day a fixture
   * belongs to, and — once seasons exist — which matchweek. It is a property of
   * the competition, not of whoever is looking at it, because standings cannot
   * tolerate "which matchweek is this?" having two answers.
   *
   * A viewer's device zone renders clock times and nothing else. It must never
   * reach this field. See tests/domain/competition/timeZoneAuthority.test.ts.
   */
  competitionTimeZone: string
  bounds: CompetitionBounds
}

export type TournamentCompetitionConfig = CompetitionConfigBase & {
  kind: 'tournament'
  primaryStage: 'groups'
  progression: 'groups_to_knockout'
  groupStage: {
    groupCount: number
    matchdayCount: number
  }
  knockoutStage: {
    roundCount: number
  }
}

export type LeagueSeasonCompetitionConfig = CompetitionConfigBase & {
  kind: 'league_season'
  primaryStage: 'league'
  progression: 'rolling_matchweeks'
  matchweeks: {
    count: number
  }
}

export type CompetitionConfig = TournamentCompetitionConfig | LeagueSeasonCompetitionConfig

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function hasCommonConfig(value: Record<string, unknown>): boolean {
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.name) ||
    !isNonEmptyString(value.competitionTimeZone)
  ) {
    return false
  }
  if (!isRecord(value.bounds)) return false
  return isNonEmptyString(value.bounds.startsAt) && isNonEmptyString(value.bounds.endsAt)
}

export function isTournamentCompetitionConfig(value: unknown): value is TournamentCompetitionConfig {
  if (!isRecord(value) || !hasCommonConfig(value)) return false
  if (value.kind !== 'tournament' || value.primaryStage !== 'groups' || value.progression !== 'groups_to_knockout') {
    return false
  }
  if (!isRecord(value.groupStage) || !isRecord(value.knockoutStage)) return false
  return (
    isPositiveInteger(value.groupStage.groupCount) &&
    isPositiveInteger(value.groupStage.matchdayCount) &&
    isPositiveInteger(value.knockoutStage.roundCount)
  )
}

export function isLeagueSeasonCompetitionConfig(value: unknown): value is LeagueSeasonCompetitionConfig {
  if (!isRecord(value) || !hasCommonConfig(value)) return false
  if (value.kind !== 'league_season' || value.primaryStage !== 'league' || value.progression !== 'rolling_matchweeks') {
    return false
  }
  if (!isRecord(value.matchweeks)) return false
  return isPositiveInteger(value.matchweeks.count)
}

export function isCompetitionConfig(value: unknown): value is CompetitionConfig {
  return isTournamentCompetitionConfig(value) || isLeagueSeasonCompetitionConfig(value)
}
