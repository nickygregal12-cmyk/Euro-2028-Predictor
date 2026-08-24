import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GamesSource } from './gamesSource'
import {
  isActiveMembership,
  type CompetitionGame,
  type SeasonGames,
} from '../../../services/supabase/competitionGamesModel'
import type { CompetitionWeek } from '../../../features/hub/competitionWeekModel'
import type { SeasonPlayContext } from '../../../features/season/seasonPlayContextModel'

/**
 * ACQUIRE WHAT vNEXT GAMES NEEDS.
 *
 * Fetches and CLASSIFIES; `buildGamesModel` is the only thing that turns an
 * answer into something a page can draw.
 *
 * ============================ ONE READ, AND NO SECOND CLOCK =============
 *
 * `get_competition_games` carries the catalogue, the caller's membership in
 * each game AND `server_now`. Nothing here stamps a clock over that: the hook
 * supplies `generatedAt` only as the fallback for a read that answered without
 * one, and the mapper prefers the server's instant. A device an hour fast would
 * otherwise offer a registration that has closed.
 *
 * ============================ THE WRITE, AND WHERE ITS RULES LIVE =======
 *
 * `join_competition_game` is the authority for entry, and this hook calls it
 * and adds NOTHING to it. Every registration rule — the window, rejoin,
 * disqualification, private containers, rate limiting — is the server's, and
 * the surface only ever offers Join where the SERVER's own registration
 * outlook said it was open. Re-deciding any of that here would be a second
 * answer, and it would be the copy that goes stale.
 *
 * NO REGISTRATION IS INFERRED FROM A BROWSER CLOCK. The outlook the button is
 * drawn from resolves against `server_now`, and this hook never compares one.
 *
 * A SUCCESSFUL JOIN RE-READS. The row becomes "You are playing" because
 * `get_competition_games` says the membership exists, not because this lane
 * patched its own copy — the same discipline Discovery's follow write follows,
 * and the reason a join that half-succeeded cannot leave a row claiming
 * otherwise.
 *
 * DUPLICATE PRESSES ARE SUPPRESSED IN FLIGHT. One join at a time, named by the
 * game, so a second press on the same row does nothing and a press on another
 * row is not blocked by the first.
 */

export type VNextGamesSourceInput = {
  readonly userId: string | null
  readonly authLoading: boolean
  readonly competitionSlug: string | undefined
  readonly seasonSlug: string | undefined
}

/**
 * Not exported: it is reachable through `VNextGamesSourceState`, and an export
 * nothing imports is a widened surface for free.
 */
type GamesWriteState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'joining'; readonly gameId: string }
  /**
   * THE FAILURE NAMES ITS ROW, for the same reason the busy state does: a
   * message with no game attached can only be drawn somewhere general, and the
   * row is where the player pressed.
   */
  | { readonly kind: 'failed'; readonly gameId: string; readonly message: string }

export type VNextGamesSourceState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'noCompetition' }
  | { status: 'failed'; retry: () => void }
  | {
      status: 'ready'
      source: GamesSource
      retry: () => void
      refreshing: boolean
      join: (gameId: string) => void
      write: GamesWriteState
    }

type RequestIdentity = string

function requestIdentity(userId: string, competitionSlug: string, seasonSlug: string): RequestIdentity {
  return JSON.stringify([userId, competitionSlug, seasonSlug])
}

type InternalState =
  | { status: 'idle' }
  | { status: 'failed'; identity: RequestIdentity }
  | { status: 'loaded'; identity: RequestIdentity; payload: GamesSource }

const IDLE: InternalState = { status: 'idle' }

