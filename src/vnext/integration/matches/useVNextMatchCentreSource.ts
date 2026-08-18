import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MatchCentreSource } from './matchCentreSource'

/**
 * ACQUIRE ONE FIXTURE AND ITS CONTEXT, ADDRESSED BY THE FIXTURE ID ALONE.
 *
 * ============================ THE ADDRESSABILITY PROPERTY =================
 *
 * The fixture read starts from the FIXTURE ID and nothing else, and it does not
 * wait for the season context: contract 148 needs no tournament, no date and no
 * window. That is what makes a deep refresh resolve the same fixture, and what
 * makes a shared link work for a match outside any default window.
 *
 * The season context is fetched IN PARALLEL, and only for the season LABEL and
 * for whether the player can be sent to the Match Predictor. If it fails, the
 * page still draws the match — a Match Centre that could not open because a
 * second read failed would have thrown away the whole point of contract 148.
 *
 * ============================ FOUR READS, AND THE ONE DEPENDENCY ==========
 *
 *   1. contract 148, the fixture              — required, starts immediately
 *   1. contract 121, the play context         — parallel, optional
 *   2. contract 141, the season's club form   — needs the tournament id
 *   2. contract 160, the competition's table  — needs the tournament id
 *   3. contract 141, this pair's meetings     — needs BOTH team ids
 *
 * The meetings read is the only genuine chain, and the reason is structural
 * rather than lazy: `get_season_club_head_to_head` is addressed by two TEAM
 * IDS, and contract 148 sends club NAMES. The ids come from the form read, so
 * the join is by name on `public.teams.name` — the same column of the same
 * rows, which is why it is an equality on one source of truth rather than a
 * fuzzy match. `SeasonMatchCentreRoute` records the same reasoning for the same
 * join.
 *
 * ONE FIXTURE, ONE HEAD-TO-HEAD REQUEST. §20 permits exactly that here and
 * forbids it in a list, and the list's model has no field for it.
 *
 * ============================ EVERY ENRICHMENT FAILS ALONE ================
 *
 * `Promise.allSettled`, not `Promise.all`: one rejection in an `all` would
 * discard three good answers. A failed table costs the page its table and
 * nothing else.
 */

export type VNextMatchCentreSourceState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** The server refused the fixture, or it does not exist. A real answer. */
  | { status: 'notFound' }
  | { status: 'failed'; retry: () => void }
  | { status: 'ready'; source: MatchCentreSource; retry: () => void }

export type VNextMatchCentreSourceInput = {
  readonly userId: string | null
  readonly authLoading: boolean
  /** THE CANONICAL FIXTURE ID. The only thing this page is addressed by. */
  readonly fixtureId: string | undefined
  /**
   * The competition the player navigated from, for the season label and the
   * predictor link. OPTIONAL, because the fixture resolves without it.
   */
  readonly competitionSlug?: string | undefined
  readonly seasonSlug?: string | undefined
  /** Whether the host can act on a Match Predictor link at all. */
  readonly predictorReachable?: boolean | undefined
}

type RequestIdentity = string

function requestIdentity(userId: string, fixtureId: string): RequestIdentity {
  return JSON.stringify([userId, fixtureId])
}

type InternalState =
  | { status: 'idle' }
  | { status: 'failed'; identity: RequestIdentity }
  | { status: 'notFound'; identity: RequestIdentity }
  | { status: 'loaded'; identity: RequestIdentity; payload: MatchCentreSource }

const IDLE: InternalState = { status: 'idle' }

function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null
}

