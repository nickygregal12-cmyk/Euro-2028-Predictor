import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PrivateLmsSource } from './privateLmsSource'

// Not exported: the source hands out `picking` inside its own view type.
type PrivateLmsPickState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'failed' }

export type VNextPrivateLmsSourceState =
  | { readonly status: 'loading' }
  | { readonly status: 'signedOut' }
  | { readonly status: 'noCompetition' }
  | { readonly status: 'failed'; readonly retry: () => void }
  | {
      readonly status: 'ready'
      readonly source: PrivateLmsSource
      readonly retry: () => void
      readonly pick: (teamId: string) => void
      readonly picking: PrivateLmsPickState
      readonly refreshing: boolean
    }

export type VNextPrivateLmsSourceInput = {
  readonly userId: string | null
  readonly authLoading: boolean
  readonly competitionSlug: string | undefined
  readonly seasonSlug: string | undefined
  readonly privateCompetitionId: string | null
}

type Identity = string

type InternalState =
  | { readonly status: 'idle' }
  | { readonly status: 'failed'; readonly identity: Identity }
  | { readonly status: 'loaded'; readonly identity: Identity; readonly source: PrivateLmsSource }

const DAY = 24 * 60 * 60 * 1000
const IDLE: InternalState = { status: 'idle' }

function identityOf(input: {
  userId: string
  competitionSlug: string
  seasonSlug: string
  privateCompetitionId: string
}): Identity {
  return JSON.stringify([
    input.userId,
    input.competitionSlug,
    input.seasonSlug,
    input.privateCompetitionId,
  ])
}

function fixtureWindow(round: {
  opensAt: string | null
  locksAt: string | null
}): { from: string; to: string } | null {
  if (round.locksAt === null) return null
  const lock = Date.parse(round.locksAt)
  if (!Number.isFinite(lock)) return null
  const opens = round.opensAt === null ? lock - 14 * DAY : Date.parse(round.opensAt)
  const start = Number.isFinite(opens) ? Math.min(opens, lock) - DAY : lock - 14 * DAY
  return {
    from: new Date(start).toISOString(),
    to: new Date(lock + 14 * DAY).toISOString(),
  }
}

async function loadSource(input: {
  competitionSlug: string
  seasonSlug: string
  privateCompetitionId: string
}): Promise<PrivateLmsSource> {
  const [contextModule, { fetchPrivateCompetitionWorkspace }] = await Promise.all([
    import('../../../services/supabase/seasonPlayContext'),
    import('../../../services/supabase/privateCompetitionWorkspace'),
  ])
  const [context, workspace] = await Promise.all([
    contextModule.createSeasonPlayContextGateway().load(input.competitionSlug, input.seasonSlug),
    fetchPrivateCompetitionWorkspace(input.privateCompetitionId),
  ])

  if (
    workspace.competition.gameKey !== 'last_man_standing' ||
    workspace.competition.tournamentId !== context.tournamentId ||
    (workspace.competition.seasonKey !== null && workspace.competition.seasonKey !== input.seasonSlug)
  ) {
    throw new Error('That private competition does not belong to this Last Man Standing season.')
  }

  const me = workspace.members.find((member) => member.isMe) ?? null
  const round = workspace.currentRound
  const needsChoices =
    round !== null &&
    workspace.caller.membershipStatus === 'active' &&
    me !== null &&
    me.outcome !== 'eliminated' &&
    me.hasPickedCurrentRound !== true &&
    !round.locked

  if (!needsChoices) {
    return {
      generatedAt: new Date().toISOString(),
      context,
      workspace,
      fixtures: null,
      clubs: [],
    }
  }

  const window = fixtureWindow(round)
  if (window === null || round.label === null) {
    return {
      generatedAt: new Date().toISOString(),
      context,
      workspace,
      fixtures: null,
      clubs: [],
    }
  }

  const { fetchSeasonFixtureList } = await import('../../../services/supabase/seasonFixtureList')
  const list = await fetchSeasonFixtureList(context.tournamentId, window)
  const ordinals = new Set(
    list.fixtures
      .filter((fixture) => fixture.round.label === round.label)
      .map((fixture) => fixture.round.ordinal),
  )
  if (ordinals.size !== 1) {
    throw new Error('The private Last Man Standing round could not be matched to one season matchweek.')
  }
  const matchweek = [...ordinals][0]
  if (matchweek === undefined) {
    throw new Error('The private Last Man Standing round has no season matchweek.')
  }

  const [{ fetchSeasonMatchweekFixtures }, { fetchSeasonTeamIds }] = await Promise.all([
    import('../../../services/supabase/seasonFixtures'),
    import('../../../services/supabase/seasonTeamIds'),
  ])
  const [fixtures, clubs] = await Promise.all([
    fetchSeasonMatchweekFixtures(context.tournamentId, matchweek),
    fetchSeasonTeamIds(context.tournamentId),
  ])

  return {
    generatedAt: new Date().toISOString(),
    context,
    workspace,
    fixtures,
    clubs,
  }
}

