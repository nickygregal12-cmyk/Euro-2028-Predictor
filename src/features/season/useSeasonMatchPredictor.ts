import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SaveStatus } from '../../domain/saveCoordinator'
import type { ScorelinePrediction } from '../../domain/season/scoring'
import { createSaveController, type SaveController } from '../../app/providers/saveController'
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
        await gatewayRef.current.apply(matchweekRef.current, payload as MatchPredictorCommand)
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
      },
      isConflict: isVersionConflict,
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
      const refused = commandRefusal(presentCard(current, hasConflict), command, current.joker)
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
      // INNOV-020. Recorded on the device BEFORE the write is attempted, so a
      // save that never leaves the phone still leaves the work somewhere. It is
      // cleared the moment the server says `saved` — never before, and never on
      // an optimistic render.
      if (store) commitDrafts(upsertDraft(draftsRef.current, fixtureId, prediction))

      issue(fixtureId, { kind: 'setPrediction', fixtureId, prediction }, () => {
        setPage((current) =>
          current === null
            ? current
            : {
                ...current,
                // A player who edits anything has engaged the matchweek, so the
                // card stops being `no_submission`. That is the difference
                // between unbanked and banking what they entered, so it has to
                // move here rather than waiting for a server round trip.
                cardStatus: current.cardStatus === 'no_submission' ? 'provisional' : current.cardStatus,
                fixtures: current.fixtures.map((fixture) =>
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
      issue(JOKER_KEY, { kind: 'setJoker', played }, () => {
        setPage((current) =>
          current === null
            ? current
            : {
                ...current,
                joker: {
                  ...current.joker,
                  playedHere: played,
                  remainingThisHalf: Math.max(
                    0,
                    current.joker.remainingThisHalf + (played ? -1 : 1),
                  ),
                },
              },
        )
      })
    },
    [issue],
  )

  const confirmCard = useCallback(() => {
    issue(CARD_KEY, { kind: 'confirmCard' }, () => {
      setPage((current) => (current === null ? current : { ...current, cardStatus: 'confirmed' }))
    })
  }, [issue])

  const retrySave = useCallback((key: string) => {
    controllerRef.current?.manualRetry(key)
  }, [])

  const reload = useCallback(() => {
    controllerRef.current?.reset()
    setSaveStatus({})
    setRefusal(null)
    setReloadToken((token) => token + 1)
  }, [])

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
    drafts: draftsView,
    syncDrafts,
    retryDraft: retryOneDraft,
    discardDraft,
  }
}
