import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MatchesSource } from './matchesSource'

/**
 * ACQUIRE THE FOOTBALL vNEXT MATCHES NEEDS, through the reads that own it.
 *
 * This hook fetches and nothing else. `buildMatchesModel` is the only thing
 * that turns an answer into something a page can draw, which is what makes the
 * mapping testable with no Supabase, no auth and no network — and it is why
 * every state case in `tests/vnext/matchesIntegration.test.ts` needs no mocking
 * at all.
 *
 * ============================ TWO READS, IN TWO WAVES =====================
 *
 * The play context has to land first because contract 139 is addressed by the
 * tournament id it returns. After that there is ONE read. That is the whole
 * acquisition: a fixture list is football, is the same for everybody, discloses
 * nothing about any player, and needs no membership check beyond being signed
 * in.
 *
 * ============================ NO N+1, BY CONSTRUCTION =====================
 *
 * A window of ten fixtures costs TWO round trips in total. Not ten head-to-head
 * calls, not twenty club reads, not ten prediction reads and not ten table
 * reads — because `MatchListItem` has a field for none of them and the source
 * carries none of them. §39's audit is a property of the shape rather than a
 * measurement that could drift.
 *
 * ============================ SUPABASE IS IMPORTED LAZILY =================
 *
 * Inside the effect, copying `useVNextHomeSource` exactly:
 * `services/supabase/client` throws at module load without configuration, so a
 * module-scope import would drag credentials into the graph of anything that
 * renders Matches — including Storybook and the deterministic tests. The visual
 * tree must stay renderable without a database.
 *
 * ============================ A PAYLOAD BELONGS TO ITS REQUEST ============
 *
 * The competition slugs ADDRESS the read, so a payload held in React state
 * outlives the inputs that produced it, and an effect cannot help — it runs
 * AFTER the render that changed them. For exactly one render a hook that
 * trusted its own stored payload would compose the PREVIOUS competition's
 * fixtures with the CURRENT competition's name and call it ready. One render is
 * enough to paint, and a Premier League page showing Scottish fixtures is a
 * defect a reader would report as data corruption.
 *
 * So the payload is stored WITH the identity that addressed it, and a payload
 * whose identity no longer matches is not a payload — it is loading.
 */

export type VNextMatchesSourceState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** Signed in, but no competition season to show. Not a failure. */
  | { status: 'noCompetition' }
  | { status: 'failed'; retry: () => void }
  | {
      status: 'ready'
      source: MatchesSource
      retry: () => void
    }

export type VNextMatchesSourceInput = {
  /** From the existing auth authority. Null means signed out. */
  readonly userId: string | null
  /** True while auth is still resolving; Matches must not decide anything yet. */
  readonly authLoading: boolean
  readonly competitionSlug: string | undefined
  readonly seasonSlug: string | undefined
  /**
   * How many competitions this player is in, where the host knows. Decides
   * whether the scope control is offered at all — see `matchesSource.ts`.
   */
  readonly playerCompetitionCount?: number | null | undefined
}

type RequestIdentity = string

function requestIdentity(input: {
  userId: string
  competitionSlug: string
  seasonSlug: string
}): RequestIdentity {
  // JSON rather than a joined string: a slug is user-visible text and a
  // separator can appear inside one. `a|b` and `a` + `|b` must not collide.
  return JSON.stringify([input.userId, input.competitionSlug, input.seasonSlug])
}

type Loaded = {
  status: 'loaded'
  identity: RequestIdentity
  payload: MatchesSource
}

type InternalState =
  | { status: 'idle' }
  | { status: 'failed'; identity: RequestIdentity }
  | Loaded

const IDLE: InternalState = { status: 'idle' }

export function useVNextMatchesSource(
  input: VNextMatchesSourceInput,
): VNextMatchesSourceState {
  const [state, setState] = useState<InternalState>(IDLE)
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((value) => value + 1), [])

  const { userId, authLoading, competitionSlug, seasonSlug } = input
  const playerCompetitionCount = input.playerCompetitionCount ?? null

  useEffect(() => {
    if (authLoading || !userId || !competitionSlug || !seasonSlug) {
      setState((current) => (current.status === 'idle' ? current : IDLE))
      return
    }

    const identity = requestIdentity({ userId, competitionSlug, seasonSlug })
    let active = true
    setState((current) => (current.status === 'idle' ? current : IDLE))

    void (async () => {
      try {
        const [{ createSeasonPlayContextGateway }, { fetchSeasonFixtureList }] =
          await Promise.all([
            import('../../../services/supabase/seasonPlayContext'),
            import('../../../services/supabase/seasonFixtureList'),
          ])

        // WAVE ONE. Contract 139 is addressed by the id this returns.
        const context = await createSeasonPlayContextGateway().load(competitionSlug, seasonSlug)
        if (!active) return

        // WAVE TWO. One read, and the server chooses its own window — the
        // browser holding a copy of the default would disagree with the server
        // the first time either changed.
        const list = await fetchSeasonFixtureList(context.tournamentId)
        if (!active) return

        setState({
          status: 'loaded',
          identity,
          payload: {
            // ONE INSTANT FOR THE WHOLE MODEL, stamped once here where a clock
            // read is legitimate, and passed down as data. Nothing in the
            // mapper or in any component reads a clock.
            generatedAt: new Date().toISOString(),
            competition: {
              tournamentId: context.tournamentId,
              name: context.competitionName,
              seasonLabel: context.seasonLabel,
              // No read holds a competition palette. Null is honest; the shell
              // paints its neutral atmosphere rather than a borrowed one.
              colours: null,
            },
            window: list.window,
            serverNow: list.serverNow,
            fixtures: list.fixtures,
            competitionRead: list.competition,
            playerCompetitionCount,
            // CONTRACT 197 IS NOT REACHABLE FROM THE BROWSER YET. See
            // `matchesSource.ts` for the full position: the read exists in the
            // repository and is pending on hosted development, so it is absent
            // from the generated types. Nothing is invented to fill it.
            combined: null,
          },
        })
      } catch {
        if (active) setState({ status: 'failed', identity })
      }
    })()

    return () => {
      active = false
    }
  }, [authLoading, userId, competitionSlug, seasonSlug, playerCompetitionCount, nonce])

  /**
   * THE PUBLIC STATE IS DERIVED FROM THE CURRENT INPUTS, IN THIS ORDER, and the
   * order is the safety property: auth, then the user, then the competition are
   * answered from what is true THIS RENDER — never from what acquisition last
   * stored. Only then does stored state get a say, and only if its identity is
   * the one being asked about now.
   */
  return useMemo<VNextMatchesSourceState>(() => {
    if (authLoading) return { status: 'loading' }
    if (!userId) return { status: 'signedOut' }
    if (!competitionSlug || !seasonSlug) return { status: 'noCompetition' }

    const identity = requestIdentity({ userId, competitionSlug, seasonSlug })
    if (state.status === 'idle' || state.identity !== identity) return { status: 'loading' }
    if (state.status === 'failed') return { status: 'failed', retry }

    return { status: 'ready', source: state.payload, retry }
  }, [state, authLoading, userId, competitionSlug, seasonSlug, retry])
}