export function useVNextPrivateLmsSource(
  input: VNextPrivateLmsSourceInput,
): VNextPrivateLmsSourceState {
  const [state, setState] = useState<InternalState>(IDLE)
  const [picking, setPicking] = useState<PrivateLmsPickState>({ kind: 'idle' })
  const [refreshing, setRefreshing] = useState(false)
  const [nonce, setNonce] = useState(0)
  const loadedIdentity = useRef<Identity | null>(null)
  /**
   * STATE DRAWS THE BUSY BUTTON; THIS REF GUARDS THE WRITE.
   *
   * Two input events can arrive before React has committed the render that
   * changes `picking` to `saving`. A state-only guard therefore leaves a tiny
   * window in which both callbacks still see `idle` and send two first-pick
   * writes. The ref closes synchronously before the promise begins, while the
   * visible state remains the source for what the page draws.
   */
  const pickInFlight = useRef(false)
  const retry = useCallback(() => setNonce((value) => value + 1), [])

  const { userId, authLoading, competitionSlug, seasonSlug, privateCompetitionId } = input

  useEffect(() => {
    if (authLoading || !userId || !competitionSlug || !seasonSlug || !privateCompetitionId) {
      setState((current) => (current.status === 'idle' ? current : IDLE))
      loadedIdentity.current = null
      return
    }

    const identity = identityOf({ userId, competitionSlug, seasonSlug, privateCompetitionId })
    const kept = loadedIdentity.current === identity
    setRefreshing(kept)
    if (!kept) setState(IDLE)
    let active = true

    void loadSource({ competitionSlug, seasonSlug, privateCompetitionId })
      .then((source) => {
        if (!active) return
        loadedIdentity.current = identity
        setRefreshing(false)
        setState({ status: 'loaded', identity, source })
      })
      .catch(() => {
        if (!active) return
        loadedIdentity.current = null
        setRefreshing(false)
        setState({ status: 'failed', identity })
      })

    return () => {
      active = false
    }
  }, [authLoading, userId, competitionSlug, seasonSlug, privateCompetitionId, nonce])

  const pick = useCallback(
    (teamId: string) => {
      if (state.status !== 'loaded' || picking.kind === 'saving' || pickInFlight.current) return
      const round = state.source.workspace.currentRound
      if (round === null) return
      const competitionId = state.source.workspace.competition.id

      pickInFlight.current = true
      setPicking({ kind: 'saving' })
      void (async () => {
        try {
          const [{ saveLmsSelection }, { fetchPrivateCompetitionWorkspace }] = await Promise.all([
            import('../../../services/supabase/lms'),
            import('../../../services/supabase/privateCompetitionWorkspace'),
          ])
          await saveLmsSelection(round.windowId, teamId, null)

          // SUCCESS IS AN AUTHORITATIVE REREAD, not the mutation response. The
          // workspace does not reveal the club, but it does state whether THIS
          // caller has a stored pick in THIS private round. That is enough to
          // prove the write landed and to prevent a second first-pick write.
          const verified = await fetchPrivateCompetitionWorkspace(competitionId)
          const me = verified.members.find((member) => member.isMe) ?? null
          if (
            verified.currentRound?.windowId !== round.windowId ||
            me?.hasPickedCurrentRound !== true
          ) {
            throw new Error('The private Last Man Standing pick could not be verified after saving.')
          }

          pickInFlight.current = false
          setPicking({ kind: 'idle' })
          setNonce((value) => value + 1)
        } catch (error) {
          const [{ isVersionConflict }, { isLmsRefusal, lmsRefusal }] = await Promise.all([
            import('../../../services/supabase/writeConflict'),
            import('../../../services/supabase/seasonLms'),
          ])
          pickInFlight.current = false
          if (isVersionConflict(error)) {
            setPicking({ kind: 'conflict' })
            setNonce((value) => value + 1)
            return
          }
          if (isLmsRefusal(error)) {
            setPicking({ kind: 'refused', reason: lmsRefusal(error) })
            setNonce((value) => value + 1)
            return
          }
          setPicking({ kind: 'failed' })
        }
      })()
    },
    [state, picking.kind],
  )

  return useMemo<VNextPrivateLmsSourceState>(() => {
    if (authLoading) return { status: 'loading' }
    if (!userId) return { status: 'signedOut' }
    if (!competitionSlug || !seasonSlug || !privateCompetitionId) {
      return { status: 'noCompetition' }
    }

    const identity = identityOf({ userId, competitionSlug, seasonSlug, privateCompetitionId })
    if (state.status === 'idle' || state.identity !== identity) return { status: 'loading' }
    if (state.status === 'failed') return { status: 'failed', retry }
    return {
      status: 'ready',
      source: state.source,
      retry,
      pick,
      picking,
      refreshing,
    }
  }, [
    authLoading,
    userId,
    competitionSlug,
    seasonSlug,
    privateCompetitionId,
    state,
    retry,
    pick,
    picking,
    refreshing,
  ])
}