export function useVNextGamesSource(input: VNextGamesSourceInput): VNextGamesSourceState {
  const [state, setState] = useState<InternalState>(IDLE)
  const [refreshing, setRefreshing] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [write, setWrite] = useState<GamesWriteState>({ kind: 'idle' })
  const retry = useCallback(() => setNonce((value) => value + 1), [])
  const loadedIdentity = useRef<RequestIdentity | null>(null)
  /**
   * IN FLIGHT, IN A REF AND NOT IN STATE. `write` is what the surface draws;
   * this is what the second press is tested against, and a state read inside
   * the callback would be the value from the render that created it — so two
   * fast presses would both pass the guard and send two joins.
   */
  const joining = useRef<string | null>(null)

  const { userId, authLoading, competitionSlug, seasonSlug } = input

  useEffect(() => {
    if (authLoading || !userId || !competitionSlug || !seasonSlug) {
      setState((current) => (current.status === 'idle' ? current : IDLE))
      return
    }

    const identity = requestIdentity(userId, competitionSlug, seasonSlug)
    let active = true

    const kept = loadedIdentity.current === identity
    if (!kept) loadedIdentity.current = null
    setState((current) => {
      if (current.status === 'idle') return current
      if (current.status === 'loaded' && current.identity === identity) return current
      return IDLE
    })
    setRefreshing(kept)

    void (async () => {
      try {
        const { createSeasonPlayContextGateway } = await import(
          '../../../services/supabase/seasonPlayContext'
        )
        const context = await createSeasonPlayContextGateway().load(competitionSlug, seasonSlug)
        if (!active) return

        const { fetchSeasonGames } = await import(
          '../../../services/supabase/competitionGames'
        )
        // ITS OWN CATCH. The play context failing fails the page — there is no
        // competition to be in. The games read failing is a PANEL outcome.
        const games = await fetchSeasonGames(context.tournamentId).catch(() => null)
        if (!active) return

        // THE WEEK, FROM EACH GAME'S OWN READ.
        //
        // WHAT IT COSTS, STATED PLAINLY. This is a THIRD wave, and the page
        // had two. The catalogue is what says which games this player is
        // actually in, so these reads cannot be issued before it answers — but
        // they are all issued together once it has, so the cost is one round
        // trip rather than three. A row that asks "pick your club" has to know
        // whether a pick is in, and only the round read knows that; the
        // catalogue answers membership and registration and nothing about the
        // week, so there is no cheaper place to get this.
        //
        // A PLAYER WHO HAS JOINED NOTHING PAYS NOTHING. `loadWeekFor` returns
        // before issuing anything when no membership is active, which is the
        // ordinary state on a catalogue a player is browsing.
        //
        // EACH FAILS ALONE, and a failure is indistinguishable from "not in
        // this game" on purpose: both leave the row with no action, which draws
        // it as a destination. `DFA-006`'s rule is that a card must not dress a
        // passive state as a task, and a read that did not answer is the most
        // passive state there is.
        const week = games === null ? null : await loadWeekFor(context, games)
        if (!active) return

        loadedIdentity.current = identity
        setRefreshing(false)
        setState({
          status: 'loaded',
          identity,
          payload: {
            // The fallback only. The mapper prefers the read's `server_now`.
            generatedAt: new Date().toISOString(),
            context: {
              tournamentId: context.tournamentId,
              competitionName: context.competitionName,
              seasonLabel: context.seasonLabel,
            },
            games: games === null ? { kind: 'failed' } : { kind: 'ok', games },
            week,
          },
        })
      } catch {
        if (!active) return
        loadedIdentity.current = null
        setRefreshing(false)
        setState({ status: 'failed', identity })
      }
    })()

    return () => {
      active = false
    }
  }, [authLoading, userId, competitionSlug, seasonSlug, nonce])

  const join = useCallback((gameId: string) => {
    // ONE AT A TIME. A double press, or a press on a second row while the first
    // is still out, sends nothing — `join_competition_game` is not idempotent
    // in what it reports back, and two entries into one game is not a state the
    // player asked for.
    if (joining.current !== null) return
    joining.current = gameId
    setWrite({ kind: 'joining', gameId })

    void (async () => {
      try {
        const { joinCompetitionGame } = await import(
          '../../../services/supabase/competitionGames'
        )
        await joinCompetitionGame(gameId)
        joining.current = null
        // SUCCESS CLEARS THE OLD ANSWER AND RE-READS. The row becomes "You are
        // playing" because the catalogue says so.
        setWrite({ kind: 'idle' })
        setNonce((value) => value + 1)
      } catch (error) {
        const { userFacingError } = await import('../../../shared/errors/userFacingError')
        joining.current = null
        setWrite({ kind: 'failed', gameId, message: userFacingError(error) })
      }
    })()
  }, [])

  return useMemo<VNextGamesSourceState>(() => {
    if (authLoading) return { status: 'loading' }
    if (!userId) return { status: 'signedOut' }
    if (!competitionSlug || !seasonSlug) return { status: 'noCompetition' }

    const identity = requestIdentity(userId, competitionSlug, seasonSlug)
    if (state.status === 'loaded' && state.identity === identity) {
      return { status: 'ready', source: state.payload, retry, refreshing, join, write }
    }
    if (state.status === 'failed' && state.identity === identity) {
      return { status: 'failed', retry }
    }
    return { status: 'loading' }
  }, [authLoading, userId, competitionSlug, seasonSlug, state, retry, refreshing, join, write])
}

