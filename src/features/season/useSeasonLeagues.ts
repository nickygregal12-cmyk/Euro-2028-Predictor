import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameLeague } from '../../services/supabase/gameLeagues'
import { userFacingError } from '../../shared/errors/userFacingError'
import {
  type SeasonLeaguesGateway,
  leagueCreateRefusal,
  leagueJoinRefusal,
} from './gameLeaguesModel'

/**
 * A competition's private leagues for one game: list, create, join.
 *
 * EVERY WRITE RELOADS THE LIST, and the list is the only place the result is
 * shown. Appending the created league locally would make the browser a second
 * authority on what the caller belongs to, and the two would disagree the
 * first time a create partly succeeded. The reload is one round trip and the
 * list is at most twenty rows.
 *
 * THE REFUSAL IS SET AFTER THE RELOAD, not before it. Setting it first and
 * reloading afterwards clears it: the reload resets the panel's error state,
 * and the player is left with a control that did nothing and said nothing.
 * This is the same ordering `useSeasonLmsRegistration` needed, for the same
 * reason.
 *
 * A FAILED WRITE DOES NOT BLANK THE LIST. The leagues already read stay on
 * screen and the refusal appears beside the control that produced it — a
 * rejected league name should not take the player's existing leagues away.
 *
 * A LATE RESPONSE NEVER WINS: each load takes a sequence number, so a slow
 * first read cannot land on top of a reload that followed it.
 */

export type SeasonLeaguesState = {
  status: 'loading' | 'ready' | 'failed'
  leagues: readonly GameLeague[]
  /** Set when the initial read failed. Never rendered as an empty list. */
  error: string | null
  creating: boolean
  createError: string | null
  joining: boolean
  joinError: string | null
  create: (name: string) => Promise<boolean>
  join: (code: string) => Promise<boolean>
  reload: () => void
}

export function useSeasonLeagues(gateway: SeasonLeaguesGateway): SeasonLeaguesState {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [leagues, setLeagues] = useState<readonly GameLeague[]>([])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const sequence = useRef(0)

  const load = useCallback(async () => {
    sequence.current += 1
    const ticket = sequence.current
    setStatus('loading')

    try {
      const rows = await gateway.load()
      if (ticket !== sequence.current) return
      setLeagues(rows)
      setStatus('ready')
      setError(null)
    } catch (cause) {
      if (ticket !== sequence.current) return
      setError(userFacingError(cause))
      setStatus('failed')
    }
  }, [gateway])

  useEffect(() => {
    void load()
  }, [load])

  const create = useCallback(
    async (name: string) => {
      setCreating(true)
      setCreateError(null)
      try {
        await gateway.create(name)
        await load()
        return true
      } catch (cause) {
        const refusal = leagueCreateRefusal(cause)
        setCreateError(refusal)
        return false
      } finally {
        setCreating(false)
      }
    },
    [gateway, load],
  )

  const join = useCallback(
    async (code: string) => {
      setJoining(true)
      setJoinError(null)
      try {
        await gateway.join(code)
        await load()
        return true
      } catch (cause) {
        const refusal = leagueJoinRefusal(cause)
        setJoinError(refusal)
        return false
      } finally {
        setJoining(false)
      }
    },
    [gateway, load],
  )

  return {
    status,
    leagues,
    error,
    creating,
    createError,
    joining,
    joinError,
    create,
    join,
    reload: useCallback(() => void load(), [load]),
  }
}
