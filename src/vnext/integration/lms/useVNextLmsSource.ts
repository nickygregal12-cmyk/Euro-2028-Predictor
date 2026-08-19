import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LmsSource } from './lmsSource'

/**
 * ACQUIRE THE ROUND vNEXT LAST MAN STANDING NEEDS, AND SUBMIT THE ONE PICK.
 *
 * This hook fetches, writes and CLASSIFIES. `buildLmsModel` is the only thing
 * that turns an answer into something a page can draw, which is what makes
 * every mapping case testable with no Supabase, no auth and no network.
 *
 * ============================ IT IS THE FIRST vNEXT SURFACE THAT WRITES ==
 *
 * Stages 8, 9 and 10 read. This one submits a pick, through
 * `save_lms_selection` and NOTHING ELSE — no new mutation, no second path, no
 * client-side eligibility check standing in for the server's. The gateway owns
 * the window id and the version; this hook owns neither, and the presentation
 * model has no field for either.
 *
 * ============================ THREE WAYS A WRITE CAN NOT SUCCEED, AND THEY
 * ARE THREE DIFFERENT SENTENCES ============================================
 *
 *   • **conflict** — SQLSTATE `PT409`. The selection was changed elsewhere
 *     while this page held an older version. `isVersionConflict` is the shared
 *     classifier and it lives beside the write contract it describes; this lane
 *     reuses it rather than writing a second copy, for the reason Stage 10
 *     learned when a privacy predicate nearly got duplicated.
 *   • **refused** — `check_violation` / `23514`. The server declined the pick
 *     on its own rules: the round locked, the club was already spent, the entry
 *     is not eligible. The page's view is STALE rather than wrong, and the
 *     honest response is to re-read rather than to argue.
 *   • **failed** — anything else. A fault, and the only one where "try again"
 *     is a sensible suggestion on its own.
 *
 * THE FIRST TWO ARE WHY THE LOCK JUDGEMENT BEING A PRESENTATION CALL IS SAFE.
 * The mapper decides which controls to OFFER from the server's instants; the
 * server decides which picks to ACCEPT. When a clock disagreement puts those
 * two out of step, the player gets a sentence and a fresh read — never a
 * silent no-op, and never a pick they believe landed.
 *
 * ============================ A SUCCESSFUL PICK RE-READS =================
 *
 * Rather than patching the model locally. The write changes the version, the
 * selection and possibly the eligibility of everything else on screen, and the
 * server is the only thing that knows the new truth. An optimistic update here
 * would be a second authority on eligibility, which is the one thing this stage
 * is built to avoid.
 *
 * ============================ NOTHING HERE IS A CLOCK ====================
 *
 * `generatedAt` is stamped once per read and passed down as data, so the
 * instant the lock is judged against is the instant the round was read at —
 * not a moment that drifts as the component re-renders.
 */

/**
 * WHERE A SUBMITTED PICK GOT TO.
 *
 * `idle` covers "nothing submitted yet" and "the last one landed", because a
 * landed pick is visible in the model itself — the club is marked `chosen` —
 * and a banner repeating it would be a second place to look.
 */
export type LmsPickState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  /** `PT409`: changed elsewhere. Resolved by re-reading, never by retrying. */
  | { readonly kind: 'conflict' }
  /** The server declined it on its own rules. The page is stale, not wrong. */
  | { readonly kind: 'refused' }
  | { readonly kind: 'failed' }

export type VNextLmsSourceState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'noCompetition' }
  | { status: 'failed'; retry: () => void }
  | {
      status: 'ready'
      source: LmsSource
      retry: () => void
      /** Submit the one pick. The only write this lane makes. */
      pick: (teamId: string) => void
      picking: LmsPickState
    }

export type VNextLmsSourceInput = {
  readonly userId: string | null
  readonly authLoading: boolean
  readonly competitionSlug: string | undefined
  readonly seasonSlug: string | undefined
  /** The game's own name, as the host states it. */
  readonly gameName: string
}

type RequestIdentity = string

function requestIdentity(input: {
  userId: string
  competitionSlug: string
  seasonSlug: string
  gameName: string
}): RequestIdentity {
  // Everything the stored payload describes, as Stage 10 settled: the address
  // of the read AND the game name it is drawn under.
  return JSON.stringify([
    input.userId,
    input.competitionSlug,
    input.seasonSlug,
    input.gameName,
  ])
}

type InternalState =
  | { status: 'idle' }
  | { status: 'failed'; identity: RequestIdentity }
  | { status: 'loaded'; identity: RequestIdentity; payload: LmsSource }

const IDLE: InternalState = { status: 'idle' }

