// Pure derivations for the Matches tab's tournament-info sub-views (Tables /
// Bracket / Stats — design-system §Matches). Everything here is data in, data
// out over CONFIRMED results only; no predictions, no UI, no storage. Feeding
// these from anything but authoritative scores is a caller bug.

// One settled result, already filtered through authoritativeMatchScore by the
// caller — scores here are always real.
export type SettledResult = {
  matchRef: string
  round: string // 'group' | 'r16' | 'qf' | 'sf' | 'final'
  homeTeamId: string
  awayTeamId: string
  home: number
  away: number
}

export type TeamGoalsLine = {
  teamId: string
  goals: number
  played: number
}

export type TournamentStats = {
  played: number
  totalGoals: number
  // Rounded to one decimal place; null when nothing has been played.
  goalsPerMatch: number | null
  // The widest winning margin so far (first such match on a tie). Null until
  // a match has produced a winner.
  biggestWin: SettledResult | null
  // The match with the most total goals (first on a tie). Null until any
  // match has a goal.
  highestScoring: SettledResult | null
  // Every team that has played, ordered most goals scored first (then most
  // recent-agnostic: stable input order on ties).
  teamGoals: TeamGoalsLine[]
}

/**
 * Aggregate result-derived tournament records. Works from zero results up —
 * every field degrades to an honest empty value rather than a guess.
 */
export function computeTournamentStats(results: SettledResult[]): TournamentStats {
  let totalGoals = 0
  let biggestWin: SettledResult | null = null
  let biggestMargin = 0
  let highestScoring: SettledResult | null = null
  let highestGoals = 0
  const byTeam = new Map<string, TeamGoalsLine>()

  const addTeam = (teamId: string, goals: number) => {
    const line = byTeam.get(teamId) ?? { teamId, goals: 0, played: 0 }
    line.goals += goals
    line.played += 1
    byTeam.set(teamId, line)
  }

  for (const r of results) {
    const goals = r.home + r.away
    totalGoals += goals
    addTeam(r.homeTeamId, r.home)
    addTeam(r.awayTeamId, r.away)

    const margin = Math.abs(r.home - r.away)
    if (margin > 0 && margin > biggestMargin) {
      biggestMargin = margin
      biggestWin = r
    }
    if (goals > 0 && goals > highestGoals) {
      highestGoals = goals
      highestScoring = r
    }
  }

  const teamGoals = [...byTeam.values()].sort((a, b) => b.goals - a.goals)

  return {
    played: results.length,
    totalGoals,
    goalsPerMatch:
      results.length > 0 ? Math.round((totalGoals / results.length) * 10) / 10 : null,
    biggestWin,
    highestScoring,
    teamGoals,
  }
}

/**
 * Human label for a knockout slot reference (matches.home_source /
 * away_source) — used when a knockout side's team is not yet resolved. The
 * reference grammar is fixed by the init migration:
 *   'W-A'..'W-F'       group winner
 *   'RU-A'..'RU-F'     group runner-up
 *   '3RD-Wx'           qualifying third (allocation slot)
 *   'W-R16-3' etc.     winner of an earlier knockout tie
 * Anything else falls through unchanged rather than pretending to know.
 */
export function describeMatchSource(source: string): string {
  const groupWinner = /^W-([A-F])$/.exec(source)
  if (groupWinner) return `Winner Group ${groupWinner[1]}`

  const runnerUp = /^RU-([A-F])$/.exec(source)
  if (runnerUp) return `Runner-up Group ${runnerUp[1]}`

  if (/^3RD-W[A-F]$/.test(source)) return 'Best third'

  const koWinner = /^W-(R16-\d|QF-\d|SF-\d)$/.exec(source)
  if (koWinner) return `Winner ${koWinner[1]}`

  return source
}
