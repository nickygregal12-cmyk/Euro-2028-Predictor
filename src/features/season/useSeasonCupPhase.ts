import { useCallback, useEffect, useRef, useState } from 'react'
import { userFacingError } from '../../shared/errors/userFacingError'
import {
  type CupPhasePage,
  type CupPhasePresentation,
  type SeasonCupGateway,
  presentCupPhase,
} from './cupPhaseModel'

/**
 * The Predictor Championship phase: load it, show it, reload it.
 *
 * THERE IS NO WRITE, AND THAT IS THE SHAPE OF THE CONTRACT, not an omission.
 * A Championship entrant predicts through the Match Predictor card; the
 * Championship consumes those settled points as its source. Contract 120 is a
 * read of where that has left the caller, so the only commands this hook owns
 * are load and reload.
 *
 * A LOAD FAILURE IS A FAILURE, NEVER AN EMPTY TABLE. The gateway throws on
 * error and on a malformed payload, and this hook keeps that thrown state
 * distinct from a genuinely empty table — collapsing the two is the exact
 * empty-versus-failed defect the account headline had and the repeated
 * browser-read contracts exist to end.
 */

export type SeasonCupPhaseState = {
  status: 'loading' | 'ready' | 'failed'
  page: CupPhasePage | null
  presentation: CupPhasePresentation | null
  error: string | null
  reload: () => void
}

export function useSeasonCupPhase(gateway: SeasonCupGateway): SeasonCupPhaseState {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [page, setPage] = useState<CupPhasePage | null>(null)
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
      setPage(next)
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

  return {
    status,
    page,
    presentation: page ? presentCupPhase(page) : null,
    error,
    reload: () => void load(),
  }
}
