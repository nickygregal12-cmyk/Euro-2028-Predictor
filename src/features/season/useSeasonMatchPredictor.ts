import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SaveStatus } from '../../domain/saveCoordinator'
import type { ScorelinePrediction } from '../../domain/season/scoring'
import { createSaveController, type SaveController } from '../../app/providers/saveController'
import {
  reportOperationFailure,
  serverCodeOf,
} from '../../services/observability/operationFailure'
import { isVersionConflict } from '../../services/supabase/writeConflict'
import {
  createPredictionDraftStore,
  type DraftStorage,
  type PredictionDraft,
  type PredictionDraftScope,
} from '../../services/offline/predictionDraftStore'
import {
  applyBatchResult,
  pendingDrafts,
  presentDrafts,
  removeDraft,
  retryDraft,
  upsertDraft,
  type DraftsView,
} from './predictionDraftModel'
import {
  type CardPresentation,
  type MatchPredictorCommand,
  type MatchPredictorGateway,
  type MatchPredictorPage,
  commandRefusal,
  presentCard,
} from './matchPredictorModel'

/**
 * Season matchweek state, saved optimistically, with conflict recovery.
 *
 * WHY THIS IS NOT A CONSUMER OF `PredictionsProvider`. That provider is keyed on
 * a single `tournament.id`, calls the tournament RPCs (`upsertMatchPrediction`,
 * `replace_predicted_progression`, `submit_entry`) and enforces the tournament
 * Joker allowance. None of that serves a season, and widening it would put two
 * competitions' write rules in one object — which ADR 0011's separation law
 * exists to prevent. What IS reused is everything one level down: the pure
 * ordering machine in `domain/saveCoordinator`, its impure runner in
 * `app/providers/saveController`, and `isVersionConflict`. So there is one
 * save-ordering implementation in the repository, with two callers.
 *
 * OPTIMISTIC, AND NOT ROLLED BACK. A local edit applies immediately and stays
 * applied through a failure, matching the tournament flow: silently reverting a
 * player's typing is worse than showing a save that is retrying, because the
 * player cannot tell a revert from having mistyped. What a failure changes is
 * the save status, which is rendered per fixture.
 *
 * A VERSION CONFLICT IS TERMINAL. The coordinator classifies it as
 * non-retryable, and this hook surfaces it as `conflict_requires_refresh` — the
 * one state in §12.1 that any load can reach. Recovery is an explicit reload,
 * because the page is knowingly showing data the server has already changed and
 * guessing which side wins is exactly what a conflict means we cannot do.
 */

/**
 * `INNOV-020`. What the hook needs to draft offline, injected rather than
 * reached for.
 *
 * ABSENT MEANS OFF, AND OFF IS THE DEFAULT. Every existing caller — the
 * development fixture gateway, the component tests, the harnesses — passes
 * nothing and behaves exactly as before. Offline drafting is a progressive
 * enhancement of the prediction screen, not a rebuild of it.
 */
export type OfflineDraftingOptions = {
  storage: DraftStorage
  /** Who and where. The user id is what stops one account seeing another's. */
  scope: PredictionDraftScope
  /** Device clock, for the "saved on this device" line only. Never a lock. */
  now: () => Date
  /** Whether the device believes it has a connection. Presentation only. */
  isOnline: () => boolean
  /** Subscribe to the device regaining a connection. Returns an unsubscribe. */
  subscribeOnline: (listener: () => void) => () => void
}

export type SeasonMatchPredictorView = {
  status: 'loading' | 'ready' | 'failed'
  page: MatchPredictorPage | null
  presentation: CardPresentation | null
  /** Save status per fixture id, plus `joker` and `card` for the two card-level keys. */
  saveStatus: Readonly<Record<string, SaveStatus>>
  /** Set when the last command was refused, with the reason to show. */
  refusal: string | null
  /** Set when the load itself failed. */
  loadError: string | null
  setPrediction: (fixtureId: string, prediction: ScorelinePrediction | null) => void
  setJoker: (played: boolean) => void
  confirmCard: () => void
  retrySave: (key: string) => void
  reload: () => void
  /**
   * ASK THE AUTHORITY AGAIN BECAUSE A DEADLINE PASSED — and only when doing so
   * cannot cost the player a keystroke.
   *
   * THE COMPANION OF `reload`, NOT AN ALIAS FOR IT. `reload` is a RECOVERY
   * command: the player chose it, so abandoning whatever this device was still
   * trying to write is the correct reading of the click. This one is requested
   * by a timer nobody pressed, so it may not abandon anything. It waits for the
   * existing save authority to reach a terminal answer for every key and
   * re-reads the card only then. See the implementation for what each terminal
   * answer does with it.
   */
  refreshAfterDeadline: () => void
  /**
   * `INNOV-020`. Null where offline drafting is not configured, so a surface
   * asks whether the feature exists rather than rendering an empty
   * synchronisation dashboard on every prediction screen.
   */
  drafts: DraftsView | null
  /** Send every pending draft. A no-op with nothing pending or no batch path. */
  syncDrafts: () => void
  /** Send this draft again after a refusal the player has decided to override. */
  retryDraft: (fixtureId: string) => void
  /** Throw this draft away. The only thing besides acceptance that removes one. */
  discardDraft: (fixtureId: string) => void
}

