import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Alert } from '../design-system'
import { weeklyRoutes } from './weeklyRoutes'
import type { InboxAction, PlayInbox } from '../features/hub/playInboxModel'
import styles from './ActionCentre.module.css'

/**
 * Everything the player owes, reachable from anywhere in the shell.
 *
 * WHY THIS IS AN OUTSTANDING COUNT AND NOT A NOTIFICATION BELL.
 * `ui-finalisation.md` § 4A decided the AppBar would carry **no** notification
 * control, and gave the reason: a bell over an inbox with no read state would
 * either shout for ever or forget on a second device. That reasoning is exactly
 * right and this control does not contradict it — it answers a different
 * question.
 *
 * "Unread" is a fact about what the player has SEEN, needs a stored cursor, and
 * is `MIG-UI-14`. "Outstanding" is a fact about what the player has DONE: it
 * comes from each game's own read, it is identical on every device because the
 * server computes it, and it clears itself when they act rather than when they
 * glance. So the badge here counts predictions not made and picks not made —
 * never messages not looked at — and the copy says "to do", never "new" and
 * never "unread".
 *
 * NOTHING HERE IS STORED IN `localStorage`, and that is deliberate rather than
 * incidental: there is no dismiss, no mark-as-seen and no per-item state at
 * all, so there is nothing that could be mistaken for cross-device persistence.
 * When contract 162's `get_my_actions` / `mark_actions_seen` / `dismiss_action`
 * are reachable from a browser, seen and dismissed state joins this panel and
 * the badge can start distinguishing new from outstanding. Until then it says
 * only what it can prove.
 *
 * IT COMPUTES NO DEADLINE, LOCK OR PROGRESS. `presentPlayInbox` groups; each
 * game's own read decided what is due. This renders.
 *
 * IT IS ONE COMPONENT AT BOTH WIDTHS. A bottom sheet on a phone and a docked
 * side panel on a desktop are the same list with a different frame, which is
 * CSS — building two would be two chances for the urgent group to disagree
 * with itself.
 */

export type ActionCentreProps = {
  open: boolean
  onClose: () => void
  status: 'loading' | 'ready'
  inbox: PlayInbox | null
}

export function ActionCentre({ open, onClose, status, inbox }: ActionCentreProps) {
  const closer = useRef<HTMLButtonElement>(null)

  // Focus moves into the panel when it opens, and Escape closes it. Both are
  // the minimum a thing that covers the page owes a keyboard: without them the
  // tab order continues behind the scrim and there is no way out.
  useEffect(() => {
    if (!open) return
    closer.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.root}>
      {/* The click-away, as a real button and a SIBLING of the panel rather
          than its wrapper. A div with a click handler is not keyboard operable
          and nesting the dialog inside an interactive element is invalid; this
          is neither. It is hidden from assistive technology and out of the tab
          order on purpose — a full-screen tab stop in front of a dialog helps
          nobody, and a keyboard user already has Escape and the Close button. */}
      <button
        type="button"
        className={styles.scrim}
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-centre-title"
      >
        <header className={styles.head}>
          <h2 className={styles.title} id="action-centre-title">
            To do
          </h2>
          <button type="button" className={styles.close} onClick={onClose} ref={closer}>
            Close
          </button>
        </header>

        {status === 'loading' || !inbox ? (
          <p className={styles.note} aria-live="polite">
            Checking your competitions…
          </p>
        ) : (
          <>
            {inbox.unreadable.length > 0 ? (
              // Named rather than dropped: silently omitting a competition
              // would tell a player they are up to date while a lock passes.
              <Alert variant="warning" title="Some competitions could not be checked">
                {inbox.unreadable.join(', ')}. Anything due there is missing from this list.
              </Alert>
            ) : null}

            <Group title="Due soon" actions={inbox.urgent} onNavigate={onClose} urgent />
            <Group title="This week" actions={inbox.thisWeek} onNavigate={onClose} />
            <Group title="Done and waiting" actions={inbox.settled} onNavigate={onClose} />

            {inbox.allClear ? (
              <p className={styles.clear}>You are up to date in every competition you play.</p>
            ) : null}

            {inbox.empty ? (
              <p className={styles.note}>
                Nothing to do yet — join a game in a competition and it will appear here.
              </p>
            ) : null}
          </>
        )}

        <Link className={styles.all} to={weeklyRoutes.play} onClick={onClose}>
          Open Play
        </Link>
      </div>
    </div>
  )
}

function Group({
  title,
  actions,
  onNavigate,
  urgent = false,
}: {
  title: string
  actions: readonly InboxAction[]
  onNavigate: () => void
  urgent?: boolean
}) {
  if (actions.length === 0) return null
  return (
    <section className={styles.group}>
      <h3 className={styles.groupTitle}>{title}</h3>
      <ul className={styles.list}>
        {actions.map((action) => {
          const body = (
            <>
              <span className={styles.actionTitle}>{action.title}</span>
              <span className={styles.actionWhere}>
                {action.gameName} · {action.competitionName} {action.seasonLabel}
              </span>
            </>
          )
          return (
            <li key={action.key} className={urgent ? styles.itemUrgent : styles.item}>
              {/* An action with no route is still shown. It is something the
                  player owes; hiding it because this build cannot link to it
                  would under-report what is due. */}
              {action.href ? (
                <Link className={styles.action} to={action.href} onClick={onNavigate}>
                  {body}
                </Link>
              ) : (
                <span className={styles.action}>{body}</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
