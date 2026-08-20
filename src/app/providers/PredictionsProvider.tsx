import { userFacingError } from '../../shared/errors/userFacingError'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { SaveStatus } from '../../design-system'
import {
  deleteMatchPrediction,
  fetchMatchPredictions,
  fetchMyEntry,
  submitEntry,
  upsertMatchPrediction,
} from '../../services/supabase/predictions'
import { fetchGoldenBoot, upsertGoldenBoot } from '../../services/supabase/bonus'
import { isVersionConflict } from '../../services/supabase/writeConflict'
import {
  fetchTieResolutions,
  upsertTieResolution,
  type TieResolutionScope,
} from '../../services/supabase/tieResolutions'
import {
  fetchProgression,
  upsertProgression,
  deleteProgression,
} from '../../services/supabase/progression'
import { tieKey, type TieResolution } from '../../domain/tournament/tieResolutions'
import type { ProgressionStage } from '../../domain/tournament/bracketPicks'
import { canToggleJoker } from '../../domain/tournament/jokerPolicy'
import { JOKER_ALLOWANCE } from '../../domain/tournament/scoringConfig'
import type { SaveStatus as CoordinatorStatus } from '../../domain/saveCoordinator'
import { createSaveController, type SaveController } from './saveController'
import {
  reportOperationFailure,
  serverCodeOf,
} from '../../services/observability/operationFailure'
import { useAuth } from '../../features/auth/AuthProvider'
import { useTournamentData } from './TournamentDataProvider'
import { useReturnToForeground } from './useReturnToForeground'

// Central prediction state for the whole entry: the hub reads aggregate counts
// from it, the group predictor reads/writes individual scores. Autosave is
// debounced per match; the server stays the authority on locks, so save
// failures surface on the card rather than being swallowed.

// Re-exported from the rule config so screens share one source of truth.
export const MAX_JOKERS = JOKER_ALLOWANCE
const SAVE_DEBOUNCE_MS = 600

export type Prediction = {
  homeScore: number | null
  awayScore: number | null
  joker: boolean
}

// Autosave keys routed through the save controller. A match's score + joker are
// ONE database row (upserted or deleted together), so they share one key per
// match — the controller must never race two writes to the same row. Ties are
// keyed by the tied set, the bracket is a single set, and the golden boot is one
// field.
const BRACKET_KEY = 'bracket'
const GOLDEN_BOOT_KEY = 'gb'
const matchKey = (matchId: string) => `m:${matchId}`
const tieSaveKey = (key: string) => `t:${key}`

type MatchSavePayload =
  | { kind: 'upsert'; homeScore: number; awayScore: number; joker: boolean }
  | { kind: 'delete' }
type TieSavePayload = { scope: TieResolutionScope; orderedTeamIds: string[] }
type BracketSavePayload = { desired: Record<string, ProgressionStage> }
type GoldenBootSavePayload = { playerId: string | null }

type LoadSlice = 'matches' | 'ties' | 'progression' | 'goldenBoot'
type LoadRevisions = Record<LoadSlice, number>

const createLoadRevisions = (): LoadRevisions => ({
  matches: 0,
  ties: 0,
  progression: 0,
  goldenBoot: 0,
})

export type PredictionsLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