/**
 * THE PLAYER'S WEEK IN THIS COMPETITION, FROM EACH GAME'S OWN READ.
 *
 * THE PLAY CONTEXT IS PASSED IN, NEVER RE-READ. Wave one already loaded it to
 * get the tournament id, and it carries the matchweek, the competition name,
 * the season label and the calendar zone that the Match Predictor gateway needs
 * to resolve its own deadline. Fetching it again here would be a second read of
 * an answer already in hand.
 *
 * ONLY THE GAMES THEY ARE ACTUALLY IN. `isActiveMembership` is the same gate
 * `loadCompetitionWeek` applies, for the same stated reason: both season reads
 * refuse or report-empty for a non-entrant, so asking spends a request to be
 * told what the catalogue in hand already said.
 *
 * CONCURRENT, AND EACH ALLOWED TO FAIL ALONE. `Promise.allSettled` rather than
 * `all`, so an unreadable Championship costs its own row's wording and nothing
 * else on the page. `loadCompetitionWeek` deliberately does the opposite — it
 * throws, because Overview refuses to render a partial panel — and this surface
 * has a different rule: a games CATALOGUE is still worth showing when one
 * game's week could not be read.
 *
 * IT COMPUTES NOTHING. Ordering, outstanding-ness and every sentence come from
 * `presentCompetitionWeek`, which is why a card here and Home cannot disagree.
 */
async function loadWeekFor(
  context: SeasonPlayContext,
  games: SeasonGames,
): Promise<CompetitionWeek | null> {
  const joined = (key: CompetitionGame['gameKey']) =>
    games.games.some((game) => game.gameKey === key && isActiveMembership(game))

  const championshipId =
    games.games.find((game) => game.gameKey === 'predictor_cup' && isActiveMembership(game))?.id ??
    null

  const wantsCard = joined('main_predictor') && context.matchweek !== null
  const wantsLms = joined('last_man_standing')
  if (!wantsCard && !wantsLms && championshipId === null) return null

  const [card, lms, championship] = await Promise.allSettled([
    wantsCard && context.matchweek !== null
      ? import('../../../services/supabase/seasonMatchPredictor').then((module) =>
          module
            .createSeasonMatchPredictorRpcGateway({
              tournamentId: context.tournamentId,
              competitionName: context.competitionName,
              seasonLabel: context.seasonLabel,
              timeZone: context.timeZone,
              now: () => new Date(),
            })
            .load(context.matchweek as number),
        )
      : Promise.resolve(null),
    wantsLms
      ? import('../../../services/supabase/seasonLms').then((module) =>
          module.createSeasonLmsRpcGateway({ tournamentId: context.tournamentId }).load(),
        )
      : Promise.resolve(null),
    championshipId === null
      ? Promise.resolve(null)
      : import('../../../services/supabase/seasonCupPlayer').then((module) =>
          module.createSeasonCupPlayerViewRpcGateway({ competitionId: championshipId }).load(),
        ),
  ])

  const cardPage = card.status === 'fulfilled' ? card.value : null
  const lmsPage = lms.status === 'fulfilled' ? lms.value : null
  const championshipView = championship.status === 'fulfilled' ? championship.value : null
  if (cardPage === null && lmsPage === null && championshipView === null) return null

  const { presentCompetitionWeek } = await import('../../../features/hub/competitionWeekModel')
  return presentCompetitionWeek({
    matchPredictor: cardPage ? { page: cardPage, href: null } : null,
    lms: lmsPage ? { page: lmsPage, href: null } : null,
    championship: championshipView ? { view: championshipView, href: null } : null,
    now: new Date(),
  })
}
