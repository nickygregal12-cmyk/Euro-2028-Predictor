import { Inbox } from 'lucide-react'
import { useRef } from 'react'
import text from '../foundations/typography.module.css'
import styles from './ActionCentreControl.module.css'

/**
 * THE WAY INTO THE ACTION CENTRE.
 *
 * ============================ IT IS PERMANENT, AND THAT IS THE DIFFERENCE
 *
 * `AttentionElsewhereControl` renders NOTHING when nothing is waiting — its own
 * header argues that permanent chrome saying "0" has to be read every time to
 * learn it has nothing to say, and for a secondary urgency layer that is right.
 *
 * This one stays, and the argument is different rather than contradictory. The
 * Action Centre is a PLACE — it holds what happened as well as what is owed, so
 * it is worth visiting on a quiet day, and a control that vanished when the
 * feed was empty would be a destination the player could not navigate to
 * precisely when they wanted to check nothing had been missed. What it does not
 * do is shout: with no unread items it carries no count at all, which is the
 * same restraint applied to the badge rather than to the control.
 *
 * ============================ THE COUNT IS THE SERVER'S ==================
 *
 * `unseen` comes from `get_my_actions`, which computes it over the whole table
 * from the same predicate as the list. It is never a count of the rendered
 * rows: the read caps at fifty, so counting rows would quietly under-report,
 * and the migration's own comment says a badge that disagrees with the inbox it
 * opens is worse than no badge.
 *
 * `null` IS "NOT LOADED" AND DRAWS NO COUNT. Not a zero — zero is the claim
 * "nothing is unread", and the read has not made it yet.
 */

export type ActionCentreControlProps = {
  /** The server's unread count, or `null` where the feed has not landed. */
  readonly unseen: number | null
  readonly variant: 'bar' | 'rail'
  readonly open: boolean
  readonly onOpen: (opener: HTMLElement | null) => void
  readonly onClose: () => void
}

export function ActionCentreControl({
  unseen,
  variant,
  open,
  onOpen,
  onClose,
}: ActionCentreControlProps) {
  const ref = useRef<HTMLButtonElement>(null)

  // A COUNT ONLY WHERE THERE IS SOMETHING TO COUNT. Zero and unknown both draw
  // nothing, and they are allowed to look the same here because the control
  // says the same thing in both cases: there is nothing to tell you yet.
  const badge = unseen !== null && unseen > 0 ? unseen : null

  // THE NUMBER IS INSIDE THE ACCESSIBLE NAME rather than beside it. A bare
  // "Updates, button" beside a visible "3" leaves a screen-reader user with the
  // count on screen and not in the name — and "Updates" stays a substring, so
  // the speech-input requirement that the visible label be part of the name
  // still holds.
  const label =
    badge === null ? 'Updates' : `Updates, ${badge} unread`

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.control} ${variant === 'rail' ? styles.rail : styles.bar}`}
      aria-label={label}
      aria-expanded={open}
      aria-haspopup="dialog"
      data-vnext-shell-control="actions"
      onClick={() => (open ? onClose() : onOpen(ref.current))}
    >
      <Inbox size={18} strokeWidth={1.75} aria-hidden="true" />
      {/* THE RAIL HAS ROOM FOR THE WORD AND THE PHONE'S BAR DOES NOT. Both
          carry it in the accessible name above, so the visible difference is
          density and never information. */}
      {variant === 'rail' ? <span className={styles.label}>Updates</span> : null}
      {badge === null ? null : (
        <span className={`${text.numeric} ${styles.badge}`} aria-hidden="true">
          {/* CAPPED SO THE CHROME CANNOT BE STRETCHED BY THE DATA. The exact
              figure is in the accessible name, which has no layout to break. */}
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}
