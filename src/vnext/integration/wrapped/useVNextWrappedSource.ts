import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WrappedSource } from './wrappedSource'

/**
 * ACQUIRE WHAT vNEXT SEASON WRAPPED NEEDS. IT PERFORMS NO WRITE.
 *
 * ============================ TWO READS, IN ORDER ========================
 *
 * The play context resolves the competition season from the route slugs, and
 * its `tournamentId` is what `get_season_wrapped` is addressed by — so the
 * second read cannot start until the first has answered. There is nothing to
 * parallelise here.
 *
 * ============================ AND THE ARCHIVE'S "NOT YET" SURVIVES =======
 *
 * `get_season_wrapped` answers `{ finalised: false }` for a season that has not
 * ended, and that is carried through as a VALUE rather than caught as an
 * absence. Only a thrown read becomes `wrapped: null`. Collapsing the two would
 * tell a player in the middle of a season that something had gone wrong.
 */

export type VNextWrappedSourceInput = {
  readonly userId: string | null
  readonly authLoading: boolean
  readonly competitionSlug: string | undefined
  readonly seasonSlug: string | undefined
  /** The reader's own name, from the auth authority. Null is ordinary. */
  readonly playerName: string | null
}

export type VNextWrappedSourceState =
  | { readonly status: 'loading' }
  | { readonly status: 'signedOut' }
  | { readonly status: 'noCompetition' }
  | { readonly status: 'failed'; readonly retry: () => void }
  | { readonly status: 'ready'; readonly source: WrappedSource; readonly retry: () => void }

type RequestIdentity = string

function requestIdentity(input: {
  userId: string
  competitionSlug: string
  seasonSlug: string
}): RequestIdentity {
  return JSON.stringify([input.userId, input.competitionSlug, input.seasonSlug])
}

type InternalState =
  | { status: 'idle' }
  | { status: 'failed'; identity: RequestIdentity }
  /** `playerName` is merged at the derivation, so it is absent from the payload. */
  | {
      status: 'loaded'
      identity: RequestIdentity
      payload: Omit<WrappedSource, 'playerName'>
    }

const IDLE: InternalState = { status: 'idle' }

export function useVNextWrappedSource(
  input: VNextWrappedSourceInput,
): VNextWrappedSourceState {
  const [state, setState] = useState<InternalState>(IDLE)
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((value) => value + 1), [])

  const { userId, authLoading, competitionSlug, seasonSlug, playerName } = input

  useEffect(() => {
    // Nothing to acquire, and nothing may be kept: a signed-out surface must
    // not still hold the last signed-in player's season in memory.
    if (authLoading || !userId || !competitionSlug || !seasonSlug) {
      setState((current) => (current.status === 'idle' ? current : IDLE))
      return
    }

    const identity = requestIdentity({ userId, competitionSlug, seasonSlug })
    let active = true
    setState((current) => (current.status === 'idle' ? current : IDLE))

    void (async () => {
      try {
        const { createSeasonPlayContextGateway } = await import(
          '../../../services/supabase/seasonPlayContext'
        )
        const context = await createSeasonPlayContextGateway().load(competitionSlug, seasonSlug)
        if (!active) return

        // THE ARCHIVE'S ANSWER, INCLUDING "NOT YET". Only a throw becomes null;
        // `{ finalised: false }` is a value and reaches the mapper unchanged.
        const wrapped = await import('../../../services/supabase/seasonWrapped')
          .then((module) => module.fetchSeasonWrapped(context.tournamentId))
          .catch(() => null)
        if (!active) return

        setState({
          status: 'loaded',
          identity,
          payload: {
            // The one legitimate clock read on this path, stamped once and
            // passed down as data so nothing below reads a clock.
            generatedAt: new Date().toISOString(),
            competitionName: context.competitionName,
            seasonLabel: context.seasonLabel,
            wrapped,
          },
        })
      } catch {
        // The context read failed, so there is no season to be wrapped ABOUT.
        // That is a different failure from an unreadable archive and it is the
        // one that has no page.
        if (active) setState({ status: 'failed', identity })
      }
    })()

    return () => {
      active = false
    }
    // `playerName` is DELIBERATELY ABSENT. It addresses no read, and including
    // it would re-issue both reads when a display name arrived late.
  }, [authLoading, userId, competitionSlug, seasonSlug, nonce])

  /**
   * DERIVED FROM THE CURRENT INPUTS, IN THIS ORDER, and the order is the safety
   * property: auth, then the user, then the competition are answered from what
   * is true THIS RENDER. Only then does stored state get a say, and only if its
   * identity is the one being asked about now.
   */
  return useMemo<VNextWrappedSourceState>(() => {
    if (authLoading) return { status: 'loading' }
    if (!userId) return { status: 'signedOut' }
    if (!competitionSlug || !seasonSlug) return { status: 'noCompetition' }

    const identity = requestIdentity({ userId, competitionSlug, seasonSlug })
    if (state.status === 'idle' || state.identity !== identity) return { status: 'loading' }
    if (state.status === 'failed') return { status: 'failed', retry }

    return { status: 'ready', source: { ...state.payload, playerName }, retry }
  }, [state, authLoading, userId, competitionSlug, seasonSlug, playerName, retry])
}
