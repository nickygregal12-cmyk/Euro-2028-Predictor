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
 * ============================ THE WRITE IS NOT HERE YET =================
 *
 * `join_competition_game` is the authority for entry and this hook does not
 * call it. The surface emits `join-game` and the host decides — which is what
 * lets the hub be reviewed, and pointed at real data, before anything can be
 * joined from it by accident.
 */

export type VNextGamesSourceInput = {
  readonly userId: string | null
  readonly authLoading: boolean
  readonly competitionSlug: string | undefined
  readonly seasonSlug: string | undefined
}

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
  const retry = useCallback(() => setNonce((value) => value + 1), [])
  const loadedIdentity = useRef<RequestIdentity | null>(null)

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

  return useMemo<VNextGamesSourceState>(() => {
    if (authLoading) return { status: 'loading' }
    if (!userId) return { status: 'signedOut' }
    if (!competitionSlug || !seasonSlug) return { status: 'noCompetition' }

    const identity = requestIdentity(userId, competitionSlug, seasonSlug)
    if (state.status === 'loaded' && state.identity === identity) {
      return { status: 'ready', source: state.payload, retry, refreshing }
    }
    if (state.status === 'failed' && state.identity === identity) {
      return { status: 'failed', retry }
    }
    return { status: 'loading' }
  }, [authLoading, userId, competitionSlug, seasonSlug, state, retry, refreshing])
}
