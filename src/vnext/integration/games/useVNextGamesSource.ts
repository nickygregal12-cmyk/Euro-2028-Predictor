import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GamesSource } from './gamesSource'

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
