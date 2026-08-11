import type {
  SeasonLeagueMatchweekPredictions,
} from '../../services/supabase/seasonLeaguePredictions'
import { formatKickoffTime } from '../../shared/time/kickoff'

/**
 * One private league's matchweek: who predicted what, for every fixture in it
 * (contract 149).
 *
 * TWO SHAPES, ONE MODEL. Desktop scans a matrix — fixtures across, members down
 * — because comparing eight people over ten fixtures is what a grid is for.
 * A phone cannot show that grid and must not be given a shrunken one, so the
 * same data is also arranged fixture by fixture with the caller's own row
 * first. Both come from this one model rather than from two, so the two layouts
 * cannot disagree about what somebody predicted.
 *
 * THE REVEAL DECISION IS THE READ'S. `revealed` comes from the server, which
 * resolves the matchweek's own lock and accepts no time argument. Nothing here
 * reads a clock.
 *
 * OUTCOME IS COUNTED, NOT SCORED. `exact` and `correct` compare a prediction
 * with the official result. Points are the matchweek's, from
 * `season_matchweek_scores`, and are null until it settles — a league must not
 * be able to disagree with the season about what a matchweek was worth.
 *
 * PURE. Times format in the viewer's zone through the one kickoff authority; no
 * network, no storage, no ambient clock.
 */

export type LeagueMatchweekCell = {
  fixtureId: string
  /** Null when this member did not predict this fixture. */
  label: string | null
  outcome: 'exact' | 'correct' | 'wrong' | null
}

export type LeagueMatchweekMember = {
  userId: string
  displayName: string
  isSelf: boolean
  /** Null until the matchweek settles. */
  points: number | null
  jokerPlayed: boolean
  /** One cell per fixture, in the fixtures' own order. */
  cells: readonly LeagueMatchweekCell[]
  /** How many of this matchweek's fixtures they predicted. */
  predicted: number
}

export type LeagueMatchweekFixture = {
  id: string
  home: string
  away: string
  /** "15:00" in the viewer's zone, or null when no kickoff is scheduled. */
  kickoff: string | null
  /** "2 - 1" once the platform settles it. Never a provisional score. */
  score: string | null
  /** The members who predicted this fixture, caller first. */
  rows: readonly {
    userId: string
    displayName: string
    isSelf: boolean
    label: string
    outcome: 'exact' | 'correct' | 'wrong' | null
  }[]
}

export type LeagueMatchweekView = {
  leagueId: string
  matchweek: { ordinal: number; label: string; locksAt: string | null }
  revealed: boolean
  memberCount: number
  predictedCount: number
  settled: boolean
  fixtures: readonly LeagueMatchweekFixture[]
  /** Empty while hidden. Server order, which is points-descending once settled. */
  members: readonly LeagueMatchweekMember[]
}

function outcomeOf(
  prediction: { home: number; away: number } | undefined,
  result: { home: number; away: number } | null,
): 'exact' | 'correct' | 'wrong' | null {
  if (!prediction || !result) return null
  if (prediction.home === result.home && prediction.away === result.away) return 'exact'
  return Math.sign(prediction.home - prediction.away) === Math.sign(result.home - result.away)
    ? 'correct'
    : 'wrong'
}

export function presentLeagueMatchweek(
  page: SeasonLeagueMatchweekPredictions,
  timeZone?: string,
): LeagueMatchweekView {
  const members: LeagueMatchweekMember[] = page.members.map((member) => {
    const cells = page.fixtures.map((fixture) => {
      const prediction = member.predictions[fixture.id]
      return {
        fixtureId: fixture.id,
        label: prediction ? `${prediction.home} - ${prediction.away}` : null,
        outcome: outcomeOf(prediction, fixture.result),
      }
    })
    return {
      userId: member.userId,
      displayName: member.displayName,
      isSelf: member.isSelf,
      points: member.points,
      jokerPlayed: member.jokerPlayed,
      cells,
      predicted: cells.filter((cell) => cell.label !== null).length,
    }
  })

  const fixtures: LeagueMatchweekFixture[] = page.fixtures.map((fixture) => {
    const rows = members
      .map((member) => {
        const cell = member.cells.find((entry) => entry.fixtureId === fixture.id)
        return cell?.label
          ? {
              userId: member.userId,
              displayName: member.displayName,
              isSelf: member.isSelf,
              label: cell.label,
              outcome: cell.outcome,
            }
          : null
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)

    // The caller first, then the server's order. A phone reads its own row
    // before anybody else's, which is the whole difference between this layout
    // and the matrix.
    const self = rows.filter((row) => row.isSelf)
    const others = rows.filter((row) => !row.isSelf)

    return {
      id: fixture.id,
      home: fixture.home,
      away: fixture.away,
      kickoff: fixture.kickoffAt ? formatKickoffTime(fixture.kickoffAt, timeZone) : null,
      // The platform's settled result only. Contract 149 carries no provisional
      // score, and this model must never grow one.
      score: fixture.result ? `${fixture.result.home} - ${fixture.result.away}` : null,
      rows: [...self, ...others],
    }
  })

  return {
    leagueId: page.league.id,
    matchweek: {
      ordinal: page.matchweek.ordinal,
      label: page.matchweek.label,
      locksAt: page.matchweek.locksAt,
    },
    revealed: page.revealed,
    memberCount: page.memberCount,
    predictedCount: page.predictedCount,
    settled: page.members.some((member) => member.settledAt !== null),
    fixtures,
    members,
  }
}