type PredictionsContextValue = {
  ready: boolean
  /**
   * Whether the caller holds an entry in this tournament. False is an ordinary
   * state on the weekly site, where nothing offers a way to enter one.
   */
  hasEntry: boolean
  loadStatus: PredictionsLoadStatus
  loadMessage: string | null
  retryInitialLoad: () => void
  submittedAt: string | null
  jokerCount: number
  getPrediction: (matchId: string) => Prediction
  getSaveStatus: (matchId: string) => SaveStatus
  setScore: (matchId: string, side: 'home' | 'away', value: number | null) => void
  toggleJoker: (matchId: string) => void
  retrySave: (matchId: string) => void
  // Manual tie-resolutions (scoring-rules §6 step 7): the user's chosen order
  // for team blocks the automatic criteria couldn't separate. Consumed by the
  // domain pipeline; keyed for save status by the tied set (tieKey).
  tieResolutions: TieResolution[]
  getTieSaveStatus: (tiedTeamIds: string[]) => SaveStatus
  setTieResolution: (scope: TieResolutionScope, orderedTeamIds: string[]) => void
  // Knockout bracket picks, stored as predicted_progression (per team → furthest
  // stage). The screen computes the full desired map from the winners map and
  // hands it here; persistence diffs it against what's stored and syncs.
  bracketProgression: Record<string, ProgressionStage>
  bracketSaveStatus: SaveStatus
  setBracketProgression: (next: Record<string, ProgressionStage>) => void
  retryBracketSave: () => void
  // Bonus: golden-boot player reference (nullable). The group-goals bonus is
  // derived, never stored (domain/groupGoals.ts).
  goldenBootPlayerId: string | null
  setGoldenBoot: (playerId: string | null) => void
  goldenBootSaveStatus: SaveStatus
  retryGoldenBoot: () => void
  // Optimistic-concurrency conflict (a prediction row was changed on another
  // device). Terminal + non-retryable: the user chooses how to resolve. True
  // when ANY key is in conflict; resolveConflict applies to all of them.
  hasConflict: boolean
  resolveConflict: (choice: 'latest' | 'mine') => void
  // Submission flushes every debounce timer and waits for all controller writes
  // to settle before calling the server-side validator. It does not freeze the
  // entry — predictions stay editable and the entry stays submitted.
  submitting: boolean
  submit: () => Promise<{ ok: boolean; message?: string }>
}

const PredictionsContext = createContext<PredictionsContextValue | null>(null)

const EMPTY: Prediction = { homeScore: null, awayScore: null, joker: false }

