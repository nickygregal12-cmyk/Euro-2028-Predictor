import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DiscoverySource } from './discoverySource'

/**
 * ACQUIRE WHAT vNEXT DISCOVERY NEEDS, AND PERFORM ITS ONE WRITE.
 *
 * ============================ TWO READS, AND ONLY ONE OWNS THE PAGE =====
 *
 * The catalogue failing empties the page; the preferences failing does not, so
 * they are issued concurrently with a catch per promise and classified apart.
 *
 * ============================ THE WRITE, AND WHY IT NEVER SENDS A FOLLOW
 * FOR SOMETHING ALREADY FOLLOWED =========================================
 *
 * `set_competition_follow` upserts and its favourite argument defaults to null,
 * so a follow re-sent for a competition already followed CLEARS the player's
 * favourite club. The surface offers no toggle, and this hook does not make one
 * either: `follow` and `unfollow` are separate calls, and a `follow` is only
 * ever emitted from a row the model marked `not-following` with the follow
 * state KNOWN.
 *
 * A SUCCESSFUL WRITE RE-READS rather than patching the model, so the follow set
 * on screen is the server's rather than this lane's guess at what it became.
 */

export type VNextDiscoverySourceInput = {
  readonly userId: string | null
  readonly authLoading: boolean
}

/**
 * Not exported: the state is reachable through
 * `VNextDiscoverySourceState`, and an export nothing imports is a widened
 * surface for free.
 */
type DiscoveryWriteState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving'; readonly tournamentId: string }
  | { readonly kind: 'failed'; readonly message: string }

export type VNextDiscoverySourceState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | {
      status: 'ready'
      source: DiscoverySource
      retry: () => void
      refreshing: boolean
      setFollowing: (tournamentId: string, following: boolean) => void
      write: DiscoveryWriteState
    }

type RequestIdentity = string
type InternalState =
  | { status: 'idle' }
  | { status: 'loaded'; identity: RequestIdentity; payload: DiscoverySource }

const IDLE: InternalState = { status: 'idle' }

export function useVNextDiscoverySource(
  input: VNextDiscoverySourceInput,
): VNextDiscoverySourceState {
  const [state, setState] = useState<InternalState>(IDLE)
  const [refreshing, setRefreshing] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [write, setWrite] = useState<DiscoveryWriteState>({ kind: 'idle' })
  const retry = useCallback(() => setNonce((value) => value + 1), [])
  const loadedIdentity = useRef<RequestIdentity | null>(null)

  const { userId, authLoading } = input

  useEffect(() => {
    if (authLoading || !userId) {
      setState((current) => (current.status === 'idle' ? current : IDLE))
      return
    }

    const identity = userId
    let active = true

    const kept = loadedIdentity.current === identity
    if (!kept) loadedIdentity.current = null
    setState((current) => {
      if (current.status === 'idle') return current
      if (current.identity === identity) return current
      return IDLE
    })
    setRefreshing(kept)

    void (async () => {
      const [catalogueModule, preferencesModule] = await Promise.all([
        import('../../../services/supabase/weeklyCatalogue'),
        import('../../../services/supabase/playerPreferences'),
      ])
      if (!active) return

      // A CATCH PER PROMISE. Neither is the other's precondition.
      const [catalogue, preferences] = await Promise.all([
        catalogueModule.fetchPublishedWeeklySeasons().catch(() => null),
        preferencesModule.fetchPlayerPreferences().catch(() => null),
      ])
      if (!active) return

      loadedIdentity.current = identity
      setRefreshing(false)
      setState({
        status: 'loaded',
        identity,
        payload: {
          generatedAt: new Date().toISOString(),
          catalogue: catalogue === null ? { kind: 'failed' } : { kind: 'ok', seasons: catalogue },
          preferences:
            preferences === null ? { kind: 'failed' } : { kind: 'ok', preferences },
        },
      })
    })()

    return () => {
      active = false
    }
  }, [authLoading, userId, nonce])

  const setFollowing = useCallback(
    (tournamentId: string, following: boolean) => {
      setWrite({ kind: 'saving', tournamentId })
      void (async () => {
        try {
          const { setCompetitionFollow } = await import(
            '../../../services/supabase/playerPreferences'
          )
          // THE FAVOURITE ARGUMENT IS LEFT AT ITS NULL DEFAULT ON PURPOSE, and
          // it is safe ONLY because this is never a re-follow: the surface
          // emits `follow` for a row it knows is not followed, and `unfollow`
          // deletes the row outright.
          await setCompetitionFollow(tournamentId, following)
          setWrite({ kind: 'idle' })
          setNonce((value) => value + 1)
        } catch (error) {
          const { userFacingError } = await import('../../../shared/errors/userFacingError')
          setWrite({ kind: 'failed', message: userFacingError(error) })
        }
      })()
    },
    [],
  )

  return useMemo<VNextDiscoverySourceState>(() => {
    if (authLoading) return { status: 'loading' }
    if (!userId) return { status: 'signedOut' }
    if (state.status === 'loaded' && state.identity === userId) {
      return { status: 'ready', source: state.payload, retry, refreshing, setFollowing, write }
    }
    return { status: 'loading' }
  }, [authLoading, userId, state, retry, refreshing, setFollowing, write])
}
