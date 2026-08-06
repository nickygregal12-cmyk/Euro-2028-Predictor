import { useCallback, useEffect, useRef, useState } from 'react'
import { userFacingError } from '../../shared/errors/userFacingError'
import {
  type LmsRegistrationFacts,
  type LmsRegistrationPresentation,
  type RegistrationCopy,
  type SeasonLmsRegistrationGateway,
  lmsRegistrationRefusal,
  presentLmsRegistration,
} from './lmsRegistrationModel'

/**
 * Registration for a season Last Man Standing competition: load where it
 * stands, join, live with the refusal.
 *
 * JOINING IS NOT OPTIMISTIC. Entry is a commitment the settlement job acts on,
 * and the server holds five separate rules that can refuse it. Showing a
 * player as entered before the write returns would show them a membership
 * they may not have.
 *
 * A REFUSAL IS FOLLOWED BY A RELOAD, and that is the part that carries the
 * meaning. `55000` cannot say which of its five rules refused the join, so the
 * reloaded facts — resolved from stored instants — are what actually tell the
 * player whether registration closed, has not opened, or the competition
 * finished under them. The refusal sentence keeps them informed in the
 * meantime; the reloaded panel is the answer.
 */

export type SeasonLmsRegistrationState = {
  status: 'loading' | 'ready' | 'failed'
  facts: LmsRegistrationFacts | null
  presentation: LmsRegistrationPresentation | null
  joining: boolean
  error: string | null
  join: () => void
  reload: () => void
}

export function useSeasonLmsRegistration(
  gateway: SeasonLmsRegistrationGateway,
  copy: RegistrationCopy,
  onJoined?: () => void,
): SeasonLmsRegistrationState {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [facts, setFacts] = useState<LmsRegistrationFacts | null>(null)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sequence = useRef(0)

  const load = useCallback(async () => {
    sequence.current += 1
    const ticket = sequence.current
    setStatus('loading')
    setError(null)
    try {
      const next = await gateway.load()
      if (ticket !== sequence.current) return
      setFacts(next)
      setStatus('ready')
    } catch (cause) {
      if (ticket !== sequence.current) return
      setError(userFacingError(cause))
      setStatus('failed')
    }
  }, [gateway])

  useEffect(() => {
    void load()
  }, [load])

  const join = useCallback(() => {
    setJoining(true)
    setError(null)
    void (async () => {
      try {
        await gateway.join()
        // The round surface holds a stale "you are not entered"; it is told to
        // reload rather than being left to disagree with this panel.
        onJoined?.()
        await load()
      } catch (cause) {
        // Reload even on refusal — the reloaded state is what explains an
        // ambiguous 55000 — but set the sentence AFTER it, because `load`
        // clears the error and would otherwise erase the only explanation the
        // player gets.
        const refusal = lmsRegistrationRefusal(cause)
        await load()
        setError(refusal)
      } finally {
        setJoining(false)
      }
    })()
  }, [gateway, load, onJoined])

  return {
    status,
    facts,
    presentation: facts ? presentLmsRegistration(facts, copy) : null,
    joining,
    error,
    join,
    reload: () => void load(),
  }
}
