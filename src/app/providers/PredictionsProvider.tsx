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
  fetchMatchPredictions,
  getOrCreateEntry,
  submitEntry,
  upsertMatchPrediction,
} from '../../services/supabase/predictions'
import { fetchGoldenBoot, upsertGoldenBoot } from '../../services/supabase/bonus'
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
import { useAuth } from '../../features/auth/AuthProvider'
import { useTournamentData } from './TournamentDataProvider'

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

type PredictionsContextValue = {
  ready: boolean
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
  // Submission. `submit` calls the server-side validator; it does not freeze the
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
  const [submitting, setSubmitting] = useState(false)
  const [ready, setReady] = useState(false)

  // Latest predictions + entryId for the debounced saver to read without going
  // stale between the timer being set and firing.
  const predictionsRef = useRef(predictions)
  predictionsRef.current = predictions
  const entryIdRef = useRef<string | null>(null)
  entryIdRef.current = entryId
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Bracket persistence baselines: `persisted` is what's currently in the DB,
  // `desired` is the latest map the user has picked. The debounced flush syncs
  // one to the other (upserting changed teams, deleting removed ones).
  const progressionPersistedRef = useRef<Record<string, ProgressionStage>>({})
  const progressionDesiredRef = useRef<Record<string, ProgressionStage>>({})
  const progressionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!userId || !tournamentId) {
      setReady(false)
      return
    }
    let active = true
    setReady(false)
    getOrCreateEntry(userId, tournamentId)
      .then(async (entry) => {
        if (!active) return
        setEntryId(entry.id)
        setSubmittedAt(entry.submittedAt)
        const rows = await fetchMatchPredictions(entry.id)
        if (!active) return
        const map: Record<string, Prediction> = {}
        for (const r of rows) {
          map[r.matchId] = { homeScore: r.homeScore, awayScore: r.awayScore, joker: r.joker }
        }
        setPredictions(map)
        setReady(true)
        // Tie-resolutions load best-effort: they default to empty, so a failure
        // (e.g. the follow-up migration not yet applied to this DB) leaves ties
        // showing as unresolved rather than blocking the whole entry from
        // loading. Unresolved is the safe direction — it keeps Review locked.
        fetchTieResolutions(entry.id)
          .then((ties) => {
            if (active) setTieResolutions(ties.map((t) => ({ teamIds: t.teamIds, order: t.order })))
          })
          .catch(() => {
            if (active) setTieResolutions([])
          })
        // Knockout progression loads best-effort too (same fail-soft reasoning:
        // no picks is the safe default that keeps Review honestly locked).
        fetchProgression(entry.id)
          .then((rows) => {
            if (!active) return
            const map: Record<string, ProgressionStage> = {}
            for (const r of rows) map[r.teamId] = r.stage
            setProgression(map)
            progressionPersistedRef.current = map
            progressionDesiredRef.current = map
          })
          .catch(() => {
            if (!active) return
            setProgression({})
            progressionPersistedRef.current = {}
            progressionDesiredRef.current = {}
          })
        // Golden-boot selection loads best-effort too (the bonus tables may not
        // be applied to this DB yet; a failure leaves it unset, which is safe).
        fetchGoldenBoot(entry.id)
          .then((id) => {
            if (active) setGoldenBootPlayerId(id)
          })
          .catch(() => {
            if (active) setGoldenBootPlayerId(null)
          })
      })
      .catch(() => {
        if (active) setReady(false)
      })
    return () => {
      active = false
    }
  }, [userId, tournamentId])

  function save(matchId: string) {
    const id = entryIdRef.current
    const pred = predictionsRef.current[matchId]
    if (!id || !pred || pred.homeScore === null || pred.awayScore === null) return
    setSaveStatus((s) => ({ ...s, [matchId]: 'saving' }))
    upsertMatchPrediction(id, matchId, pred.homeScore, pred.awayScore, pred.joker)
      .then(() => setSaveStatus((s) => ({ ...s, [matchId]: 'saved' })))
      .catch(() => setSaveStatus((s) => ({ ...s, [matchId]: 'error' })))
  }

  function scheduleSave(matchId: string) {
    clearTimeout(timers.current[matchId])
    timers.current[matchId] = setTimeout(() => save(matchId), SAVE_DEBOUNCE_MS)
  }

  function setScore(matchId: string, side: 'home' | 'away', value: number | null) {
    setPredictions((prev) => {
      const cur = prev[matchId] ?? EMPTY
      const next = { ...cur, [side === 'home' ? 'homeScore' : 'awayScore']: value }
      const updated = { ...prev, [matchId]: next }
      predictionsRef.current = updated
      if (next.homeScore !== null && next.awayScore !== null) {
        scheduleSave(matchId)
      } else {
        // Incomplete score: nothing to persist yet (both halves are required).
        setSaveStatus((s) => ({ ...s, [matchId]: 'idle' }))
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
      const next = { ...cur, joker: turningOn }
      const updated = { ...prev, [matchId]: next }
      predictionsRef.current = updated
      if (next.homeScore !== null && next.awayScore !== null) save(matchId)
      return updated
    })
  }

  function setTieResolution(scope: TieResolutionScope, orderedTeamIds: string[]) {
    const id = entryIdRef.current
    if (!id) return
    const key = tieKey(orderedTeamIds)
    setTieResolutions((prev) => {
      const others = prev.filter((r) => tieKey(r.teamIds) !== key)
      return [...others, { teamIds: orderedTeamIds, order: orderedTeamIds }]
    })
    setTieSaveStatus((s) => ({ ...s, [key]: 'saving' }))
    upsertTieResolution(id, scope, orderedTeamIds)
      .then(() => setTieSaveStatus((s) => ({ ...s, [key]: 'saved' })))
      .catch(() => setTieSaveStatus((s) => ({ ...s, [key]: 'error' })))
  }

  // Reconcile stored progression to the desired map: upsert changed teams,
  // delete removed ones. On full success the persisted baseline advances.
  function flushProgression() {
    const id = entryIdRef.current
    if (!id) return
    const desired = progressionDesiredRef.current
    const persisted = progressionPersistedRef.current
    const ops: Promise<void>[] = []
    for (const [teamId, stage] of Object.entries(desired)) {
      if (persisted[teamId] !== stage) ops.push(upsertProgression(id, teamId, stage))
    }
    for (const teamId of Object.keys(persisted)) {
      if (desired[teamId] === undefined) ops.push(deleteProgression(id, teamId))
    }
    if (ops.length === 0) {
      setBracketSaveStatus('saved')
      return
    }
    setBracketSaveStatus('saving')
    Promise.all(ops)
      .then(() => {
        // Advance the baseline only to the snapshot we just wrote.
        progressionPersistedRef.current = desired
        setBracketSaveStatus('saved')
      })
      .catch(() => setBracketSaveStatus('error'))
  }

  function setBracketProgression(next: Record<string, ProgressionStage>) {
    setProgression(next)
    progressionDesiredRef.current = next
    clearTimeout(progressionTimer.current)
    progressionTimer.current = setTimeout(flushProgression, SAVE_DEBOUNCE_MS)
  }

  function setGoldenBoot(playerId: string | null) {
    const id = entryIdRef.current
    setGoldenBootPlayerId(playerId) // optimistic
    if (!id) return
    upsertGoldenBoot(id, playerId).catch(() => {
      // Best-effort; leave the optimistic value. The server stays authoritative
      // and the picker is unusable until squads exist anyway.
    })
  }

  async function submit(): Promise<{ ok: boolean; message?: string }> {
    const id = entryIdRef.current
    if (!id) return { ok: false, message: 'Your entry is still loading.' }
    setSubmitting(true)
    try {
      const when = await submitEntry(id)
      setSubmittedAt(when)
      return { ok: true }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Submission failed.' }
    } finally {
      setSubmitting(false)
    }
  }

  const jokerCount = useMemo(
    () => Object.values(predictions).filter((p) => p.joker).length,
    [predictions],
  )

  const value: PredictionsContextValue = {
    ready,
    submittedAt,
    jokerCount,
    getPrediction: (matchId) => predictions[matchId] ?? EMPTY,
    getSaveStatus: (matchId) => saveStatus[matchId] ?? 'idle',
    setScore,
    toggleJoker,
    retrySave: (matchId) => save(matchId),
    tieResolutions,
    getTieSaveStatus: (tiedTeamIds) => tieSaveStatus[tieKey(tiedTeamIds)] ?? 'idle',
    setTieResolution,
    bracketProgression: progression,
    bracketSaveStatus,
    setBracketProgression,
    retryBracketSave: flushProgression,
    goldenBootPlayerId,
    setGoldenBoot,
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