export function PredictionsProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()
  const data = useTournamentData()
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null

  const [entryId, setEntryId] = useState<string | null>(null)
  const [submittedAt, setSubmittedAt] = useState<string | null>(null)
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({})
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})
  const [tieResolutions, setTieResolutions] = useState<TieResolution[]>([])
  const [tieSaveStatus, setTieSaveStatus] = useState<Record<string, SaveStatus>>({})
  const [progression, setProgression] = useState<Record<string, ProgressionStage>>({})
  const [bracketSaveStatus, setBracketSaveStatus] = useState<SaveStatus>('idle')
  const [goldenBootPlayerId, setGoldenBootPlayerId] = useState<string | null>(null)
  const [goldenBootSaveStatus, setGoldenBootSaveStatus] = useState<SaveStatus>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [ready, setReady] = useState(false)
  const [loadStatus, setLoadStatus] = useState<PredictionsLoadStatus>('idle')
  const [loadMessage, setLoadMessage] = useState<string | null>(null)
  const [initialLoadNonce, setInitialLoadNonce] = useState(0)

  // Latest predictions + entryId for the debounced saver to read without going
  // stale between the timer being set and firing.
  const predictionsRef = useRef(predictions)
  predictionsRef.current = predictions
  const entryIdRef = useRef<string | null>(null)
  entryIdRef.current = entryId
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const submittingRef = useRef(false)
  // Each initial best-effort read captures the corresponding local-edit
  // revision. A response may populate state only when the user has not
  // changed that slice since the read began. This prevents a slow success
  // or failure default from replacing newer local work.
  const localEditRevisionsRef = useRef<LoadRevisions>(createLoadRevisions())
  const foregroundRefreshInFlightRef = useRef(false)
  const mountedRef = useRef(false)

  function markLocalEdit(slice: LoadSlice) {
    localEditRevisionsRef.current[slice] += 1
  }

  function initialLoadCanApply(slice: LoadSlice, revision: number) {
    return localEditRevisionsRef.current[slice] === revision
  }

  // Bracket persistence baselines: `persisted` is what's currently in the DB,
  // `desired` is the latest map the user has picked. The debounced flush syncs
  // one to the other (upserting changed teams, deleting removed ones).
  const progressionPersistedRef = useRef<Record<string, ProgressionStage>>({})
  const progressionDesiredRef = useRef<Record<string, ProgressionStage>>({})
  const progressionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Optimistic-concurrency versions the client last read per row. Echoed on the
  // next write/delete; a mismatch means the server row changed elsewhere.
  // Updated from every successful save and removed after a successful clear.
  const matchVersionsRef = useRef<Record<string, number>>({})
  const progressionVersionsRef = useRef<Record<string, number>>({})
  const goldenBootVersionRef = useRef<number>(0)

  // The save controller serialises writes per key (at most one in flight,
  // coalesced pending, stale-response guard, bounded retry). `performSave` and
  // `onStatus` read only refs + stable setters, so the controller is created
  // once and stays valid across renders. See domain/saveCoordinator.ts.
  const controllerRef = useRef<SaveController | null>(null)
  if (controllerRef.current === null) {
    controllerRef.current = createSaveController({
      performSave,
      onStatus,
      // A version conflict is terminal + non-retryable (server row changed
      // elsewhere); the controller surfaces 'conflict' instead of auto-retrying.
      isConflict: isVersionConflict,
      // `C1` — a save that has stopped trying is reported. The key is an
      // opaque prefix plus an id (`m:`, `t:`, the bracket and Golden Boot
      // keys); no scoreline, team or player name goes anywhere near this.
      onTerminalFailure: (_key, error, outcome) => {
        reportOperationFailure('prediction.save', {
          outcome: outcome === 'conflict' ? 'conflict' : 'failed',
          serverCode: serverCodeOf(error),
        })
      },
    })
  }
  const controller = controllerRef.current

  // Perform the actual write for a settled save key. Echoes the last-read version
  // and records/removes it on success. Throws on failure so the controller
  // retries (or, for a version conflict, surfaces it). Never touches local state.
  async function performSave(key: string, payload: unknown): Promise<void> {
    const id = entryIdRef.current
    if (!id) throw new Error('No entry to save against')
    if (key.startsWith('m:')) {
      const matchId = key.slice(2)
      const p = payload as MatchSavePayload
      if (p.kind === 'delete') {
        const version = matchVersionsRef.current[matchId]
        await deleteMatchPrediction(
          id,
          matchId,
          version ?? null,
        )
        delete matchVersionsRef.current[matchId]
        return
      }
      const v = await upsertMatchPrediction(
        id,
        matchId,
        p.homeScore,
        p.awayScore,
        p.joker,
        matchVersionsRef.current[matchId] ?? 0,
      )
      matchVersionsRef.current[matchId] = v
      return
    }
    if (key.startsWith('t:')) {
      const p = payload as TieSavePayload
      await upsertTieResolution(id, p.scope, p.orderedTeamIds)
      return
    }
    if (key === BRACKET_KEY) {
      const desired = (payload as BracketSavePayload).desired
      const persisted = progressionPersistedRef.current
      const versions = progressionVersionsRef.current
      const ops: Promise<void>[] = []
      for (const [teamId, stage] of Object.entries(desired)) {
        if (persisted[teamId] !== stage) {
          ops.push(
            upsertProgression(id, teamId, stage, versions[teamId] ?? 0).then((v) => {
              versions[teamId] = v
            }),
          )
        }
      }
      for (const teamId of Object.keys(persisted)) {
        if (desired[teamId] === undefined) {
          ops.push(
            deleteProgression(id, teamId).then(() => {
              delete versions[teamId]
            }),
          )
        }
      }
      await Promise.all(ops)
      // The controller guarantees saves are sequential per key, so advancing the
      // baseline to exactly the snapshot we just wrote is safe (no overlap).
      progressionPersistedRef.current = desired
      return
    }
    if (key === GOLDEN_BOOT_KEY) {
      const v = await upsertGoldenBoot(
        id,
        (payload as GoldenBootSavePayload).playerId,
        goldenBootVersionRef.current,
      )
      goldenBootVersionRef.current = v
      return
    }
  }

  // Route a key's save-status into the matching React state for rendering.
  function onStatus(key: string, status: CoordinatorStatus) {
    if (key.startsWith('m:')) {
      const matchId = key.slice(2)
      setSaveStatus((s) => ({ ...s, [matchId]: status }))
    } else if (key.startsWith('t:')) {
      const tk = key.slice(2)
      setTieSaveStatus((s) => ({ ...s, [tk]: status }))
    } else if (key === BRACKET_KEY) {
      setBracketSaveStatus(status)
    } else if (key === GOLDEN_BOOT_KEY) {
      setGoldenBootSaveStatus(status)
    }
  }

  function clearMatchTimer(matchId: string) {
    const timer = timers.current[matchId]
    if (timer !== undefined) clearTimeout(timer)
    delete timers.current[matchId]
  }

  function clearDebounceTimers() {
    for (const matchId of Object.keys(timers.current)) clearMatchTimer(matchId)
    if (progressionTimer.current !== undefined) clearTimeout(progressionTimer.current)
    progressionTimer.current = undefined
  }

  function flushDebouncedSaves() {
    const pendingMatches = Object.keys(timers.current)
    for (const matchId of pendingMatches) {
      clearMatchTimer(matchId)
      dispatchMatchSave(matchId)
    }
    if (progressionTimer.current !== undefined) {
      clearTimeout(progressionTimer.current)
      progressionTimer.current = undefined
      dispatchBracketSave()
    }
  }

  // Stop the controller and all debounce/retry timers when the provider unmounts.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearDebounceTimers()
      controllerRef.current?.dispose()
    }
  }, [])

  useEffect(() => {
    let active = true

    // Entry context is changing (or disappearing). Clear every local slice and
    // version baseline immediately so the previous account/tournament cannot
    // remain visible or receive a delayed save while the next entry loads.
    setReady(false)
    setLoadStatus(userId && tournamentId ? 'loading' : 'idle')
    setLoadMessage(null)
    clearDebounceTimers()
    controllerRef.current?.reset()
    entryIdRef.current = null
    setEntryId(null)
    setSubmittedAt(null)
    predictionsRef.current = {}
    setPredictions({})
    setSaveStatus({})
    matchVersionsRef.current = {}
    setTieResolutions([])
    setTieSaveStatus({})
    setProgression({})
    progressionPersistedRef.current = {}
    progressionDesiredRef.current = {}
    progressionVersionsRef.current = {}
    setBracketSaveStatus('idle')
    setGoldenBootPlayerId(null)
    goldenBootVersionRef.current = 0
    setGoldenBootSaveStatus('idle')
    submittingRef.current = false
    setSubmitting(false)
    localEditRevisionsRef.current = createLoadRevisions()

    if (!userId || !tournamentId) {
      return () => {
        active = false
      }
    }

    // READS THE ENTRY; DOES NOT CREATE ONE. This used to call
    // `getOrCreateEntry`, whose upsert fires the contract-66 membership trigger
    // — so a player who merely opened More -> Profile was enrolled in Euro 2028
    // and became a member of its competition. Invisible while every signed-in
    // route was a Euro route; a live EURO-001 violation with a stored
    // consequence once the platform went multi-competition. Entry is an act,
    // not a side effect of looking, and the act belongs to a join journey the
    // weekly site deliberately no longer has.
    fetchMyEntry(userId, tournamentId)
      .then(async (entry) => {
        if (!active) return
        if (!entry) {
          // No entry is an answer, not a failure and not an empty one. The
          // surfaces above read `hasEntry` and say so rather than deriving a
          // profile of zeros from predictions nobody made.
          setReady(true)
          setLoadStatus('ready')
          setLoadMessage(null)
          return
        }
        entryIdRef.current = entry.id
        setEntryId(entry.id)
        setSubmittedAt(entry.submittedAt)

        const matchLoadRevision = localEditRevisionsRef.current.matches
        const rows = await fetchMatchPredictions(entry.id)
        if (!active) return
        if (initialLoadCanApply('matches', matchLoadRevision)) {
          const map: Record<string, Prediction> = {}
          const vmap: Record<string, number> = {}
          for (const r of rows) {
            map[r.matchId] = {
              homeScore: r.homeScore,
              awayScore: r.awayScore,
              joker: r.joker,
            }
            vmap[r.matchId] = r.version
          }
          matchVersionsRef.current = vmap
          predictionsRef.current = map
          setPredictions(map)
        }
        setReady(true)
        setLoadStatus('ready')
        setLoadMessage(null)

        // These secondary reads remain fail-soft so missing optional data cannot
        // block the entry. Their result/default may only apply if no newer local
        // edit has occurred since the individual read began.
        const tieLoadRevision = localEditRevisionsRef.current.ties
        void fetchTieResolutions(entry.id)
          .then((ties) => {
            if (!active || !initialLoadCanApply('ties', tieLoadRevision)) return
            setTieResolutions(
              ties.map((t) => ({ teamIds: t.teamIds, order: t.order })),
            )
          })
          .catch(() => {
            if (active && initialLoadCanApply('ties', tieLoadRevision)) {
              setTieResolutions([])
            }
          })

        const progressionLoadRevision = localEditRevisionsRef.current.progression
        void fetchProgression(entry.id)
          .then((progressionRows) => {
            if (
              !active ||
              !initialLoadCanApply('progression', progressionLoadRevision)
            ) {
              return
            }
            const map: Record<string, ProgressionStage> = {}
            const vmap: Record<string, number> = {}
            for (const row of progressionRows) {
              map[row.teamId] = row.stage
              vmap[row.teamId] = row.version
            }
            setProgression(map)
            progressionPersistedRef.current = map
            progressionDesiredRef.current = map
            progressionVersionsRef.current = vmap
          })
          .catch(() => {
            if (
              !active ||
              !initialLoadCanApply('progression', progressionLoadRevision)
            ) {
              return
            }
            setProgression({})
            progressionPersistedRef.current = {}
            progressionDesiredRef.current = {}
            progressionVersionsRef.current = {}
          })

        const goldenBootLoadRevision = localEditRevisionsRef.current.goldenBoot
        void fetchGoldenBoot(entry.id)
          .then((gb) => {
            if (
              !active ||
              !initialLoadCanApply('goldenBoot', goldenBootLoadRevision)
            ) {
              return
            }
            setGoldenBootPlayerId(gb.playerId)
            goldenBootVersionRef.current = gb.version
          })
          .catch(() => {
            if (active && initialLoadCanApply('goldenBoot', goldenBootLoadRevision)) {
              setGoldenBootPlayerId(null)
            }
          })
      })
      .catch((error: unknown) => {
        if (!active) return
        setReady(false)
        setLoadStatus('error')
        setLoadMessage(
          userFacingError(error, 'Could not load your prediction entry. Please try again.'),
        )
      })

    return () => {
      active = false
    }
  }, [userId, tournamentId, initialLoadNonce])

  async function refreshPersistedEntryAfterForeground() {
    const id = entryIdRef.current
    if (
      !id ||
      !userId ||
      !tournamentId ||
      !ready ||
      submittingRef.current ||
      foregroundRefreshInFlightRef.current
    ) {
      return
    }

    foregroundRefreshInFlightRef.current = true
    flushDebouncedSaves()

    try {
      // Never replace local work while a write is pending, retrying, failed or in
      // conflict. Successful settlement means the server contains every local
      // change that existed before these refresh reads begin.
      const settled = await controller.waitForSettled()
      if (!settled.ok || settled.cancelled || entryIdRef.current !== id) return

      const revisions = { ...localEditRevisionsRef.current }
      const [entryResult, matchResult, tieResult, progressionResult, goldenBootResult] =
        await Promise.allSettled([
          // Read, not upsert, for the same reason the initial load is: a
          // foreground refresh must never be the thing that enters somebody.
          fetchMyEntry(userId, tournamentId),
          fetchMatchPredictions(id),
          fetchTieResolutions(id),
          fetchProgression(id),
          fetchGoldenBoot(id),
        ])

      if (!mountedRef.current || entryIdRef.current !== id) return

      if (
        entryResult.status === 'fulfilled' &&
        entryResult.value !== null &&
        entryResult.value.id === id &&
        !submittingRef.current
      ) {
        setSubmittedAt(entryResult.value.submittedAt)
      }

      if (
        matchResult.status === 'fulfilled' &&
        initialLoadCanApply('matches', revisions.matches)
      ) {
        const map: Record<string, Prediction> = {}
        const versions: Record<string, number> = {}
        for (const row of matchResult.value) {
          map[row.matchId] = {
            homeScore: row.homeScore,
            awayScore: row.awayScore,
            joker: row.joker,
          }
          versions[row.matchId] = row.version
        }
        matchVersionsRef.current = versions
        predictionsRef.current = map
        setPredictions(map)
      }

      if (tieResult.status === 'fulfilled' && initialLoadCanApply('ties', revisions.ties)) {
        setTieResolutions(
          tieResult.value.map((row) => ({ teamIds: row.teamIds, order: row.order })),
        )
      }

      if (
        progressionResult.status === 'fulfilled' &&
        initialLoadCanApply('progression', revisions.progression)
      ) {
        const map: Record<string, ProgressionStage> = {}
        const versions: Record<string, number> = {}
        for (const row of progressionResult.value) {
          map[row.teamId] = row.stage
          versions[row.teamId] = row.version
        }
        setProgression(map)
        progressionPersistedRef.current = map
        progressionDesiredRef.current = map
        progressionVersionsRef.current = versions
      }

      if (
        goldenBootResult.status === 'fulfilled' &&
        initialLoadCanApply('goldenBoot', revisions.goldenBoot)
      ) {
        setGoldenBootPlayerId(goldenBootResult.value.playerId)
        goldenBootVersionRef.current = goldenBootResult.value.version
      }
    } finally {
      foregroundRefreshInFlightRef.current = false
    }
  }

  useReturnToForeground(() => {
    void refreshPersistedEntryAfterForeground()
  })

  // Hand the match's latest local state to the controller. A complete pair is
  // upserted; an incomplete pair deletes the stored row through the version-safe
  // RPC. Both operations share one key, so a quick clear/re-entry remains ordered.
  function dispatchMatchSave(matchId: string) {
    const id = entryIdRef.current
    const pred = predictionsRef.current[matchId]
    if (!id || !pred) return
    if (pred.homeScore === null || pred.awayScore === null) {
      controller.change(matchKey(matchId), { kind: 'delete' } satisfies MatchSavePayload)
      return
    }
    controller.change(matchKey(matchId), {
      kind: 'upsert',
      homeScore: pred.homeScore,
      awayScore: pred.awayScore,
      joker: pred.joker,
    } satisfies MatchSavePayload)
  }

  function scheduleSave(matchId: string) {
    clearMatchTimer(matchId)
    // A submit barrier must see edits made while it is waiting. During submit,
    // bypass the debounce and route the latest value into the controller now.
    if (submittingRef.current) {
      dispatchMatchSave(matchId)
      return
    }
    timers.current[matchId] = setTimeout(() => {
      delete timers.current[matchId]
      dispatchMatchSave(matchId)
    }, SAVE_DEBOUNCE_MS)
  }

  function setScore(matchId: string, side: 'home' | 'away', value: number | null) {
    setPredictions((prev) => {
      const cur = prev[matchId] ?? EMPTY
      const wasComplete = cur.homeScore !== null && cur.awayScore !== null
      const next = { ...cur, [side === 'home' ? 'homeScore' : 'awayScore']: value }
      markLocalEdit('matches')
      const updated = { ...prev, [matchId]: next }
      predictionsRef.current = updated
      if (next.homeScore !== null && next.awayScore !== null) {
        scheduleSave(matchId)
      } else {
        // Clearing one side invalidates the complete database row. Cancel an
        // unsent upsert and, when the previous local state was complete, queue a
        // version-safe delete on the same controller key. If that complete state
        // was only local, the RPC is idempotent; if another device created a row
        // the unknown version raises PT409 rather than deleting unseen work.
        clearMatchTimer(matchId)
        if (wasComplete) {
          dispatchMatchSave(matchId)
        } else {
          setSaveStatus((s) => ({ ...s, [matchId]: 'idle' }))
        }
      }
      return updated
    })
  }

  function toggleJoker(matchId: string) {
    setPredictions((prev) => {
      const cur = prev[matchId] ?? EMPTY
      const turningOn = !cur.joker
      const otherJokerCount = Object.entries(prev).filter(
        ([id, p]) => p.joker && id !== matchId,
      ).length
      const kickoffAt =
        (data.status === 'ready'
          ? data.data.matches.find((m) => m.id === matchId)?.kickoffAt
          : null) ?? null
      // Client-side reflection of the server rules (max-5 + kickoff-commitment).
      // The database is the authority (jokerPolicy.ts / joker-enforcement
      // migration); this just avoids an obviously-doomed round trip.
      if (!canToggleJoker({ turningOn, otherJokerCount, kickoffAt }).allowed) return prev
      markLocalEdit('matches')
      const next = { ...cur, joker: turningOn }
      const updated = { ...prev, [matchId]: next }
      predictionsRef.current = updated
      // Joker toggles save immediately (no debounce), but still go through the
      // controller so a toggle can't race a concurrent score save on the row.
      // Cancel an older score timer first so it cannot issue a duplicate later.
      clearMatchTimer(matchId)
      if (next.homeScore !== null && next.awayScore !== null) dispatchMatchSave(matchId)
      return updated
    })
  }

  function setTieResolution(scope: TieResolutionScope, orderedTeamIds: string[]) {
    const id = entryIdRef.current
    if (!id) return
    markLocalEdit('ties')
    const key = tieKey(orderedTeamIds)
    setTieResolutions((prev) => {
      const others = prev.filter((r) => tieKey(r.teamIds) !== key)
      return [...others, { teamIds: orderedTeamIds, order: orderedTeamIds }]
    })
    controller.change(tieSaveKey(key), { scope, orderedTeamIds } satisfies TieSavePayload)
  }

  // Hand the latest desired progression map to the controller. The diff against
  // the persisted baseline (upsert changed / delete removed) happens in
  // performSave, so retries recompute against the current baseline.
  function dispatchBracketSave() {
    if (!entryIdRef.current) return
    controller.change(BRACKET_KEY, {
      desired: progressionDesiredRef.current,
    } satisfies BracketSavePayload)
  }

  function setBracketProgression(next: Record<string, ProgressionStage>) {
    markLocalEdit('progression')
    setProgression(next)
    progressionDesiredRef.current = next
    if (progressionTimer.current !== undefined) clearTimeout(progressionTimer.current)
    progressionTimer.current = undefined
    // Like match edits, a bracket edit made during submit must join the barrier
    // immediately rather than hiding behind a new debounce timer.
    if (submittingRef.current) {
      dispatchBracketSave()
      return
    }
    progressionTimer.current = setTimeout(() => {
      progressionTimer.current = undefined
      dispatchBracketSave()
    }, SAVE_DEBOUNCE_MS)
  }

  function setGoldenBoot(playerId: string | null) {
    markLocalEdit('goldenBoot')
    setGoldenBootPlayerId(playerId) // optimistic — local state is never rolled back
    if (!entryIdRef.current) return
    // Now goes through the controller so a failure surfaces (with retry) instead
    // of being swallowed, and rapid select/clear can't race.
    controller.change(GOLDEN_BOOT_KEY, { playerId } satisfies GoldenBootSavePayload)
  }

  async function submit(): Promise<{ ok: boolean; message?: string }> {
    const id = entryIdRef.current
    if (!id) return { ok: false, message: 'Your entry is still loading.' }
    if (submittingRef.current) {
      return { ok: false, message: 'Your entry is already being submitted.' }
    }

    submittingRef.current = true
    setSubmitting(true)
    try {
      // Convert every pending debounce into a controller write, then wait for all
      // current/in-flight/coalesced/retrying keys. The server validator must never
      // observe the entry before the user's latest local state has settled.
      flushDebouncedSaves()
      const barrier = await controller.waitForSettled()
      if (barrier.cancelled) {
        return {
          ok: false,
          message: 'Your entry changed while saves were finishing. Please try submitting again.',
        }
      }
      if (barrier.conflictKeys.length > 0) {
        return {
          ok: false,
          message: 'Resolve the prediction conflict before submitting your entry.',
        }
      }
      if (barrier.errorKeys.length > 0) {
        return {
          ok: false,
          message: 'Some changes could not be saved. Retry the failed changes before submitting.',
        }
      }

      const when = await submitEntry(id)
      setSubmittedAt(when)
      return { ok: true }
    } catch (e) {
      return { ok: false, message: userFacingError(e, 'Submission failed. Please try again.') }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  // Re-read the server's versions (and, for the bracket, its current stages) so
  // the client's echoed versions match again. Updates version refs + the bracket
  // baseline; when applyLocal is true it also overwrites local state with the
  // server's ('Load latest'). When false it leaves local edits intact ('Keep
  // mine' — the next re-issued write overwrites the server). Best-effort per row.
  async function reloadVersionedState(id: string, applyLocal: boolean): Promise<void> {
    try {
      const rows = await fetchMatchPredictions(id)
      const vmap: Record<string, number> = {}
      const pmap: Record<string, Prediction> = {}
      for (const r of rows) {
        vmap[r.matchId] = r.version
        pmap[r.matchId] = { homeScore: r.homeScore, awayScore: r.awayScore, joker: r.joker }
      }
      matchVersionsRef.current = vmap
      if (applyLocal) {
        predictionsRef.current = pmap
        setPredictions(pmap)
        setSaveStatus({})
      }
    } catch {
      /* leave versions as-is on a transient read failure */
    }
    try {
      const prows = await fetchProgression(id)
      const smap: Record<string, ProgressionStage> = {}
      const pvmap: Record<string, number> = {}
      for (const r of prows) {
        smap[r.teamId] = r.stage
        pvmap[r.teamId] = r.version
      }
      progressionVersionsRef.current = pvmap
      progressionPersistedRef.current = smap
      if (applyLocal) {
        progressionDesiredRef.current = smap
        setProgression(smap)
        setBracketSaveStatus('idle')
      }
    } catch {
      /* ignore */
    }
    try {
      const gb = await fetchGoldenBoot(id)
      goldenBootVersionRef.current = gb.version
      if (applyLocal) {
        setGoldenBootPlayerId(gb.playerId)
        setGoldenBootSaveStatus('idle')
      }
    } catch {
      /* ignore */
    }
  }

  // Resolve a version conflict, wholesale across every key currently in conflict.
  // 'latest' discards local edits for the server's copy; 'mine' keeps local and
  // re-issues the writes against the freshly-read versions (a deliberate
  // overwrite/delete, allowed pre-lock). Local state never changes without this
  // choice.
  function resolveConflict(choice: 'latest' | 'mine') {
    const id = entryIdRef.current
    if (!id) return
    const conflictedMatches = Object.entries(saveStatus)
      .filter(([, st]) => st === 'conflict')
      .map(([m]) => m)
    const bracketConflict = bracketSaveStatus === 'conflict'
    const gbConflict = goldenBootSaveStatus === 'conflict'
    controller.reset()
    void reloadVersionedState(id, choice === 'latest').then(() => {
      if (choice === 'mine') {
        for (const m of conflictedMatches) dispatchMatchSave(m)
        if (bracketConflict) dispatchBracketSave()
        if (gbConflict) {
          controller.change(GOLDEN_BOOT_KEY, {
            playerId: goldenBootPlayerId,
          } satisfies GoldenBootSavePayload)
        }
      }
    })
  }

  const hasConflict =
    bracketSaveStatus === 'conflict' ||
    goldenBootSaveStatus === 'conflict' ||
    Object.values(saveStatus).some((st) => st === 'conflict')

  const jokerCount = useMemo(
    () => Object.values(predictions).filter((p) => p.joker).length,
    [predictions],
  )

  const value: PredictionsContextValue = {
    hasEntry: entryId !== null,
    ready,
    loadStatus,
    loadMessage,
    retryInitialLoad: () => setInitialLoadNonce((nonce) => nonce + 1),
    submittedAt,
    jokerCount,
    getPrediction: (matchId) => predictions[matchId] ?? EMPTY,
    getSaveStatus: (matchId) => saveStatus[matchId] ?? 'idle',
    setScore,
    toggleJoker,
    retrySave: (matchId) => controller.manualRetry(matchKey(matchId)),
    tieResolutions,
    getTieSaveStatus: (tiedTeamIds) => tieSaveStatus[tieKey(tiedTeamIds)] ?? 'idle',
    setTieResolution,
    bracketProgression: progression,
    bracketSaveStatus,
    setBracketProgression,
    retryBracketSave: () => controller.manualRetry(BRACKET_KEY),
    goldenBootPlayerId,
    setGoldenBoot,
    goldenBootSaveStatus,
    retryGoldenBoot: () => controller.manualRetry(GOLDEN_BOOT_KEY),
    hasConflict,
    resolveConflict,
    submitting,
    submit,
  }

  return <PredictionsContext.Provider value={value}>{children}</PredictionsContext.Provider>
}

export function usePredictions(): PredictionsContextValue {
  const ctx = useContext(PredictionsContext)
  if (!ctx) throw new Error('usePredictions must be used within a PredictionsProvider')
  return ctx
}
