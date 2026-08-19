import { useEffect, useState } from 'react'
import { competitionGameRoute, competitionMatchPredictorRoute } from '../../app/weeklyRoutes'
import { isNextUi } from '../../app/routeFlags'
import type { PlayerCompetitions } from './playerCompetitions'
import { presentPlayInbox, type PlayInbox, type PlayInboxEntry } from './playInboxModel'

/**
 * Load every competition's week and assemble the cross-competition inbox.
 *
 * THE COMPETITIONS ARE LOADED CONCURRENTLY AND SETTLED INDEPENDENTLY. On a
 * twenty-competition platform a player relevant to three issues three sets of
 * reads, not twenty: the list comes from `PlayerCompetitions`, which is already
 * bounded by what the player actually plays. `allSettled`, so one competition's
 * failure names that competition rather than emptying the page.
 *
 * DESTINATIONS ARE RESOLVED HERE, not in the model, because whether a game has
 * a surface is a routing fact — the Match Predictor is behind a flag and its
 * route answers Not Found while that flag is off, so an action for it carries
 * no link rather than a dead one.
 */

export type GlobalPlayInboxState = {
  status: 'idle' | 'loading' | 'ready'
  inbox: PlayInbox | null
}

export function useGlobalPlayInbox(player: PlayerCompetitions | null): GlobalPlayInboxState {
  const [state, setState] = useState<GlobalPlayInboxState>({ status: 'idle', inbox: null })
  // The identity of the set being loaded, so the effect re-runs when the
  // player's competitions change and not on every re-render of the object.
  const key = (player?.mine ?? []).map((entry) => entry.competition.seasonRowName).join('|')

  useEffect(() => {
    if (player === null) return
    if (player.mine.length === 0) {
      setState({ status: 'ready', inbox: presentPlayInbox([], new Date()) })
      return
    }

    let active = true
    setState({ status: 'loading', inbox: null })

    void (async () => {
      const results = await Promise.allSettled(
        player.mine.map(async (entry) => {
          const ref = entry.competition
          const hrefs = {
            matchPredictor: isNextUi('seasonMatchPredictor')
              ? competitionMatchPredictorRoute(ref)
              : null,
            lms: competitionGameRoute(ref, 'lms'),
            championship: competitionGameRoute(ref, 'championship'),
          }
          const { loadCompetitionWeek } = await import('./loadCompetitionWeek')
          const loaded = await loadCompetitionWeek(
            ref.competitionSlug,
            ref.seasonSlug,
            entry.games,
            hrefs,
          )
          return { entry, loaded }
        }),
      )

      if (!active) return

      const entries: PlayInboxEntry[] = results.map((result, index) => {
        const competition = player.mine[index]?.competition
        if (result.status === 'fulfilled') {
          return {
            // The play context's own answer, which is the id every season read
            // is addressed by. It is preferred over the catalogue's copy for
            // the same reason the week is: it came back with this answer.
            tournamentId: result.value.loaded.tournamentId,
            competitionName: result.value.entry.competition.name,
            seasonLabel: result.value.entry.competition.seasonLabel,
            week: result.value.loaded.week,
          }
        }
        return {
          // THE FAILED CASE STILL HAS AN ID, because it comes from the
          // catalogue rather than from the read that failed. That is what lets
          // a surface offer to take the player to the competition it could not
          // read, instead of only naming it.
          tournamentId: competition?.tournamentId ?? '',
          competitionName: competition?.name ?? 'A competition',
          seasonLabel: competition?.seasonLabel ?? '',
          week: null,
        }
      })

      setState({ status: 'ready', inbox: presentPlayInbox(entries, new Date()) })
    })()

    return () => {
      active = false
    }
    // `key` stands in for the competition set; `player` itself is a new object
    // on every provider render and would restart the loads for ever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, player === null])

  return state
}