export function useVNextMatchCentreSource(
  input: VNextMatchCentreSourceInput,
): VNextMatchCentreSourceState {
  const [state, setState] = useState<InternalState>(IDLE)
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((value) => value + 1), [])

  const { userId, authLoading, fixtureId, competitionSlug, seasonSlug } = input
  const predictorReachable = input.predictorReachable ?? false

  useEffect(() => {
    if (authLoading || !userId || !fixtureId) {
      setState((current) => (current.status === 'idle' ? current : IDLE))
      return
    }

    const identity = requestIdentity(userId, fixtureId)
    let active = true
    setState((current) => (current.status === 'idle' ? current : IDLE))

    void (async () => {
      try {
        const [{ fetchSeasonFixture }, { createSeasonPlayContextGateway }] = await Promise.all([
          import('../../../services/supabase/seasonFixtureList'),
          import('../../../services/supabase/seasonPlayContext'),
        ])

        // THE FIXTURE AND THE CONTEXT GO OUT TOGETHER. The fixture does not
        // wait for a season it does not need.
        const [answer, context] = await Promise.allSettled([
          fetchSeasonFixture(fixtureId),
          competitionSlug && seasonSlug
            ? createSeasonPlayContextGateway().load(competitionSlug, seasonSlug)
            : Promise.resolve(null),
        ])
        if (!active) return

        // The server REFUSES a fixture that does not exist or belongs to the
        // tournament shape, so a rejection here is a real answer: this match
        // cannot be opened. It is not "something went wrong".
        if (answer.status === 'rejected') {
          setState({ status: 'notFound', identity })
          return
        }
        const fixture = answer.value.fixture
        if (fixture === null) {
          setState({ status: 'notFound', identity })
          return
        }

        const tournamentId = settled(context)?.tournamentId ?? null
        const seasonLabel = settled(context)?.seasonLabel ?? null

        // WAVE TWO. Both addressed by the tournament id, both allowed to fail.
        const [form, table] = await Promise.allSettled([
          tournamentId === null
            ? Promise.resolve(null)
            : import('../../../services/supabase/seasonClubForm').then((module) =>
                module.fetchSeasonClubForm(tournamentId),
              ),
          tournamentId === null
            ? Promise.resolve(null)
            : import('../../../services/supabase/competitionTable').then((module) =>
                module.fetchCompetitionTable(tournamentId),
              ),
        ])
        if (!active) return

        const clubForm = settled(form)
        const homeId = clubForm?.clubs.find((club) => club.name === fixture.home.name)?.teamId ?? null
        const awayId = clubForm?.clubs.find((club) => club.name === fixture.away.name)?.teamId ?? null

        // WAVE THREE. ONE call, for this pair, on this page only.
        const headToHead =
          tournamentId === null || homeId === null || awayId === null
            ? null
            : await import('../../../services/supabase/seasonClubForm')
                .then((module) =>
                  module.fetchSeasonClubHeadToHead(tournamentId, homeId, awayId),
                )
                .catch(() => null)
        if (!active) return

        setState({
          status: 'loaded',
          identity,
          payload: {
            // The one legitimate clock read on this path, stamped once.
            generatedAt: new Date().toISOString(),
            fixture,
            competition: answer.value.competition,
            seasonLabel,
            colours: null,
            serverNow: answer.value.serverNow,
            clubForm,
            table: settled(table),
            headToHead,
            // Offered only where the host can act on it, and only for a player
            // whose competition context actually resolved.
            predictorReachable: predictorReachable && tournamentId !== null,
          },
        })
      } catch {
        if (active) setState({ status: 'failed', identity })
      }
    })()

    return () => {
      active = false
    }
  }, [
    authLoading,
    userId,
    fixtureId,
    competitionSlug,
    seasonSlug,
    predictorReachable,
    nonce,
  ])

  return useMemo<VNextMatchCentreSourceState>(() => {
    if (authLoading) return { status: 'loading' }
    if (!userId) return { status: 'signedOut' }
    if (!fixtureId) return { status: 'notFound' }

    const identity = requestIdentity(userId, fixtureId)
    if (state.status === 'idle' || state.identity !== identity) return { status: 'loading' }
    if (state.status === 'failed') return { status: 'failed', retry }
    if (state.status === 'notFound') return { status: 'notFound' }

    return { status: 'ready', source: state.payload, retry }
  }, [state, authLoading, userId, fixtureId, retry])
}
