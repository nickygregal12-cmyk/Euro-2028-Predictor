import { useState } from 'react'
import { buildShareContent, type ShareSubject } from './shareTextModel'
import styles from './ShareAction.module.css'

/**
 * `INNOV-007` — one share control, used wherever there is something safe to
 * share.
 *
 * IT IS THE NATIVE SHEET WHERE THERE IS ONE, AND A COPY EVERYWHERE ELSE. The
 * Web Share API is the right control on a phone and absent on most desktops;
 * the fallback is not a degraded experience, it is the desktop experience, and
 * it says which of the two happened rather than showing the same toast for
 * both.
 *
 * IT NEVER REPORTS A CANCELLATION AS A FAILURE. Dismissing the system sheet
 * rejects with `AbortError`, and telling a player "sharing failed" because they
 * changed their mind is how a control loses trust.
 *
 * WHAT IT SHARES IS NOT THIS COMPONENT'S DECISION. `buildShareContent` owns the
 * sentence and the allow-list; this renders a button and reports what happened.
 *
 * IT IS NOT LOADED BY THE PREDICTION ROUTES THAT DO NOT USE IT. There is no
 * canvas, no image encoder and no font here — the existing tournament share
 * card is a separate, heavier surface and stays where it is.
 */

export type ShareActionProps = {
  subject: ShareSubject
  /** Absolute or root-relative URL of the surface being shared. */
  url: string
  /** Overrides the button text where "Share" alone would be ambiguous. */
  label?: string
}

type Outcome = null | 'shared' | 'copied' | 'unavailable'

type ShareCapableNavigator = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>
}

export function ShareAction({ subject, url, label = 'Share' }: ShareActionProps) {
  const [outcome, setOutcome] = useState<Outcome>(null)

  const onShare = async () => {
    const absolute =
      url.startsWith('http') || typeof window === 'undefined'
        ? url
        : new URL(url, window.location.origin).toString()
    const content = buildShareContent(subject, absolute)
    const target = globalThis.navigator as ShareCapableNavigator | undefined

    if (typeof target?.share === 'function') {
      try {
        await target.share({ title: content.title, text: content.text, url: content.url })
        setOutcome('shared')
        return
      } catch (error) {
        // A dismissed sheet is not a failure. Anything else falls through to
        // the clipboard, which is a working outcome rather than an error.
        if (error instanceof Error && error.name === 'AbortError') {
          setOutcome(null)
          return
        }
      }
    }

    try {
      await globalThis.navigator?.clipboard?.writeText(content.clipboard)
      setOutcome('copied')
    } catch {
      // No share sheet and no clipboard: say so plainly rather than claiming
      // something was copied that was not.
      setOutcome('unavailable')
    }
  }

  return (
    <span className={styles.wrap}>
      <button type="button" className={styles.button} onClick={() => void onShare()}>
        {label}
      </button>
      {/* Announced, because the result of pressing this button is invisible
          otherwise — the system sheet closes and nothing on the page changes. */}
      <span className={styles.status} role="status">
        {outcome === 'shared'
          ? 'Shared.'
          : outcome === 'copied'
            ? 'Copied to your clipboard.'
            : outcome === 'unavailable'
              ? 'Sharing is not available in this browser.'
              : ''}
      </span>
    </span>
  )
}
