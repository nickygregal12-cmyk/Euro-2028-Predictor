// Last Man Standing selection outcome (display derivation).
//
// The DATABASE is the authority on survival — `recompute_lms_for_tournament`
// re-derives entrant outcomes inside the result operation. This pure helper
// only words a single pick's fate from authoritative fixture facts so history
// rows can render without another server read. Tournament format (decided
// 2026-07-28): group picks must WIN (a draw is out), knockout picks must
// ADVANCE (authoritative winner).

export type LmsFixtureRead = {
  matchId: string
  round: string
  kickoffAt: string | null
  homeTeamId: string | null
  awayTeamId: string | null
  resultState: 'scheduled' | 'confirmed' | 'corrected'
  homeScore: number | null
  awayScore: number | null
  winnerTeamId: string | null
}

export type LmsSelectionOutcome = 'pending' | 'survived' | 'out'

export function deriveLmsSelectionOutcome(
  fixtures: LmsFixtureRead[],
  teamId: string,
): LmsSelectionOutcome {
  const fixture = fixtures.find(
    (candidate) => candidate.homeTeamId === teamId || candidate.awayTeamId === teamId,
  )
  if (!fixture) return 'pending'
  if (fixture.resultState === 'scheduled') return 'pending'

  if (fixture.round === 'group') {
    if (fixture.homeScore === null || fixture.awayScore === null) return 'pending'
    const isHome = fixture.homeTeamId === teamId
    const forGoals = isHome ? fixture.homeScore : fixture.awayScore
    const againstGoals = isHome ? fixture.awayScore : fixture.homeScore
    return forGoals > againstGoals ? 'survived' : 'out'
  }

  if (!fixture.winnerTeamId) return 'pending'
  return fixture.winnerTeamId === teamId ? 'survived' : 'out'
}
