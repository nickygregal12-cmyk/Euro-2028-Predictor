import { useEffect, useState } from 'react'
import { createSeasonPlayContextGateway } from '../../services/supabase/seasonPlayContext'
import { createSeasonMatchPredictorRpcGateway } from '../../services/supabase/seasonMatchPredictor'
import { createSeasonLmsRpcGateway } from '../../services/supabase/seasonLms'
import { createSeasonCupPlayerViewRpcGateway } from '../../services/supabase/seasonCupPlayer'
import type { CompetitionGame } from '../../services/supabase/competitionGamesModel'
import { presentCompetitionWeek, type CompetitionWeek } from './competitionWeekModel'

/**
 * Load "what do I need to do this week?" for one competition season.
 *
 * IT ASKS ONLY ABOUT GAMES THE PLAYER HAS JOINED, and asks each game's own
 * read. Both season reads refuse a caller with no entry — `require_season_entry`
 * for the card, and the Last Man Standing round reports `entered: false` — so
 * calling them for a non-entrant would be spending a request to be told
 * something the membership read already said.
 *
 * ONE FAILURE FAILS THE WHOLE PANEL. A summary that quietly drops the game it
 * could not read tells a player "nothing to do" while a lock passes. Overview
 * says it could not assemble the week and points at the games instead — the
 * empty-versus-failed line the repeated browser-read contracts exist to hold.
 */

export type CompetitionWeekState = {
  week: CompetitionWeek | null
  loading: boolean
  failed: boolean
  timeZone: string
}

const IDLE: CompetitionWeekState = {
  week: null,
  loading: false,
  failed: false,
  timeZone: 'UTC',
}

export function useCompetitionWeek(
  competitionSlug: string | undefined,
  seasonSlug: string | undefined,
  games: readonly CompetitionGame[],
  /** Where each game's surface lives, when it has one. */
  hrefs: { matchPredictor: string | null; lms: string | null; championship: string | null },
  nonce: number,
): CompetitionWeekState {
  const [state, setState] = useState<CompetitionWeekState>(IDLE)

  const joinedMainPredictor = games.some(
    (game) => game.gameKey === 'main_predictor' && game.membership !== null,
  )
  const joinedLms = games.some(
    (game) => game.gameKey === 'last_man_standing' && game.membership !== null,
  )
  // The Championship the player is IN, by exact competition id. A season can
  // run several — contract 133's discovery exists because of it — so "the
  // Championship" is not a thing to search for by game key.
  const championshipId =
    games.find((game) => game.gameKey === 'predictor_cup' && game.membership !== null)?.id ?? null
  const matchPredictorHref = hrefs.matchPredictor
  const lmsHref = hrefs.lms
  const championshipHref = hrefs.championship

  useEffect(() => {
    if (!competitionSlug || !seasonSlug) return
    if (!joinedMainPredictor && !joinedLms && !championshipId) {
      setState(IDLE)
      return
    }

    let active = true
    setState({ ...IDLE, loading: true })

    void (async () => {
      try {
        const context = await createSeasonPlayContextGateway().load(competitionSlug, seasonSlug)

        const card =
          joinedMainPredictor && context.matchweek !== null
            ? await createSeasonMatchPredictorRpcGateway({
                tournamentId: context.tournamentId,
                competitionName: context.competitionName,
                seasonLabel: context.seasonLabel,
                timeZone: context.timeZone,
                now: () => new Date(),
              }).load(context.matchweek)
            : null

        const round = joinedLms
          ? await createSeasonLmsRpcGateway({ tournamentId: context.tournamentId }).load()
          : null

        const championship = championshipId
          ? await createSeasonCupPlayerViewRpcGateway({ competitionId: championshipId }).load()
          : null

        if (!active) return
        setState({
          week: presentCompetitionWeek({
            matchPredictor: card ? { page: card, href: matchPredictorHref } : null,
            lms: round ? { page: round, href: lmsHref } : null,
            championship: championship
              ? { view: championship, href: championshipHref }
              : null,
            now: new Date(),
          }),
          loading: false,
          failed: false,
          timeZone: context.timeZone,
        })
      } catch {
        if (active) setState({ ...IDLE, failed: true })
      }
    })()

    return () => {
      active = false
    }
  }, [
    competitionSlug,
    seasonSlug,
    joinedMainPredictor,
    joinedLms,
    championshipId,
    matchPredictorHref,
    lmsHref,
    championshipHref,
    nonce,
  ])

  return state
}
