import { useEffect, useId, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { motion } from 'framer-motion'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import styles from './ShellOverlay.module.css'

/**
 * THE ONE OVERLAY THE SHELL HAS, USED THREE TIMES.
 *
 * The competition sheet, the attention list and the Jump accelerator are three
 * different jobs with one set of obligations, and the obligations are the half
 * that gets forgotten:
 *
 *   - it is a real `dialog` with a real accessible name;
 *   - focus ENTERS it, so a keyboard user is not left tabbing through the page
 *     behind the thing they just opened;
 *   - Escape closes it;
 *   - closing returns focus to the control that was PRESSED — see
 *     `foundations/focusReturn.ts` for why that is not a ref;
 *   - the scrim dismisses on a press that both began and ended on it, and is
 *     not a control, so it carries no role and no name.
 *
 * Writing that three times is how one of the three ends up without an Escape
 * handler.
 *
 * NO FOCUS TRAP, AND NO `<dialog>` ELEMENT. A trap is a dependency or a hundred
 * lines of edge cases; the shell has neither, and §23 of the brief asks that
 * focus ENTER the overlay and RETURN from it, not that it be imprisoned.
 * `showModal()` would give a trap for free and would also give the browser's
 * own top layer, which escapes the workshop's device frame and paints a phone's
 * sheet across a 1920px monitor — the one thing a container-queried review lane
 * cannot have.
 *
 * A BOTTOM SHEET ON A PHONE AND A CENTRED PANEL ON A DESKTOP, decided in CSS
 * against the shell's container rather than by a prop, because it is the same
 * overlay either way and a caller that had to choose could choose wrong.
 *
 * MOTION IS THE PANEL'S ENTRANCE AND NOTHING ELSE. It is the accepted `riseIn`
 * pair, so reduced motion is a fade with no travel. Opening is not navigation
 * and nothing here defers a state change until an animation ends.
 */
export type ShellOverlayProps = {
  readonly title: string
  /** Where focus should land. Defaults to the panel itself. */
  readonly initialFocusRef?: RefObject<HTMLElement | null>
  readonly onClose: () => void
  readonly children: ReactNode
}

export function ShellOverlay({
  title,
  initialFocusRef,
  onClose,
  children,
}: ShellOverlayProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const rise = useVNextMotion(vnextMotion.riseIn)

  // A ref object's identity is stable for the life of the component that made
  // it, so this runs once on open — which is what it must do. Re-running would
  // take focus back from whatever the player has since tabbed to.
  useEffect(() => {
    const target = initialFocusRef?.current ?? panelRef.current
    target?.focus()
  }, [initialFocusRef])

  return (
    <div
      className={styles.scrim}
      data-vnext-overlay=""
      // `currentTarget` rather than `target`, so a press that began on a row
      // inside the panel and ended on the scrim does not close it out from
      // under the player.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <motion.div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        variants={rise}
        initial="hidden"
        animate="visible"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          }
        }}
      >
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  )
}
