import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { LeagueId, PredictionScore } from './types'

interface PrototypeState {
  league: LeagueId
  predictions: Record<string, PredictionScore>
  submitted: boolean
  signedIn: boolean
  lmsSelection: string | null
}

interface PrototypeStore extends PrototypeState {
  setLeague: (league: LeagueId) => void
  setPrediction: (fixtureId: string, score: PredictionScore) => void
  submitPredictions: () => void
  signIn: () => void
  signOut: () => void
  setLmsSelection: (clubId: string | null) => void
  reset: () => void
}

const STORAGE_KEY = 'touchline-prototype-v1'
const INITIAL: PrototypeState = {
  league: 'premier-league',
  predictions: {},
  submitted: false,
  signedIn: false,
  lmsSelection: null,
}

const PrototypeContext = createContext<PrototypeStore | null>(null)

function readStoredState(): PrototypeState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? { ...INITIAL, ...JSON.parse(stored) } : INITIAL
  } catch {
    return INITIAL
  }
}

export function PrototypeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PrototypeState>(readStoredState)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const value = useMemo<PrototypeStore>(() => ({
    ...state,
    setLeague: (league) => setState((current) => ({ ...current, league, submitted: false })),
    setPrediction: (fixtureId, score) => setState((current) => ({
      ...current,
      submitted: false,
      predictions: { ...current.predictions, [fixtureId]: score },
    })),
    submitPredictions: () => setState((current) => ({ ...current, submitted: true })),
    signIn: () => setState((current) => ({ ...current, signedIn: true })),
    signOut: () => setState((current) => ({ ...current, signedIn: false })),
    setLmsSelection: (lmsSelection) => setState((current) => ({ ...current, lmsSelection })),
    reset: () => setState(INITIAL),
  }), [state])

  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>
}

export function usePrototype() {
  const value = useContext(PrototypeContext)
  if (!value) throw new Error('usePrototype must be used inside PrototypeProvider')
  return value
}

