import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SeasonClubFormTable } from '../../../services/supabase/seasonClubFormModel'
import type { CompetitionTableRow } from '../../../services/supabase/competitionTableModel'
import type { SeasonConsensus } from '../../../services/supabase/seasonConsensusModel'

/**
 * ACQUIRE WHAT THE vNEXT MATCH PREDICTOR NEEDS AROUND THE CARD.
 *
 * This hook resolves the competition season, decides which matchweek to open, and
 * fetches the three enrichments. It deliberately does NOT load the card: that is
 * `useSeasonMatchPredictor`'s job and it already owns the optimistic saving, the
 * save ordering, the conflict classification and the reload — reimplementing any
 * of it here would be the second, weaker implementation §28 of the brief warns
 * about. So this hook stops at the gateway, and `VNextPredictorCard` hands that
 * gateway to the existing hook.
 *
 * ONE REQUIRED CORE, THEN INDEPENDENT ENRICHMENTS, exactly as on the Home path.
 * The play context has to land first because every other read is addressed by the
 * tournament id it returns and the consensus needs the matchweek. After that
 * three reads go out at once under `Promise.allSettled`, so one rejection costs
 * one enrichment and never the page. A failed club-form read costs the predictor
 * its form strings; it does not cost a player their deadline.
 *
 * SUPABASE IS IMPORTED LAZILY, INSIDE THE EFFECT, copying the Home adapter's
 * reasoning exactly: `services/supabase/client` throws at module load without
 * configuration, so a module-scope import would drag credentials into the module
 * graph of anything that renders the predictor — including Storybook and the
 * deterministic tests. The visual tree must stay renderable without a database.
 *
 * A LOADED PAYLOAD BELONGS TO THE IDENTITY THAT ASKED FOR IT. Stage 6's rule,
 * kept rather than re-derived: the payload is stored WITH the identity that
 * addressed the reads, the public state is derived from the CURRENT inputs first,
 * and a payload whose identity no longer matches is not a payload — it is
 * loading. An effect cannot substitute for this, because an effect runs AFTER the
 * render that changed the inputs, and one render is enough to paint.
 *
 * THE CARD IS PROTECTED THE SAME WAY BY A DIFFERENT MEANS. `useSeasonMatchPredictor`
 * holds the card in its own state and keeps it across a gateway change until the
 * next load resolves. Rather than weaken or fork that hook, `VNextPredictorScreen`
 * gives the component that calls it a `key` of this identity, so a change of
 * account, competition or matchweek REMOUNTS it and there is no previous card to
 * outlive its inputs. The leak is made unrepresentable rather than merely
 * unlikely.
 */

export type VNextPredictorContextInput = {
  /** From the existing auth authority. Null means signed out. */
  userId: string | null
  /** True while auth is resolving; nothing may be decided yet. */
  authLoading: boolean
  /** What `get_season_play_context` is addressed by. */
  competitionSlug: string | undefined
  seasonSlug: string | undefined
  /**
   * A specific matchweek to open, where the caller names one.
   *
   * IT FALLS BACK RATHER THAN REFUSING, exactly as the legacy route does: an
   * out-of-range value opens the matchweek the application says is playable,
   * because a stale or shared link should land somewhere useful. The season's own
   * matchweek count is the bound and nothing here trusts the number into a read.
   */
  matchweek?: number | undefined
}

export type PredictorContextReady = {
  readonly status: 'ready'
  readonly identity: string
  readonly competition: {
    readonly tournamentId: string
    readonly name: string
    readonly seasonLabel: string
    readonly timeZone: string
    readonly matchweekCount: number
  }
  readonly matchweek: number
  readonly clubForm: SeasonClubFormTable | null
  readonly table: readonly CompetitionTableRow[] | null
  readonly consensus: SeasonConsensus | null
  /** Enrichments that did not answer, for the surface to be honest about. */
  readonly unavailable: readonly PredictorEnrichmentName[]
  readonly retry: () => void
}

export type PredictorContextState =
  | { readonly status: 'loading' }
  | { readonly status: 'signedOut' }
  /** Signed in, but no competition season named. Not a failure. */
  | { readonly status: 'noCompetition' }
  /** Resolved, and the season has no matchweek left to play. Not a failure. */
  | { readonly status: 'seasonOver'; readonly competitionName: string; readonly seasonLabel: string }
  | { readonly status: 'failed'; readonly title: string; readonly detail: string; readonly retry: () => void }
  | PredictorContextReady

export type PredictorEnrichmentName = 'clubForm' | 'table' | 'consensus'

type Payload = {
  readonly competition: PredictorContextReady['competition']
  readonly matchweek: number
  readonly clubForm: SeasonClubFormTable | null
  readonly table: readonly CompetitionTableRow[] | null
  readonly consensus: SeasonConsensus | null
  readonly unavailable: readonly PredictorEnrichmentName[]
}

type Internal =
  | { status: 'idle' }
  | { status: 'failed'; identity: string; title: string; detail: string }
  | { status: 'seasonOver'; identity: string; competitionName: string; seasonLabel: string }
  | { status: 'loaded'; identity: string; payload: Payload }

const IDLE: Internal = { status: 'idle' }

/**
 * WHICH REQUEST A PAYLOAD ANSWERS: the four inputs that ADDRESS these reads.
 *
 * JSON rather than a joined string, because a slug is user-visible text and a
 * separator can appear inside one — `a|b` and `a` + `|b` must not collide. That is
 * the Home adapter's stated reason and it is the same reason here.
 */
