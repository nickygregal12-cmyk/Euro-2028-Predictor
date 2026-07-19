import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchTournamentData, type TournamentData } from '../../services/supabase/tournamentData'
import { useAuth } from '../../features/auth/AuthProvider'

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
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!userId) {
      setState({ status: 'idle' })
      return
    }
    let active = true
    setState({ status: 'loading' })
    fetchTournamentData()
      .then((data) => {
        if (active) setState({ status: 'ready', data })
      })
      .catch((err: unknown) => {
        if (active) {
          setState({ status: 'error', message: err instanceof Error ? err.message : 'Failed to load' })
        }
      })
    return () => {
      active = false
    }
  }, [userId, nonce])

  return (
    <TournamentDataContext.Provider value={{ ...state, reload: () => setNonce((n) => n + 1) }}>
      {children}
    </TournamentDataContext.Provider>
  )
}

export function useTournamentData(): TournamentDataContextValue {
  const ctx = useContext(TournamentDataContext)
  if (!ctx) throw new Error('useTournamentData must be used within a TournamentDataProvider')
  return ctx
}
