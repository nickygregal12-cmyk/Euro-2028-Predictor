import { useCallback, useState } from 'react'
import { Alert } from '../../design-system'
import { TURNSTILE_SITE_KEY, turnstileEnabled } from './turnstileConfig'
import { TurnstileWidget, type TurnstileStatus } from './TurnstileWidget'
import s from './auth.module.css'

export type TurnstileFieldProps = {
  /**
   * Remount key from the parent form. A Turnstile token is single-use, so a
   * failed submit changes this to force a fresh challenge.
   */
  resetKey: number
  onToken: (token: string | null) => void
  className?: string
}

/**
 * The optional public support address, read the same way `/account` reads it.
 *
 * A blank value means there is nobody to write to, and the line is omitted
 * rather than rendering a `mailto:` that goes nowhere — the same rule the
 * Account page's Contact admin link already follows.
 */
const SUPPORT_EMAIL: string | null =
  import.meta.env.VITE_SUPPORT_EMAIL?.trim() || null

/**
 * The verification step on the auth forms, including what happens when it
 * cannot load.
 *
 * THE DEFECT THIS CLOSES. Every form gates submit on holding a Turnstile token.
 * The script is third-party and cross-origin, so a content blocker, a corporate
 * proxy, a strict extension or simply being offline stops it arriving — and
 * when that happened the only signal was `onToken(null)`, which is
 * indistinguishable from "the visitor has not solved it yet". The result was a
 * sign-up page with a permanently disabled button, no widget, no message, and
 * nothing to press. A visitor could not create an account and could not find
 * out why.
 *
 * WHAT IT DOES NOT DO. It does not weaken verification and adds no bypass:
 * a failure still yields no token, and submit is still refused. Verification is
 * enforced by Supabase running siteverify server-side in any case, so a
 * frontend bypass would not even work — it would just move the refusal later
 * and make it more confusing.
 *
 * WHAT IT ADDS is an explanation in plain words, a Retry that remounts the
 * widget for a fresh attempt, and — where a support address is configured — a
 * way to reach a person. Where one is not configured, the line is omitted
 * rather than pointing at an address that does not exist.
 */
export function TurnstileField({ resetKey, onToken, className }: TurnstileFieldProps) {
  const [status, setStatus] = useState<TurnstileStatus>('loading')
  // Remounting the widget is what a retry IS: the script tag may already be in
  // the document, so re-running the effect re-attempts both the load and the
  // render rather than only one of them.
  const [attempt, setAttempt] = useState(0)

  const handleStatus = useCallback((next: TurnstileStatus) => setStatus(next), [])

  if (!turnstileEnabled || !TURNSTILE_SITE_KEY) return null

  return (
    <div className={s.turnstileField}>
      <TurnstileWidget
        key={`${resetKey}:${attempt}`}
        siteKey={TURNSTILE_SITE_KEY}
        onToken={onToken}
        onStatusChange={handleStatus}
        className={className}
      />

      {status === 'failed' ? (
        <Alert variant="error" title="We could not load the security check">
          <p className={s.turnstileFailureBody}>
            This form needs a quick check that you are not a robot, and it did not
            load. An ad or script blocker, a work network, or being offline are the
            usual causes.
          </p>
          <div className={s.turnstileFailureActions}>
            <button
              type="button"
              className={s.turnstileFailureAction}
              onClick={() => {
                setStatus('loading')
                setAttempt((value) => value + 1)
              }}
            >
              Try the check again
            </button>
            {SUPPORT_EMAIL ? (
              <a className={s.turnstileFailureAction} href={`mailto:${SUPPORT_EMAIL}`}>
                Email us instead
              </a>
            ) : null}
          </div>
        </Alert>
      ) : null}
    </div>
  )
}
