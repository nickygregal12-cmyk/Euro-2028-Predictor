import { useId, useState } from 'react'
import { Alert, Button } from '../../design-system'
import { rotateLeagueInviteCode } from '../../services/supabase/leagues'
import { userFacingError } from '../../shared/errors/userFacingError'
import s from './InvitePanel.module.css'

export type RotateInviteCodeControlProps = {
  leagueId: string
  leagueName: string
  /** The code currently on screen, so the confirmation can name what it breaks. */
  currentCode: string
  /** Told the new code so the surrounding surface can show it without a refetch. */
  onRotated: (newCode: string) => void
  /** Injectable, so the confirm/failure/refusal states are provable without a network. */
  rotate?: (leagueId: string) => Promise<string>
}

type Phase = 'idle' | 'confirming' | 'working' | 'failed'

/**
 * Issue a league a new invite code (contract 158, `SEC-001`).
 *
 * WHY IT CONFIRMS RATHER THAN ACTING. Rotating is consequential and
 * irreversible in the way that matters to a real person: every invite already
 * sent — in a group chat, in a message, written on a beer mat — stops working
 * the instant the server returns, and there is no way to put the old code back.
 * So the control states that consequence in the confirmation, in those terms,
 * rather than asking "are you sure?".
 *
 * IT IS OFFERED ONLY TO AN OWNER, AND THAT IS NOT THE CONTROL. The server is
 * owner-only inside and refuses anyone else; hiding the button for a non-owner
 * is presentation, so a refusal that arrives anyway — from a stale page — is
 * still shown rather than swallowed. A hidden control is never an
 * authorisation.
 *
 * IT SHOWS THE NEW CODE THROUGH THE SURFACE IT CAME FROM. `onRotated` hands the
 * code back rather than this component rendering a second copy of the invite
 * affordance — one invite panel per league, and it is the one already on screen.
 */
export function RotateInviteCodeControl({
  leagueId,
  leagueName,
  currentCode,
  onRotated,
  rotate = rotateLeagueInviteCode,
}: RotateInviteCodeControlProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [rotated, setRotated] = useState(false)
  const dialogId = useId()

  async function confirm() {
    setPhase('working')
    setError(null)
    try {
      const next = await rotate(leagueId)
      onRotated(next)
      setRotated(true)
      setPhase('idle')
    } catch (cause) {
      // MAPPED, NOT VERBATIM. `userFacingError` is the repository's rule that no
      // raw database, RPC or network detail reaches a player; an owner-only
      // refusal arrives as `42501` and reads as "You don't have permission to do
      // that." The refusal is still SHOWN — what is withheld is the plumbing,
      // not the fact that the server said no.
      setError(
        userFacingError(
          cause,
          'The invite code could not be changed. Please try again.',
        ),
      )
      setPhase('failed')
    }
  }

  if (phase === 'idle' || phase === 'failed') {
    return (
      <div className={s.rotate}>
        <Button
          variant="secondary"
          onClick={() => {
            setError(null)
            setPhase('confirming')
          }}
        >
          New invite code
        </Button>
        {/* `Alert` already announces its error variant assertively, so this
            adds no role of its own. */}
        {error ? <Alert variant="error">{error}</Alert> : null}
        <span className={s.srLive} aria-live="polite">
          {rotated ? `New invite code issued for ${leagueName}. The old code no longer works.` : ''}
        </span>
      </div>
    )
  }

  return (
    <div className={s.rotate} role="group" aria-labelledby={dialogId}>
      <p id={dialogId} className={s.rotateWarning}>
        <strong>{currentCode} will stop working.</strong> Anyone you have already
        sent it to will not be able to join {leagueName} with it, and it cannot be
        put back. Members already in the league are not affected.
      </p>
      <div className={s.rotateActions}>
        <Button onClick={confirm} disabled={phase === 'working'}>
          {phase === 'working' ? 'Issuing…' : 'Issue a new code'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setPhase('idle')}
          disabled={phase === 'working'}
        >
          Keep {currentCode}
        </Button>
      </div>
    </div>
  )
}
