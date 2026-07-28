import type { ScoreCategory, ScoreEvent } from '../../domain/tournament/scoreEvents'
import type { EntryPredictions } from '../../domain/tournament/h2h'
import type { KnockoutStage } from '../../domain/tournament/scoringConfig'
import { supabase } from './client'

export type PlayerProfileDetail = {
  totalPoints: number
  rank: number
  predictions: EntryPredictions
  events: ScoreEvent[]
}

export type PlayerProfileRead = {
  playerId: string
  displayName: string
  leagueCount: number
  hasEntry: boolean
  locked: boolean
  lockAt: string | null
  detail: PlayerProfileDetail | null
}

const STAGE_FROM_DB: Record<string, KnockoutStage> = {
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  final: 'FINAL',
  champion: 'CHAMPION',
}

const SCORE_CATEGORIES = new Set<ScoreCategory>([
  'group_matches',
  'group_positions',
  'knockout',
  'awards',
])

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function mapGroupMatches(value: unknown): EntryPredictions['groupMatches'] {
  if (!Array.isArray(value) || value.length > 36) {
    throw new Error('Player profile group predictions were malformed.')
  }

  return value.map((item) => {
    const row = objectOf(item)
    const matchId = nonEmptyString(row.match_id)
    const homeScore = integer(row.home_score)
    const awayScore = integer(row.away_score)
    const joker = booleanValue(row.joker)
    if (!matchId || homeScore === null || homeScore < 0 || awayScore === null || awayScore < 0 || joker === null) {
      throw new Error('Player profile contained a malformed group prediction.')
    }
    return { matchId, homeScore, awayScore, joker }
  })
}

function mapProgression(value: unknown): EntryPredictions['progression'] {
  if (!Array.isArray(value) || value.length > 24) {
    throw new Error('Player profile progression was malformed.')
  }

  return value.map((item) => {
    const row = objectOf(item)
    const teamId = nonEmptyString(row.team_id)
    const stageKey = nonEmptyString(row.stage)
    const stage = stageKey ? STAGE_FROM_DB[stageKey] : undefined
    if (!teamId || !stage) {
      throw new Error('Player profile contained malformed progression.')
    }
    return { teamId, stage }
  })
}

function mapEvents(value: unknown): ScoreEvent[] {
  if (!Array.isArray(value) || value.length > 100) {
    throw new Error('Player profile score events were malformed.')
  }

  return value.map((item) => {
    const row = objectOf(item)
    const id = nonEmptyString(row.id)
    const category = nonEmptyString(row.category) as ScoreCategory | null
    const points = integer(row.points)
    const explanation = nonEmptyString(row.explanation)
    const joker = booleanValue(row.joker)
    if (
      !id ||
      !category ||
      !SCORE_CATEGORIES.has(category) ||
      points === null ||
      !explanation ||
      joker === null
    ) {
      throw new Error('Player profile contained a malformed score event.')
    }
    return {
      id,
      category,
      points,
      explanation,
      joker: joker || undefined,
    }
  })
}

export function mapPlayerProfile(value: unknown): PlayerProfileRead {
  const payload = objectOf(value)
  const playerId = nonEmptyString(payload.player_id)
  const displayName = nonEmptyString(payload.display_name)
  const leagueCount = integer(payload.league_count)
  const hasEntry = booleanValue(payload.has_entry)
  const locked = booleanValue(payload.locked)
  const lockAt = payload.lock_at === null ? null : nonEmptyString(payload.lock_at)

  if (
    !playerId ||
    !displayName ||
    leagueCount === null ||
    leagueCount < 0 ||
    hasEntry === null ||
    locked === null ||
    (payload.lock_at !== null && !lockAt)
  ) {
    throw new Error('Player profile response was malformed.')
  }

  if (!locked || !hasEntry) {
    return {
      playerId,
      displayName,
      leagueCount,
      hasEntry,
      locked,
      lockAt,
      detail: null,
    }
  }

  const totalPoints = integer(payload.total_points)
  const rank = integer(payload.rank)
  if (totalPoints === null || rank === null || rank < 1) {
    throw new Error('Player profile detail was malformed.')
  }

  return {
    playerId,
    displayName,
    leagueCount,
    hasEntry,
    locked,
    lockAt,
    detail: {
      totalPoints,
      rank,
      predictions: {
        groupMatches: mapGroupMatches(payload.group_matches),
        progression: mapProgression(payload.progression),
      },
      events: mapEvents(payload.score_events),
    },
  }
}

export async function fetchPlayerProfile(
  playerId: string,
  tournamentId: string,
): Promise<PlayerProfileRead> {
  const { data, error } = await supabase.rpc('get_player_profile', {
    p_player_id: playerId,
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return mapPlayerProfile(data)
}
