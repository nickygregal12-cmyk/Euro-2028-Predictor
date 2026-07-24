import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { fetchTournamentData, type TournamentData } from '../../services/supabase/tournamentData'
import { useAuth } from '../../features/auth/AuthProvider'
import { useReturnToForeground } from './useReturnToForeground'

// Loads the tournament reference data once the user is authenticated (RLS makes
// it readable only to authenticated users). Exposes a status the screens turn
// into loading / error / ready states — never a blank flash.

type DataState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: TournamentData }

type TournamentDataContextValue = DataState & { reload: () => void }

const TournamentDataContext = createContext<TournamentDataContextValue | null>(null)

export function TournamentDataProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()
  const [state, setState] = useState<DataState>({ status: 'idle' })
  const stateRef = useRef(state)
  stateRef.current = state
  const [nonce, setNonce] = useState(0)
  const requestGenerationRef = useRef(0)

  function reload() {
    setNonce((n) => n + 1)
  }

  useReturnToForeground(reload)

  useEffect(() => {
    if (!userId) {
      requestGenerationRef.current += 1
      setState({ status: 'idle' })
      return
    }

    let active = true
    const requestGeneration = ++requestGenerationRef.current
    const isBackgroundRefresh = stateRef.current.status === 'ready'
    if (!isBackgroundRefresh) setState({ status: 'loading' })

    fetchTournamentData()
      .then((data) => {
        if (active && requestGeneration === requestGenerationRef.current) {
          setState({ status: 'ready', data })
        }
      })
      .catch((err: unknown) => {
        if (!active || requestGeneration !== requestGenerationRef.current) return
        // A failed foreground refresh must not turn valid, already-rendered data
        // into a blocking error screen. Initial-load failures still surface.
        if (stateRef.current.status !== 'ready') {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to load',
          })
        }
      })

    return () => {
      active = false
    }
  }, [userId, nonce])

  return (
    <TournamentDataContext.Provider value={{ ...state, reload }}>
      {children}
    </TournamentDataContext.Provider>
  )
}

export function useTournamentData(): TournamentDataContextValue {
  const ctx = useContext(TournamentDataContext)
  if (!ctx) throw new Error('useTournamentData must be used within a TournamentDataProvider')
  return ctx
}
