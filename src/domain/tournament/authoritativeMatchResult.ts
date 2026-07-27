import type { Match } from '../../services/supabase/tournamentData'

export type MatchWinnerSide = 'home' | 'away'

/**
 * The result lifecycle state is authoritative when present. The score fallback
 * keeps older fixtures and isolated domain tests compatible without allowing a
 * cleared/scheduled row with stale values to look complete.
 */
export function hasAuthoritativeResult(match: Match): boolean {
  if (match.resultState === 'scheduled') return false
  if (match.resultState === 'confirmed' || match.resultState === 'corrected') {
    return true
  }

  return match.homeScore !== null && match.awayScore !== null
}

export function authoritativeMatchScore(
  match: Match,
): { home: number; away: number } | null {
  if (!hasAuthoritativeResult(match)) return null
  if (match.homeScore === null || match.awayScore === null) return null
  return { home: match.homeScore, away: match.awayScore }
}

/**
 * Prefer the server-owned winner reference. Score comparison is only a legacy
 * fallback for regulation/extra-time results that predate the richer read
 * contract. A level knockout score is never guessed.
 */
export function authoritativeWinnerSide(match: Match): MatchWinnerSide | null {
  if (!hasAuthoritativeResult(match)) return null

  if (match.winnerTeamId && match.winnerTeamId === match.homeTeamId) return 'home'
  if (match.winnerTeamId && match.winnerTeamId === match.awayTeamId) return 'away'

  const score = authoritativeMatchScore(match)
  if (!score || score.home === score.away) return null
  return score.home > score.away ? 'home' : 'away'
}

export function eliminatedKnockoutTeamId(match: Match): string | null {
  if (match.round === 'group') return null
  if (!match.homeTeamId || !match.awayTeamId) return null

  const winner = authoritativeWinnerSide(match)
  if (winner === 'home') return match.awayTeamId
  if (winner === 'away') return match.homeTeamId
  return null
}

/**
 * Extra result context shown beneath the main score. The hero keeps the
 * football score (for example 2–2) while this line explains how the tie was
 * actually decided.
 */
export function knockoutResultDetail(
  match: Match,
  homeName: string,
  awayName: string,
): string | null {
  if (match.round === 'group') return null

  const winner = authoritativeWinnerSide(match)
  if (!winner) return null
  const winnerName = winner === 'home' ? homeName : awayName

  if (match.resultMethod === 'penalties') {
    if (
      match.homePenalties !== null &&
      match.homePenalties !== undefined &&
      match.awayPenalties !== null &&
      match.awayPenalties !== undefined
    ) {
      return `${winnerName} won ${match.homePenalties}–${match.awayPenalties} on penalties`
    }
    return `${winnerName} won on penalties`
  }

  if (match.resultMethod === 'extra_time') {
    return `${winnerName} won after extra time`
  }

  return null
}
