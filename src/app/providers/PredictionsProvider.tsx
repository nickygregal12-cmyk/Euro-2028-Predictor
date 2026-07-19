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
  upsertMatchPrediction,
} from '../../services/supabase/predictions'
import { useAuth } from '../../features/auth/AuthProvider'
import { useTournamentData } from './TournamentDataProvider'

// Central prediction state for the whole entry: the hub reads aggregate counts
// from it, the group predictor reads/writes individual scores. Autosave is
// debounced per match; the server stays the authority on locks, so save
// failures surface on the card rather than being swallowed.

export const MAX_JOKERS = 5
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
  const [ready, setReady] = useState(false)

  // Latest predictions + entryId for the debounced saver to read without going
  // stale between the timer being set and firing.
  const predictionsRef = useRef(predictions)
  predictionsRef.current = predictions
  const entryIdRef = useRef<string | null>(null)
  entryIdRef.current = entryId
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

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
      const count = Object.values(prev).filter((p) => p.joker).length
      // Client-side guard only; the max-5 rule and kickoff lock are enforced
      // server-side (docs/scoring-rules.md / migration note).
      if (turningOn && count >= MAX_JOKERS) return prev
      const next = { ...cur, joker: turningOn }
      const updated = { ...prev, [matchId]: next }
      predictionsRef.current = updated
      if (next.homeScore !== null && next.awayScore !== null) save(matchId)
      return updated
    })
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
  }

  return <PredictionsContext.Provider value={value}>{children}</PredictionsContext.Provider>
}

export function usePredictions(): PredictionsContextValue {
  const ctx = useContext(PredictionsContext)
  if (!ctx) throw new Error('usePredictions must be used within a PredictionsProvider')
  return ctx
}
