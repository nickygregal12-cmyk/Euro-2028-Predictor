import { useEffect, useState } from 'react'
import { userFacingError } from '../../shared/errors/userFacingError'
import { searchPlayers } from '../../services/supabase/bonus'
import type { GoldenBootPlayer } from './GoldenBootPicker'

export type GoldenBootPlayerSearchState =
  | { status: 'idle'; results: GoldenBootPlayer[]; message: null }
  | { status: 'loading'; results: GoldenBootPlayer[]; message: null }
  | { status: 'ready'; results: GoldenBootPlayer[]; message: null }
  | { status: 'unavailable'; results: GoldenBootPlayer[]; message: string }

export function useGoldenBootPlayerSearch(tournamentId: string | null, query: string) {
  const [state, setState] = useState<GoldenBootPlayerSearchState>({
    status: 'idle',
    results: [],
    message: null,
  })
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed || !tournamentId) {
      setState({ status: 'idle', results: [], message: null })
      return
    }

    let active = true
    setState({ status: 'loading', results: [], message: null })
    const timer = window.setTimeout(() => {
      searchPlayers(tournamentId, trimmed)
        .then((players) => {
          if (!active) return
          setState({
            status: 'ready',
            results: players.map((player) => ({ id: player.id, name: player.name })),
            message: null,
          })
        })
        .catch((error) => {
          if (!active) return
          setState({
            status: 'unavailable',
            results: [],
            message: userFacingError(error, 'Could not search players. Please try again.'),
          })
        })
    }, 300)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query, tournamentId, retryKey])

  return {
    ...state,
    retry: () => setRetryKey((key) => key + 1),
  }
}
