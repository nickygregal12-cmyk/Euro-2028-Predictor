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
 * ============================ THE ONE WRITE, THROUGH THE ONE AUTHORITY ===
 *
 * `submit_cup_penalty_number`, and nothing else. The refusal taxonomy is
 * `championshipRefusal.ts`'s and the conflict classifier is
 * `writeConflict.ts`'s — BOTH SHARED, neither restated here. Stage 11 shipped a
 * hook that matched one SQLSTATE out of five while a complete map sat beside
 * the write, and the symptom was a player told to retry a submission that could
 * never succeed.
 *
 * A SUCCESSFUL SUBMISSION RE-READS rather than patching the model. The write
 * moves the version, and the version is the gateway's concern rather than the
 * page's — the presentation model has no field for it.
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

/**
 * WHERE A SUBMITTED PENALTY NUMBER GOT TO.
 *
 * `idle` covers "nothing submitted yet" and "the last one landed", because a
 * landed submission is visible in the model itself — the value comes back on
 * the next read — and a banner repeating it would be a second place to look.
 *
 * THREE OUTCOMES, KEPT APART, and the reasons differ:
 *
 *   • **conflict** — `PT409`. Somebody else wrote a Penalty Number for this
 *     round while this page held an older version. Resolved by RE-READING,
 *     never by retrying with the same version.
 *   • **refused** — a rule the player met, classified by the shared
 *     `isChampionshipRefusal`. The page's view is STALE rather than wrong, so
 *     it re-reads and carries the refusal's own sentence.
 *   • **failed** — anything else. A fault, and the only one where "try again"
 *     is a sensible suggestion on its own.
 */
type ChampionshipWriteState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  /** `PT409`: changed elsewhere. Resolved by re-reading, never by retrying. */
  | { readonly kind: 'conflict' }
  /** The server declined it on its own rules, with the shared sentence. */
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'failed'; readonly message: string }

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
      /** Submit the caller's Penalty Number for the round they are in. */
      submitPenaltyNumber: (value: number) => void
      penaltyNumber: ChampionshipWriteState
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
  const [penaltyNumber, setPenaltyNumber] = useState<ChampionshipWriteState>({ kind: 'idle' })
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

        const [{ fetchSeasonCupBracket }, { fetchSeasonCupGroupStage }] = await Promise.all([
          import('../../../services/supabase/seasonCupBracket'),
          import('../../../services/supabase/seasonCupGroupStage'),
        ])

        // A CATCH PER PROMISE, not one wrapped around the pair. The two reads
        // are issued concurrently and neither is the other's precondition — a
        // Championship in its group phase has a table and no bracket — so a
        // `Promise.all` over unguarded promises would discard an answer that
        // already arrived. That is the defect Stage 11's reviews found, and the
        // shape they settled on.
        const [bracket, groupStage] = await Promise.all([
          fetchSeasonCupBracket(championshipId).catch(() => null),
          fetchSeasonCupGroupStage(championshipId).catch(() => null),
        ])
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
            groupStage:
              groupStage === null ? { kind: 'failed' } : { kind: 'ok', groupStage },
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

  /**
   * SUBMIT, AND THEN RE-READ WHATEVER HAPPENED.
   *
   * A landed write, a conflict and a refusal ALL re-read, because in all three
   * the page's view of the round is provably behind the server's. Only a fault
   * leaves the page alone, because in that case nothing changed.
   */
  const submitPenaltyNumber = useCallback(
    (value: number) => {
      const loaded = state.status === 'loaded' ? state.payload : null
      const answer = loaded?.bracket.kind === 'ok' ? loaded.bracket.bracket : null
      const pn = answer !== null && answer.entered ? answer.penaltyNumber : null
      // NO WINDOW, NO WRITE. The id comes from the read rather than from a
      // caller, so a page with no live tie has nothing to submit against —
      // Stage 9's identity rule and Stage 11's pick rule, once more.
      if (loaded === null || pn === null) return

      setPenaltyNumber({ kind: 'saving' })
      void (async () => {
        try {
          const { submitCupPenaltyNumber } = await import('../../../services/supabase/cup')
          await submitCupPenaltyNumber(
            loaded.context.competitionId,
            pn.windowId,
            value,
            pn.version,
          )
          setPenaltyNumber({ kind: 'idle' })
          setNonce((current) => current + 1)
        } catch (error) {
          const { isVersionConflict } = await import('../../../services/supabase/writeConflict')
          const { championshipRefusal, isChampionshipRefusal } = await import(
            '../../../features/season/championshipRefusal'
          )
          if (isVersionConflict(error)) {
            setPenaltyNumber({ kind: 'conflict' })
            setNonce((current) => current + 1)
            return
          }
          if (isChampionshipRefusal(error)) {
            setPenaltyNumber({ kind: 'refused', message: championshipRefusal(error) })
            setNonce((current) => current + 1)
            return
          }
          // A FAULT CHANGES NOTHING, so the page is left exactly as it was.
          setPenaltyNumber({ kind: 'failed', message: championshipRefusal(error) })
        }
      })()
    },
    [state],
  )

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

    return {
      status: 'ready',
      source: state.payload,
      retry,
      refreshing,
      submitPenaltyNumber,
      penaltyNumber,
    }
  }, [
    state,
    refreshing,
    submitPenaltyNumber,
    penaltyNumber,
    authLoading,
    userId,
    competitionSlug,
    seasonSlug,
    championshipId,
    gameName,
    retry,
  ])
}