const JOKER_KEY = 'joker'
const CARD_KEY = 'card'

function samePrediction(
  current: ScorelinePrediction | null,
  requested: ScorelinePrediction | null,
): boolean {
  if (current === null || requested === null) return current === requested
  return current.home === requested.home && current.away === requested.away
}

export function useSeasonMatchPredictor(
  gateway: MatchPredictorGateway,
  matchweek: number,
  offline?: OfflineDraftingOptions,
): SeasonMatchPredictorView {
  const [page, setPage] = useState<MatchPredictorPage | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})
  const [refusal, setRefusal] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const controllerRef = useRef<SaveController | null>(null)
  const pageRef = useRef<MatchPredictorPage | null>(null)
  pageRef.current = page

  /**
   * THE AUTOMATIC BOUNDARY REFRESH, WAITING ITS TURN.
   *
   * `armed` means a deadline was crossed and this card owes itself a fresh
   * authoritative read. `waiting` means one barrier is already outstanding, so
   * a second request cannot register a second waiter for the same question.
   *
   * A ref rather than state on purpose: nothing renders from it, and making it
   * state would re-render the card on every save transition to say nothing.
   */
  const boundaryRefresh = useRef({ armed: false, waiting: false })

  /**
   * Re-evaluated whenever a save changes state, which is the only thing that can
   * make an armed refresh become safe. The controller is built once, below, and
   * cannot close over a callback defined after it.
   */
  const attemptBoundaryRefreshRef = useRef<() => void>(() => {})

  // ---------------------------------------------------------------------
  // INNOV-020 — the drafts this device is holding.
  //
  // The store is recreated whenever the scope changes, which is what keeps one
  // account's drafts out of another's: the key and the payload both name the
  // user, and switching user gives a different store that reads a different
  // key and validates the payload against the new id.
  // ---------------------------------------------------------------------
  /**
   * The store, keyed on the PARTS of the scope rather than on the options
   * object.
   *
   * WHY NOT `[offline]`. A caller that builds the options inline — which is the
   * obvious way to call this — hands a new object on every render, and keying
   * the store on its identity rebuilt the store every render, which re-ran the
   * restore effect, which set state, which rendered again. The route memoises
   * its options and so never hit it; a test passing an inline object did, and
   * hung. Depending on the values means the loop cannot exist however the
   * caller writes it.
   *
   * The callbacks are reached through a ref for the same reason: `now`,
   * `isOnline` and `subscribeOnline` are functions a caller redefines freely,
   * and none of them should be able to rebuild anything.
   */
  const offlineRef = useRef(offline)
  offlineRef.current = offline
  const storage = offline?.storage ?? null
  const scopeUserId = offline?.scope.userId ?? null
  const scopeTournamentId = offline?.scope.tournamentId ?? null
  const scopeMatchweek = offline?.scope.matchweek ?? null

  const store = useMemo(
    () =>
      storage && scopeUserId && scopeTournamentId && scopeMatchweek !== null
        ? createPredictionDraftStore(
            storage,
            {
              userId: scopeUserId,
              tournamentId: scopeTournamentId,
              matchweek: scopeMatchweek,
            },
            () => offlineRef.current?.now() ?? new Date(),
          )
        : null,
    [storage, scopeUserId, scopeTournamentId, scopeMatchweek],
  )

  const [drafts, setDrafts] = useState<readonly PredictionDraft[]>([])
  const [syncing, setSyncing] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [lastResult, setLastResult] = useState<{ accepted: number; rejected: number } | null>(null)
  const draftsRef = useRef<readonly PredictionDraft[]>([])
  draftsRef.current = drafts
  // The controller is created once and cannot close over a callback that is
  // rebuilt each render, so it reaches the current one through a ref.
  const commitDraftsRef = useRef<(next: readonly PredictionDraft[]) => void>(() => {})

  /** Every change to the drafts goes through here, so the device copy and the
   *  screen cannot disagree — and an empty list removes the record rather than
   *  leaving one nobody will read. */
  const commitDrafts = useCallback(
    (next: readonly PredictionDraft[]) => {
      draftsRef.current = next
      setDrafts(next)
      store?.write(next)
    },
    [store],
  )
  commitDraftsRef.current = commitDrafts

  // Restore on mount, and whenever the scope changes. A reload with no signal
  // is the case this feature exists for, so the drafts have to survive it.
  useEffect(() => {
    if (!store) {
      setDrafts([])
      return
    }
    const record = store.read()
    const restored = record?.drafts ?? []
    draftsRef.current = restored
    setDrafts(restored)
  }, [store])

  useEffect(() => {
    if (!store) return
    setIsOffline(!(offlineRef.current?.isOnline() ?? true))
  }, [store])

  const hasConflict = useMemo(
    () => Object.values(saveStatus).some((value) => value === 'conflict'),
    [saveStatus],
  )

  const presentation = useMemo(
    () => (page === null ? null : presentCard(page, hasConflict)),
    [page, hasConflict],
  )

  /**
   * The matchweek the page is currently on, read through a ref.
   *
   * WHY NOT THE CLOSED-OVER VALUE. The controller is created once and disposed
   * on unmount, but the page changes matchweek through `?matchweek=` WITHOUT
   * remounting — so a controller closing over the first render's number sent
   * `setJoker` and `confirmCard` to the matchweek the player arrived at rather
   * than the one they are looking at. `setPrediction` was unaffected because
   * `save_season_prediction` is keyed on the fixture, which is why this
   * survived: the two commands it does break are the two nobody re-tested
   * after stepping.
   */
  const matchweekRef = useRef(matchweek)
  matchweekRef.current = matchweek
  const gatewayRef = useRef(gateway)
  gatewayRef.current = gateway

  // One controller for the whole matchweek, created once. Recreating it on
  // every render would lose in-flight state and defeat the ordering guarantees
  // the coordinator exists to provide.
  if (controllerRef.current === null) {
    controllerRef.current = createSaveController({
      performSave: async (key, payload) => {
        const command = payload as MatchPredictorCommand
        const outcome = await gatewayRef.current.apply(matchweekRef.current, command)
        // Contract 214. The confirm RPC answers with the evidence it stored.
        // Apply it here, on the settled write, so the receipt stops waiting for
        // an unrelated reload to discover what the server already told us. A
        // gateway that answers nothing leaves the evidence null, and the
        // receipt renders no evidence line rather than an invented one.
        if (command.kind === 'confirmCard' && outcome) {
          setPage((current) =>
            current === null || current.cardStatus !== 'confirmed'
              ? current
              : {
                  ...current,
                  confirmedAt: outcome.confirmedAt,
                  confirmationReference: outcome.confirmationReference,
                },
          )
        }
        void key
      },
      onStatus: (key, next) => {
        setSaveStatus((current) => ({ ...current, [key]: next }))
        // INNOV-020. The ordinary online save is still the fast path, and its
        // outcome is what decides whether a draft is still outstanding: the
        // server took it, so this device no longer needs to hold it. An error
        // leaves the draft exactly where it is, which is the whole point.
        if (next === 'saved') {
          const remaining = removeDraft(draftsRef.current, key)
          if (remaining.length !== draftsRef.current.length) commitDraftsRef.current(remaining)
        }
        // A key reaching a new state is the ONLY thing that can turn an unsafe
        // moment into a safe one, so it is the only thing that re-examines a
        // waiting boundary refresh. Nothing polls; with none armed this returns
        // on its first line.
        attemptBoundaryRefreshRef.current()
      },
      isConflict: isVersionConflict,
      // `C1` — a save that has stopped trying is reported, so a matchweek in
      // which nobody's predictions reached the server is visible somewhere
      // other than on the players' screens. The key names WHICH kind of write
      // it was and carries no content: fixture keys are opaque ids and
      // `JOKER_KEY` is a constant.
      onTerminalFailure: (key, error, outcome) => {
        reportOperationFailure(
          key === JOKER_KEY ? 'prediction.joker' : 'prediction.save',
          {
            outcome: outcome === 'conflict' ? 'conflict' : 'failed',
            serverCode: serverCodeOf(error),
            // The season id lives inside the gateway rather than in this
            // hook's scope, so it is absent rather than reached for. The
            // operation, the outcome, the server's code and the matchweek are
            // enough to act on, and inventing a route to the id for a log line
            // would be the wrong trade.
            matchweek: matchweekRef.current,
          },
        )
      },
    })
  }

  useEffect(() => {
    const controller = controllerRef.current
    return () => {
      controller?.dispose()
      controllerRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setLoadError(null)
    gateway
      .load(matchweek)
      .then((loaded) => {
        if (cancelled) return
        setPage(loaded)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        // The message is the gateway's, not invented here: an honest
        // "unavailable" needs to say which thing was unavailable.
        setLoadError(error instanceof Error ? error.message : 'This matchweek could not be loaded.')
        setStatus('failed')
      })
    return () => {
      cancelled = true
    }
  }, [gateway, matchweek, reloadToken])

  const issue = useCallback(
    (key: string, command: MatchPredictorCommand, optimistic: () => void) => {
      const current = pageRef.current
      if (current === null) return
      // Contract 212: the fixtures go in, so a score command is judged against
      // the fixture's own published lock rather than the matchweek's.
      const refused = commandRefusal(
        presentCard(current, hasConflict),
        command,
        current.joker,
        current.fixtures,
      )
      if (refused !== null) {
        setRefusal(refused)
        return
      }
      setRefusal(null)
      optimistic()
      controllerRef.current?.change(key, command)
    },
    [hasConflict],
  )

  const setPrediction = useCallback(
    (fixtureId: string, prediction: ScorelinePrediction | null) => {
      const current = pageRef.current
      const stored = current?.fixtures.find((fixture) => fixture.fixtureId === fixtureId)?.prediction
      // Contract 214: the server treats an identical scoreline (or clearing an
      // already-empty fixture) as a no-op so it does not invalidate a current
      // confirmation. Do the same before creating a device draft or save event.
      if (stored !== undefined && samePrediction(stored, prediction)) return

      // INNOV-020. Recorded on the device BEFORE the write is attempted, so a
      // save that never leaves the phone still leaves the work somewhere. It is
      // cleared the moment the server says `saved` — never before, and never on
      // an optimistic render.
      if (store) commitDrafts(upsertDraft(draftsRef.current, fixtureId, prediction))

      issue(fixtureId, { kind: 'setPrediction', fixtureId, prediction }, () => {
        setPage((next) =>
          next === null
            ? next
            : {
                ...next,
                // Contract 214. A material edit means the CURRENT card is not
                // the one the previous confirmation described. Clear the
                // server evidence at the same instant the edited score appears;
                // waiting for a reload would show a self-contradictory screen.
                cardStatus: 'provisional',
                confirmedAt: null,
                confirmationReference: null,
                fixtures: next.fixtures.map((fixture) =>
                  fixture.fixtureId === fixtureId ? { ...fixture, prediction } : fixture,
                ),
              },
        )
      })
    },
    [issue, store, commitDrafts],
  )

  const setJoker = useCallback(
    (played: boolean) => {
      const current = pageRef.current
      // Same no-op rule as the server: repeating the current Joker state changes
      // no card content and therefore cannot invalidate confirmation.
      if (current?.joker.playedHere === played) return

      issue(JOKER_KEY, { kind: 'setJoker', played }, () => {
        setPage((next) =>
          next === null
            ? next
            : {
                ...next,
                // Playing or taking back a Joker changes what the card means at
                // settlement. An existing confirmation therefore stops
                // describing the card. Unlike a prediction save, a Joker does
                // not create a card from absence, so no_submission stays absent.
                cardStatus: next.cardStatus === 'confirmed' ? 'provisional' : next.cardStatus,
                confirmedAt: next.cardStatus === 'confirmed' ? null : next.confirmedAt,
                confirmationReference:
                  next.cardStatus === 'confirmed' ? null : next.confirmationReference,
                joker: {
                  ...next.joker,
                  playedHere: played,
                  remainingThisHalf: Math.max(
                    0,
                    next.joker.remainingThisHalf + (played ? -1 : 1),
                  ),
                },
              },
        )
      })
    },
    [issue],
  )

  const confirmCard = useCallback(() => {
    if (pageRef.current?.cardStatus === 'confirmed') return
    issue(CARD_KEY, { kind: 'confirmCard' }, () => {
      setPage((current) =>
        current === null
          ? current
          : {
              ...current,
              cardStatus: 'confirmed',
              // The server has not answered yet. A browser clock/reference here
              // would be invented evidence, so the receipt appears without an
              // evidence line until the write settles and `performSave` applies
              // the instant and reference the server actually stored.
              confirmedAt: null,
              confirmationReference: null,
            },
      )
    })
  }, [issue])

  const retrySave = useCallback((key: string) => {
    controllerRef.current?.manualRetry(key)
  }, [])

  const reload = useCallback(() => {
    // A DELIBERATE RECOVERY, AND DELIBERATELY DESTRUCTIVE. `reset` drops every
    // key's state, its retry timers and any coalesced pending write. That is
    // right for a command the player chose — they are asking to be shown what
    // the server holds — and it is exactly why a timer may not call this.
    controllerRef.current?.reset()
    setSaveStatus({})
    setRefusal(null)
    // The player has just re-asked the authority themselves, which is the same
    // question an armed boundary refresh was waiting to ask. It is answered.
    boundaryRefresh.current.armed = false
    setReloadToken((token) => token + 1)
  }, [])

  /**
   * ---------------------------------------------------------------------
   * THE SAVE-SAFE BOUNDARY REFRESH.
   *
   * WHAT WENT WRONG WITHOUT IT. `useDeadlineClock` was wired straight to
   * `reload`, so a deadline arriving mid-edit ran `controller.reset()` — which
   * clears per-key state, cancels scheduled retries and throws away the
   * COALESCED PENDING write the coordinator holds behind an in-flight one. The
   * sequence that costs a player their prediction is short: they enter 1–0, the
   * save goes on the wire, they change it to 2–0, 2–0 becomes pending, the
   * deadline arrives, the timer resets the controller, 1–0 completes, and 2–0
   * was never sent. Nobody clicked anything.
   *
   * THE RULE. Crossing the deadline may request an authoritative refresh only
   * when doing so cannot discard, cancel or overwrite unsaved player intent.
   * Browser time may still ask; it may still never answer; and it may not
   * behave like a manual recovery while writes are unsettled.
   *
   * THE MECHANISM IS THE SAVE AUTHORITY'S OWN. `SaveController.waitForSettled`
   * already exists to answer "is every key terminal, and how did they end" —
   * it is what the tournament submit barrier is built on. Reusing it means
   * there is no second opinion about save state anywhere in this file: no
   * inspection of `inFlight`, no copy of the coordinator, no timeout, no poll.
   *
   * WHAT EACH TERMINAL ANSWER DOES WITH THE REQUEST:
   *
   *   - EVERYTHING SETTLED CLEANLY — the refresh happens, once. With nothing
   *     saving at all the barrier is already settled and it happens immediately.
   *   - IN FLIGHT, OR A NEWER VALUE COALESCED BEHIND ONE, OR WAITING ON AN
   *     AUTOMATIC RETRY — the barrier has not resolved, so nothing happens yet.
   *     The coordinator sends the newest pending value when the flight settles,
   *     exactly as it would have with no deadline at all, and the server —
   *     never this file — decides whether a last-second write was in time.
   *   - TERMINAL ORDINARY ERROR, OR A VERSION CONFLICT — the refresh does NOT
   *     happen and the request STAYS ARMED. Re-reading here would replace the
   *     player's optimistic value and its error with the server's older row and
   *     erase the recovery path (`retrySave`, or the conflict's explicit
   *     reload) while they are looking at it. The request is re-examined when a
   *     save next changes state, so a manual retry that finally succeeds
   *     releases it; an explicit `reload` disarms it, having asked the same
   *     question already.
   *   - THE BARRIER WAS CANCELLED — a reset or dispose overtook it. The
   *     question is moot, so the request is dropped rather than re-armed.
   * ---------------------------------------------------------------------
   */
  const attemptBoundaryRefresh = useCallback(() => {
    const request = boundaryRefresh.current
    const controller = controllerRef.current
    if (!request.armed || request.waiting || controller === null) return

    request.waiting = true
    void controller.waitForSettled().then((result) => {
      request.waiting = false
      // Unmounted between the request and the answer: `controllerRef` is
      // nulled by this hook's own cleanup, so there is no card left to refresh.
      if (controllerRef.current === null) return
      if (result.cancelled) {
        request.armed = false
        return
      }
      // `ok` is false when a key ended in `error` or `conflict`. Both are the
      // player's to resolve, and neither is a reason to re-read over them.
      if (!result.ok) return
      request.armed = false
      setReloadToken((token) => token + 1)
    })
  }, [])
  attemptBoundaryRefreshRef.current = attemptBoundaryRefresh

  const refreshAfterDeadline = useCallback(() => {
    boundaryRefresh.current.armed = true
    attemptBoundaryRefresh()
  }, [attemptBoundaryRefresh])

  // ---------------------------------------------------------------------
  // INNOV-020 — reconciliation.
  //
  // ONE CALL, PER-FIXTURE ANSWERS, AND NOTHING SILENTLY DISCARDED. Contract
  // 177 runs every draft through `save_season_prediction` in its own
  // subtransaction, so one locked fixture cannot roll back the seven that were
  // submittable. Accepted drafts leave; every other outcome stays with the
  // server's reason attached, stops being pending, and waits for the player.
  //
  // IT RELOADS AFTER A SUCCESSFUL BATCH. The card on screen is now behind the
  // server — versions, card status and the entered count have all moved — and
  // reloading is how this surface has always recovered from that.
  // ---------------------------------------------------------------------
  const syncingRef = useRef(false)
  const syncDrafts = useCallback(() => {
    const reconcile = gatewayRef.current.reconcile
    if (!reconcile || !store || syncingRef.current) return
    const outstanding = pendingDrafts(draftsRef.current)
    if (outstanding.length === 0) return

    syncingRef.current = true
    setSyncing(true)
    reconcile
      .call(
        gatewayRef.current,
        matchweekRef.current,
        outstanding.map((draft) => ({
          fixtureId: draft.fixtureId,
          prediction: draft.prediction,
        })),
      )
      .then((result) => {
        commitDraftsRef.current(applyBatchResult(draftsRef.current, result))
        setLastResult({ accepted: result.accepted, rejected: result.rejected })
        setIsOffline(false)
        // Anything the server took has changed the card. Re-read it rather
        // than patching a page from a batch answer, which would be a second
        // opinion about what the server now holds.
        if (result.accepted > 0) {
          controllerRef.current?.reset()
          setSaveStatus({})
          // Same reasoning as `reload`: the card is being re-read anyway, so an
          // armed boundary refresh has nothing left to ask for.
          boundaryRefresh.current.armed = false
          setReloadToken((token) => token + 1)
        }
      })
      .catch(() => {
        // Still no connection, or the session is broken. Both leave every
        // draft exactly where it is; the surface says the sync did not happen.
        setIsOffline(!(offlineRef.current?.isOnline() ?? true))
      })
      .finally(() => {
        syncingRef.current = false
        setSyncing(false)
      })
  }, [store])

  // The device says it is back. One attempt, and a failure leaves the drafts
  // alone — there is a manual control for the case where the device is wrong.
  const syncRef = useRef(syncDrafts)
  syncRef.current = syncDrafts
  useEffect(() => {
    if (!store) return
    return offlineRef.current?.subscribeOnline(() => {
      setIsOffline(false)
      syncRef.current()
    })
  }, [store])

  const retryOneDraft = useCallback(
    (fixtureId: string) => {
      if (!store) return
      commitDrafts(retryDraft(draftsRef.current, fixtureId))
      // Cleared of its refusal, it is pending again — and the card's versions
      // are refreshed by the reload above before the next attempt.
      setReloadToken((token) => token + 1)
    },
    [store, commitDrafts],
  )

  const discardDraft = useCallback(
    (fixtureId: string) => {
      if (!store) return
      commitDrafts(removeDraft(draftsRef.current, fixtureId))
      // The card still shows the optimistic edit, so re-read it: discarding a
      // draft means going back to what the server holds.
      setReloadToken((token) => token + 1)
    },
    [store, commitDrafts],
  )

  const draftsView = useMemo(
    () =>
      store === null
        ? null
        : presentDrafts(drafts, { syncing, offline: isOffline, lastResult }),
    [store, drafts, syncing, isOffline, lastResult],
  )

  return {
    status,
    page,
    presentation,
    saveStatus,
    refusal,
    loadError,
    setPrediction,
    setJoker,
    confirmCard,
    retrySave,
    reload,
    refreshAfterDeadline,
    drafts: draftsView,
    syncDrafts,
    retryDraft: retryOneDraft,
    discardDraft,
  }
}
