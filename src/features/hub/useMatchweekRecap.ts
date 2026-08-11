import { useEffect, useState } from 'react'
import { competitionRoute } from '../../app/weeklyRoutes'
import { fetchSeasonPlayerProfile } from '../../services/supabase/seasonPlayerProfile'
import { fetchSeasonLeagueMovement } from '../../services/supabase/seasonLeagueMovement'
import { fetchMyGameLeagues } from '../../services/supabase/gameLeagues'
import { presentMatchweekRecap, type MatchweekRecap } from './matchweekRecapModel'
import type { PlayerCompetitions } from './playerCompetitions'

/**
 * The Hub's Matchweek Recap, assembled from contracts 151 and 150.
 *
 * THE BOUNDS ARE STATED RATHER THAN SILENT. A player relevant to twenty
 * competitions must not make the Hub issue twenty requests, so the recap covers
 * the **first three** competitions by relevance, and league movement is fetched
 * for the **first of those only**, and for at most **two** of its leagues. The
 * section says so and links onward to each competition, which is where the rest
 * lives. A cap nobody can see reads as "we covered everything".
 *
 * EVERY READ FAILS ALONE. A competition whose profile could not be read
 * contributes nothing; a league whose movement could not be read contributes no
 * movement line. Neither takes the section down, because a recap is context and
 * never the reason a player opened the Hub.
 *
 * IT ASKS NOTHING UNTIL IT KNOWS WHO THE PLAYER IS. `userId` comes from the
 * session; contract 151 answers about one named player, and the player asking
 * about themselves is always permitted.
 */

const COMPETITION_LIMIT = 3
const LEAGUE_LIMIT = 2

export type MatchweekRecapState = {
  status: 'loading' | 'ready'
  recaps: readonly MatchweekRecap[]
  /** Competitions beyond the bound, so the cap can be stated rather than hidden. */
  notCovered: number
}

export function useMatchweekRecap(
  player: PlayerCompetitions | null,
  userId: string | null,
): MatchweekRecapState {
  const [state, setState] = useState<MatchweekRecapState>({
    status: 'loading',
    recaps: [],
    notCovered: 0,
  })

  const key = (player?.mine ?? [])
    .map((entry) => entry.tournamentId ?? entry.competition.seasonRowName)
    .join('|')

  useEffect(() => {
    if (player === null || userId === null) return
    const targets = player.mine
      .filter((entry) => entry.tournamentId !== null)
      .slice(0, COMPETITION_LIMIT)
    const notCovered = Math.max(0, player.mine.length - targets.length)

    if (targets.length === 0) {
      setState({ status: 'ready', recaps: [], notCovered })
      return
    }

    let active = true
    setState({ status: 'loading', recaps: [], notCovered })

    void (async () => {
      const results = await Promise.all(
        targets.map(async (entry, index) => {
          const tournamentId = entry.tournamentId as string
          const profile = await fetchSeasonPlayerProfile(tournamentId, userId).catch(() => null)
          if (!profile) return null

          // Movement for the most relevant competition only. It is the
          // expensive half — one read to list the leagues and one per league —
          // and the workspace is where a player goes for the rest.
          let movements: {
            leagueId: string
            leagueName: string
            movement: Awaited<ReturnType<typeof fetchSeasonLeagueMovement>>
          }[] = []
          const predictor = entry.games.find((game) => game.gameKey === 'main_predictor')
          if (index === 0 && predictor) {
            const leagues = await fetchMyGameLeagues(predictor.id).catch(() => [])
            movements = (
              await Promise.all(
                leagues.slice(0, LEAGUE_LIMIT).map(async (league) => {
                  const movement = await fetchSeasonLeagueMovement(league.id).catch(() => null)
                  return movement
                    ? { leagueId: league.id, leagueName: league.name, movement }
                    : null
                }),
              )
            ).filter((row): row is NonNullable<typeof row> => row !== null)
          }

          return presentMatchweekRecap(
            entry.competition.seasonRowName,
            entry.competition.name,
            competitionRoute(entry.competition),
            profile,
            movements,
          )
        }),
      )

      if (!active) return
      setState({
        status: 'ready',
        recaps: results.filter((recap): recap is MatchweekRecap => recap !== null),
        notCovered,
      })
    })()

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, userId, player === null])

  return state
}
