import type { Match } from '../../services/supabase/tournamentData'

export function areFinalStandingsActive(matches: Match[]): boolean {
  return (
    matches.length > 0 &&
    matches.every((match) =>
      match.resultState
        ? match.resultState === 'confirmed' || match.resultState === 'corrected'
        : match.homeScore !== null && match.awayScore !== null,
    )
  )
}