export function useVNextLmsSource(input: VNextLmsSourceInput): VNextLmsSourceState {
  const [state, setState] = useState<InternalState>(IDLE)
  const [picking, setPicking] = useState<LmsPickState>({ kind: 'idle' })
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((value) => value + 1), [])

  const { userId, authLoading, competitionSlug, seasonSlug, gameName } = input

  /**
   * THE GATEWAY, HELD ACROSS RENDERS.
   *
   * It is stateful on purpose — it remembers the window id and the version its
   * last load reported, so a write can carry them. A gateway rebuilt per render
   * would forget the version and every save would look like a first one.
   */
  const gateway = useRef<{
    identity: RequestIdentity
    value: { load: () => Promise<unknown>; pick: (teamId: string) => Promise<void> }
  } | null>(null)

  useEffect(() => {
    if (authLoading || !userId || !competitionSlug || !seasonSlug) {
      setState((current) => (current.status === 'idle' ? current : IDLE))
      return
    }

    const identity = requestIdentity({ userId, competitionSlug, seasonSlug, gameName })

    let active = true
    setState((current) => (current.status === 'idle' ? current : IDLE))

    void (async () => {
      try {
        const { createSeasonPlayContextGateway } = await import(
          '../../../services/supabase/seasonPlayContext'
        )
        const context = await createSeasonPlayContextGateway().load(competitionSlug, seasonSlug)
        if (!active) return

        const { createSeasonLmsRpcGateway } = await import(
          '../../../services/supabase/seasonLms'
        )
        // ONE GATEWAY PER IDENTITY. Rebuilding it on a retry is correct — the
        // version it holds came from the read it is about to replace.
        const lms = createSeasonLmsRpcGateway({ tournamentId: context.tournamentId })
        gateway.current = { identity, value: lms }

        const page = await lms.load().catch(() => null)
        if (!active) return

        setState({
          status: 'loaded',
          identity,
          payload: {
            // The one legitimate clock read on this path, stamped once and
            // passed down as data — so the instant the lock is judged against
            // is the instant the round was read at.
            generatedAt: new Date().toISOString(),
            context: {
              tournamentId: context.tournamentId,
              competitionName: context.competitionName,
              seasonLabel: context.seasonLabel,
              gameName,
            },
            read: page === null ? { kind: 'failed' } : { kind: 'ok', page },
          },
        })
      } catch {
        if (active) setState({ status: 'failed', identity })
      }
    })()

    return () => {
      active = false
    }
  }, [authLoading, userId, competitionSlug, seasonSlug, gameName, nonce])

  const pick = useCallback(
    (teamId: string) => {
      const held = gateway.current
      if (held === null) return

      setPicking({ kind: 'saving' })
      void (async () => {
        const { isVersionConflict } = await import(
          '../../../services/supabase/writeConflict'
        )
        try {
          await held.value.pick(teamId)
          // RE-READ RATHER THAN PATCH. The write moved the version, the
          // selection, and possibly what else is eligible; only the server
          // knows the new truth, and guessing it here would make this lane a
          // second authority on eligibility.
          setPicking({ kind: 'idle' })
          setNonce((value) => value + 1)
        } catch (error) {
          if (isVersionConflict(error)) {
            // Changed elsewhere. Re-read so the player sees what is true now;
            // retrying the same write would only lose the race again.
            setPicking({ kind: 'conflict' })
            setNonce((value) => value + 1)
            return
          }
          setPicking(refused(error) ? { kind: 'refused' } : { kind: 'failed' })
          // A refusal means this page's view of the round is stale — the lock
          // moved, or the club was spent elsewhere — so it re-reads too.
          if (refused(error)) setNonce((value) => value + 1)
        }
      })()
    },
    [],
  )

  return useMemo<VNextLmsSourceState>(() => {
    if (authLoading) return { status: 'loading' }
    if (!userId) return { status: 'signedOut' }
    if (!competitionSlug || !seasonSlug) return { status: 'noCompetition' }

    const identity = requestIdentity({ userId, competitionSlug, seasonSlug, gameName })
    if (state.status === 'idle' || state.identity !== identity) return { status: 'loading' }
    if (state.status === 'failed') return { status: 'failed', retry }

    return { status: 'ready', source: state.payload, retry, pick, picking }
  }, [state, picking, authLoading, userId, competitionSlug, seasonSlug, gameName, retry, pick])
}

/**
 * THE SERVER DECLINED THE PICK ON ITS OWN RULES.
 *
 * `check_violation` / `23514` is what contract 86's trigger raises for a lock,
 * a spent club or an ineligible entry — `writeConflict.ts` documents that
 * split, and it is the reason a conflict and a refusal are told apart at all.
 * Neither is a fault, and neither is answered by pressing the same button.
 */
function refused(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === '23514' || code === 'check_violation'
}