function requestIdentity(input: {
  userId: string
  competitionSlug: string
  seasonSlug: string
  matchweek: number | undefined
}): string {
  return JSON.stringify([
    input.userId,
    input.competitionSlug,
    input.seasonSlug,
    input.matchweek ?? null,
  ])
}

function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null
}

export function useVNextPredictorContext(
  input: VNextPredictorContextInput,
): PredictorContextState {
  const [state, setState] = useState<Internal>(IDLE)
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((value) => value + 1), [])

  const { userId, authLoading, competitionSlug, seasonSlug, matchweek } = input

  useEffect(() => {
    // Nothing to acquire, and nothing may be KEPT: a signed-out surface must not
    // still be holding the last signed-in player's matchweek in memory.
    if (authLoading || !userId || !competitionSlug || !seasonSlug) {
      setState((current) => (current.status === 'idle' ? current : IDLE))
      return
    }

    const identity = requestIdentity({ userId, competitionSlug, seasonSlug, matchweek })
    let active = true
    setState((current) => (current.status === 'idle' ? current : IDLE))

    void (async () => {
      try {
        const { createSeasonPlayContextGateway } = await import(
          '../../../services/supabase/seasonPlayContext'
        )

        // WAVE ONE. Every id below comes from here, so nothing else can start.
        const context = await createSeasonPlayContextGateway().load(competitionSlug, seasonSlug)
        if (!active) return

        if (context.matchweek === null) {
          setState({
            status: 'seasonOver',
            identity,
            competitionName: context.competitionName,
            seasonLabel: context.seasonLabel,
          })
          return
        }

        // The requested matchweek, bounded by the season's own count. Out of
        // range opens the playable one rather than refusing the page.
        const requested =
          matchweek !== undefined &&
          Number.isInteger(matchweek) &&
          matchweek >= 1 &&
          matchweek <= context.matchweekCount
            ? matchweek
            : context.matchweek

        // WAVE TWO. Three reads, concurrently, each allowed to fail alone.
        const [clubForm, table, consensus] = await Promise.allSettled([
          import('../../../services/supabase/seasonClubForm').then((module) =>
            module.fetchSeasonClubForm(context.tournamentId),
          ),
          import('../../../services/supabase/competitionTable').then((module) =>
            module.fetchCompetitionTable(context.tournamentId),
          ),
          import('../../../services/supabase/seasonConsensus').then((module) =>
            // A `ConsensusHiddenError` lands here as a rejection and is treated
            // as any other unavailable enrichment. That is correct: the server
            // refuses consensus before the matchweek locks, and "you may not see
            // this yet" and "we could not read it" both mean no crowd is shown.
            // Distinguishing them would be the browser holding an opinion about a
            // reveal rule.
            module.fetchSeasonConsensus(context.tournamentId, requested),
          ),
        ])
        if (!active) return

        const clubFormValue = settled(clubForm)
        const tableValue = settled(table)
        const consensusValue = settled(consensus)

        const unavailable: PredictorEnrichmentName[] = []
        if (clubFormValue === null) unavailable.push('clubForm')
        if (tableValue === null) unavailable.push('table')
        if (consensusValue === null) unavailable.push('consensus')

        setState({
          status: 'loaded',
          identity,
          payload: {
            competition: {
              tournamentId: context.tournamentId,
              name: context.competitionName,
              seasonLabel: context.seasonLabel,
              timeZone: context.timeZone,
              matchweekCount: context.matchweekCount,
            },
            matchweek: requested,
            clubForm: clubFormValue,
            table: tableValue?.rows ?? null,
            consensus: consensusValue,
            unavailable,
          },
        })
      } catch (error: unknown) {
        if (!active) return
        setState({
          status: 'failed',
          identity,
          title: 'This matchweek is unavailable',
          // The gateway's own message where it has one: an honest "unavailable"
          // needs to say which thing was unavailable.
          detail:
            error instanceof Error && error.message.length > 0
              ? error.message
              : 'We could not read this competition season just now.',
        })
      }
    })()

    return () => {
      active = false
    }
  }, [authLoading, userId, competitionSlug, seasonSlug, matchweek, nonce])

  /**
   * THE PUBLIC STATE IS DERIVED FROM THE CURRENT INPUTS, IN THIS ORDER, and the
   * order is the safety property. Auth, then the user, then the competition are
   * answered from what is true THIS RENDER — never from what acquisition last
   * stored — so signing out is `signedOut` on the very next render, before any
   * effect has run and while the previous payload is still in state. Only then
   * does stored state get a say, and only if its identity is the one being asked
   * about now.
   */
  return useMemo<PredictorContextState>(() => {
    if (authLoading) return { status: 'loading' }
    if (!userId) return { status: 'signedOut' }
    if (!competitionSlug || !seasonSlug) return { status: 'noCompetition' }

    const identity = requestIdentity({ userId, competitionSlug, seasonSlug, matchweek })
    if (state.status === 'idle' || state.identity !== identity) return { status: 'loading' }

    if (state.status === 'failed') {
      return { status: 'failed', title: state.title, detail: state.detail, retry }
    }
    if (state.status === 'seasonOver') {
      return {
        status: 'seasonOver',
        competitionName: state.competitionName,
        seasonLabel: state.seasonLabel,
      }
    }

    return { status: 'ready', identity, ...state.payload, retry }
  }, [state, authLoading, userId, competitionSlug, seasonSlug, matchweek, retry])
}
