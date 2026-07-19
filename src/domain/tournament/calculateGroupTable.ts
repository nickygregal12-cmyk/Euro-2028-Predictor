// Pure domain function: takes match scores, returns group standings.
// No UI, no database access — just data in, data out.
// Ordering here is BASIC (points only). Full tie-break ordering
// (head-to-head, goal difference, etc.) happens in resolveGroupTies.ts

export type MatchScore = {
  homeTeamId: string
  awayTeamId: string
  homeScore: number
  awayScore: number
}

export type TeamStanding = {
  teamId: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

function emptyStanding(teamId: string): TeamStanding {
  return {
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }
}

/**
 * Calculates group standings from a list of played match scores.
 * teamIds should include every team in the group, even ones with
 * no matches played yet (they'll show as all-zero rows).
 *
 * Sort order here is points only — this is NOT the final tie-break
 * order. Use resolveGroupTies() for that.
 */
export function calculateGroupTable(
  teamIds: string[],
  matches: MatchScore[]
): TeamStanding[] {
  const standings = new Map<string, TeamStanding>()
  for (const id of teamIds) {
    standings.set(id, emptyStanding(id))
  }

  for (const match of matches) {
    const home = standings.get(match.homeTeamId)
    const away = standings.get(match.awayTeamId)
    if (!home || !away) {
      // Match references a team not in this group — skip rather than
      // silently corrupt the table. Callers should validate input
      // upstream, but the domain function should not throw on bad data.
      continue
    }

    home.played += 1
    away.played += 1
    home.goalsFor += match.homeScore
    home.goalsAgainst += match.awayScore
    away.goalsFor += match.awayScore
    away.goalsAgainst += match.homeScore

    if (match.homeScore > match.awayScore) {
      home.won += 1
      home.points += 3
      away.lost += 1
    } else if (match.homeScore < match.awayScore) {
      away.won += 1
      away.points += 3
      home.lost += 1
    } else {
      home.drawn += 1
      away.drawn += 1
      home.points += 1
      away.points += 1
    }
  }

  const result = Array.from(standings.values())
  for (const s of result) {
    s.goalDifference = s.goalsFor - s.goalsAgainst
  }

  // Basic sort by points, then goal difference, then goals for.
  // This is a convenience default — resolveGroupTies() is the
  // authoritative ordering used anywhere correctness matters.
  return result.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
    return b.goalsFor - a.goalsFor
  })
}
