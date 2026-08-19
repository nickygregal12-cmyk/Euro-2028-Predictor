import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChampionshipSource } from './championshipSource'

/**
 * ACQUIRE WHAT vNEXT PREDICTOR CHAMPIONSHIP NEEDS.
 *
 * This hook fetches and CLASSIFIES. `buildChampionshipModel` is the only thing
 * that turns an answer into something a page can draw, which is what makes
 * every mapping case testable with no Supabase, no auth and no network.
 *
 * ============================ ONE READ TODAY, SHAPED FOR MORE ============
 *
 * Contract 193 is the canonical bracket read. Contract 167's group stage and
 * contract 133's own-group view join it, and each will arrive with ITS OWN
 * outcome rather than a shared one — the discipline Stages 10 and 11 both
 * settled, for two reasons that apply here more than anywhere:
 *
 *   • the reads do not fail together. A bracket that will not load must not
 *     take the group table with it, and vice versa;
 *   • **they do not resolve the same window.** `get_season_cup_phase` picks the
 *     caller's membership row with no `order by` and no `limit`, and after a
 *     split that table holds two rows per player — so it may answer about the
 *     initial group while a sibling read answers about the split one. Two reads
 *     that can disagree must not be merged behind one "loaded".
 *
 * ============================ A RE-READ DOES NOT TEAR THE PAGE DOWN ======
 *
 * Stage 11 shipped a version that cleared state on every refresh, so the whole
 * page — including the competition shell — dropped to a skeleton and rebuilt
 * itself on the product's primary interaction. A re-read of the SAME identity
 * keeps its payload and raises `refreshing`; only a different identity clears,
 * because only then is what is on screen about a different competition.
 *
 * ============================ NOTHING HERE IS A CLOCK ====================
 *
 * `generatedAt` is stamped once per read and passed down as data. Note contract
 * 193 also returns `server_now` — the DATABASE's own clock — which is the
 * better instant wherever the two disagree and is carried through the read.
 */

export type VNextChampionshipSourceState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'noCompetition' }
  | { status: 'failed'; retry: () => void }
  | {
      status: 'ready'
      source: ChampionshipSource
      retry: () => void
      /** A re-read is in flight over a page that is still shown. */
      refreshing: boolean
    }

export type VNextChampionshipSourceInput = {
  readonly userId: string | null
  readonly authLoading: boolean
  readonly competitionSlug: string | undefined
  readonly seasonSlug: string | undefined
  /** Which Championship INSTANCE — a season can run several. */
  readonly championshipId: string | undefined
  /** The game's own name, as the host states it. */
  readonly gameName: string
}

type RequestIdentity = string

function requestIdentity(input: {
  userId: string
  competitionSlug: string
  seasonSlug: string
  championshipId: string
  gameName: string
}): RequestIdentity {
  return JSON.stringify([
    input.userId,
    input.competitionSlug,
    input.seasonSlug,
    input.championshipId,
    input.gameName,
  ])
}

type InternalState =
  | { status: 'idle' }
  | { status: 'failed'; identity: RequestIdentity }
  | { status: 'loaded'; identity: RequestIdentity; payload: ChampionshipSource }

const IDLE: InternalState = { status: 'idle' }

export function useVNextChampionshipSource(
  input: VNextChampionshipSourceInput,
): VNextChampionshipSourceState {
  const [state, setState] = useState<InternalState>(IDLE)
  const [refreshing, setRefreshing] = useState(false)
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((value) => value + 1), [])

  /**
   * THE IDENTITY OF THE PAYLOAD CURRENTLY IN STATE, READABLE FROM THE EFFECT.
   *
   * A ref rather than the state: reading `state` here would mean depending on
   * something this effect writes, and a functional `setState` updater cannot
   * answer it either — React invokes updaters in the RENDER phase, so a flag
   * assigned inside one is still false when the effect reads it.
   */
  const loadedIdentity = useRef<RequestIdentity | null>(null)

  const { userId, authLoading, competitionSlug, seasonSlug, championshipId, gameName } = input

  useEffect(() => {
    if (authLoading || !userId || !competitionSlug || !seasonSlug || !championshipId) {
      setState((current) => (current.status === 'idle' ? current : IDLE))
      return
    }

    const identity = requestIdentity({
      userId,
      competitionSlug,
      seasonSlug,
      championshipId,
      gameName,
    })

    let active = true

    // KEEP THE PAGE UP WHILE THE SAME PAGE RELOADS. See the header.
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

        const { fetchSeasonCupBracket } = await import(
          '../../../services/supabase/seasonCupBracket'
        )

        // ITS OWN CATCH, not one wrapped around a set. When the second and
        // third reads land they are issued concurrently beside this one, and a
        // `Promise.all` over unguarded promises discards an answer that already
        // arrived — the defect Stage 11's reviews found.
        const bracket = await fetchSeasonCupBracket(championshipId).catch(() => null)
        if (!active) return

        loadedIdentity.current = identity
        setRefreshing(false)
        setState({
          status: 'loaded',
          identity,
          payload: {
            // The one legitimate clock read on this path, stamped once and
            // passed down as data so the mapper stays pure.
            generatedAt: new Date().toISOString(),
            context: {
              tournamentId: context.tournamentId,
              competitionId: championshipId,
              competitionName: context.competitionName,
              seasonLabel: context.seasonLabel,
              gameName,
            },
            bracket: bracket === null ? { kind: 'failed' } : { kind: 'ok', bracket },
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
  }, [authLoading, userId, competitionSlug, seasonSlug, championshipId, gameName, nonce])

  return useMemo<VNextChampionshipSourceState>(() => {
    if (authLoading) return { status: 'loading' }
    if (!userId) return { status: 'signedOut' }
    if (!competitionSlug || !seasonSlug || !championshipId) return { status: 'noCompetition' }

    const identity = requestIdentity({
      userId,
      competitionSlug,
      seasonSlug,
      championshipId,
      gameName,
    })
    if (state.status === 'idle' || state.identity !== identity) return { status: 'loading' }
    // ONLY THE PLAY CONTEXT FAILS THE WHOLE PAGE. A failed bracket read is a
    // panel outcome, carried inside the payload, not a dead page.
    if (state.status === 'failed') return { status: 'failed', retry }

    return { status: 'ready', source: state.payload, retry, refreshing }
  }, [
    state,
    refreshing,
    authLoading,
    userId,
    competitionSlug,
    seasonSlug,
    championshipId,
    gameName,
    retry,
  ])
}
