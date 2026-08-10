import { useEffect, useState } from 'react'
import { fetchSeasonFixtureList } from '../../services/supabase/seasonFixtureList'

/**
 * The `competition_round_id` for a matchweek ORDINAL.
 *
 * WHY IT HAS TO BE RESOLVED AT ALL. Contract 121's play context answers "which
 * matchweek" as a NUMBER, which is what a player reads and what the Match
 * Predictor card is addressed by. Contracts 149 and 150 are addressed by the
 * round's id, because a league's matchweek is a row rather than a position.
 * Nothing in the repository maps one to the other, and a browser must not
 * invent an id.
 *
 * SO IT COMES FROM THE FIXTURES, which is the one browser-reachable read that
 * carries both: contract 139 returns each fixture's round with its `id`, its
 * `ordinal` and its label. Matching on the ordinal is an equality over the
 * server's own values, not a guess.
 *
 * THE WINDOW IS DELIBERATELY WIDER THAN THE DEFAULT. The read's own default is
 * the last week and the next fortnight, which misses a matchweek whose first
 * kickoff is three weeks out — and a season between matchweeks is exactly when
 * this is asked. A month back and two months forward stays well inside the
 * server's 120-day cap.
 *
 * NULL IS A REAL ANSWER. A season with no fixtures in the window, a failed read
 * and a matchweek that does not exist all produce null, and every caller renders
 * "there is no matchweek to show" rather than an error or an empty grid.
 */

const DAYS_BACK = 30
const DAYS_FORWARD = 60

function windowAround(now: Date): { from: string; to: string } {
  const from = new Date(now)
  from.setUTCDate(from.getUTCDate() - DAYS_BACK)
  const to = new Date(now)
  to.setUTCDate(to.getUTCDate() + DAYS_FORWARD)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function useSeasonRoundId(
  tournamentId: string | null,
  matchweek: number | null,
): string | null {
  const [roundId, setRoundId] = useState<string | null>(null)

  useEffect(() => {
    if (tournamentId === null || matchweek === null) {
      setRoundId(null)
      return
    }
    let active = true
    setRoundId(null)
    fetchSeasonFixtureList(tournamentId, windowAround(new Date()))
      .then((page) => {
        if (!active) return
        const found = page.fixtures.find((fixture) => fixture.round.ordinal === matchweek)
        setRoundId(found?.round.id ?? null)
      })
      .catch(() => {
        if (active) setRoundId(null)
      })
    return () => {
      active = false
    }
  }, [tournamentId, matchweek])

  return roundId
}
