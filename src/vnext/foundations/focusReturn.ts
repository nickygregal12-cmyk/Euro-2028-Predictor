import { useCallback, useRef } from 'react'

/**
 * WHERE FOCUS GOES WHEN AN OVERLAY CLOSES, WHEN THE OPENER HAS A TWIN.
 *
 * ================================ THE DEFECT ================================
 *
 * All three concepts render their navigation TWICE — a phone shape and a
 * desktop shape — and let CSS display exactly one. That is the accepted shell's
 * own mechanism and it is right: `display: none` takes the other copy out of
 * the accessibility tree as well as off the page, so no keyboard user reaches a
 * control they cannot see.
 *
 * It stops being right the moment an overlay tries to give focus BACK. A single
 * `useRef` shared by both copies holds whichever mounted last, and a hard-coded
 * reference to "the mobile button" holds a control that is `display: none` at
 * 1120 and above. Closing a sheet then calls `.focus()` on an element with no
 * box, the browser refuses, focus falls to `<body>`, and the keyboard user is
 * returned to the top of the document with no indication that anything moved.
 * It is invisible to jsdom, which evaluates no container query and gives every
 * element a box, so the unit suite cannot see it and never could.
 *
 * ================================ THE RULE ==================================
 *
 * FOCUS RETURNS TO THE ELEMENT THAT WAS ACTUALLY PRESSED — not to a ref, not to
 * a role, and not to whichever duplicate assigned itself last. The opener is
 * captured from the triggering event, which is the only source that is correct
 * by construction: the control the player pressed is, necessarily, the copy
 * that was on screen.
 *
 * A CAPTURED OPENER IS STILL VERIFIED ON THE WAY BACK. Between opening and
 * closing, a concept may re-render the opener out of existence — a switcher
 * that stops being a button, a bar that stops being displayed. So the restore
 * checks that the element is still in the document AND still has a layout box,
 * and declines rather than focusing a hidden copy. `getClientRects()` is the
 * check the browser suite already uses for "is this rendered", and unlike
 * `offsetParent` it is not defeated by `position: fixed`.
 *
 * NO DEPENDENCY, AND NO FOCUS TRAP. This is a return path and nothing more; the
 * dialogs keep their own Escape handling and their own entry focus. A focus
 * library would be a dependency the Stage 7.5 rules forbid, and would answer a
 * larger question than the one that is wrong.
 *
 * ================================ WHY IT IS HERE NOW ========================
 *
 * It was written in Stage 7.5 as `ia/shared/focusReturn.ts`, for a lab. Stage
 * 7.6 gives the ACCEPTED shell two overlays of its own — the competition
 * switcher's sheet and the Jump accelerator — with the same twinned openers and
 * therefore the same defect available to it. Promoting the module is the one
 * thing §16 of that brief sanctions moving "toward an accepted shared
 * foundation ONLY if Stage 7.6 genuinely needs it"; copying it into `app/`
 * instead would leave two implementations of a rule that is hard to get right
 * once. The three lab concepts import it from here and are otherwise untouched.
 */
export type FocusReturn = {
  /**
   * Remember the control that is opening the overlay. Pass the triggering
   * event's `currentTarget`; passing `null` falls back to whatever currently
   * holds focus, which is the same element in every keyboard and pointer path
   * a button has.
   */
  readonly captureOpener: (opener: HTMLElement | null) => void
  /**
   * Give focus back to that control, if it is still there to receive it.
   * Returns whether it did, so a caller that needs a fallback can tell.
   */
  readonly returnFocus: () => boolean
}

/** Still in the document, and still occupying a box — so `display: none` fails. */
function canReceiveFocus(element: HTMLElement | null): element is HTMLElement {
  if (!element || !element.isConnected) return false
  /**
   * THE BOX QUESTION IS ONLY ASKED WHERE THERE IS A LAYOUT TO ANSWER IT.
   *
   * jsdom has no layout engine, so `getClientRects()` is empty for EVERY
   * element — including the one genuinely on screen. Asking it "is this
   * displayed" does not return `false`, it returns nothing at all, and treating
   * that as "hidden" would disable focus return in the entire unit suite while
   * proving nothing. The document element is the probe: in a browser it always
   * has a box, so the check below is the real one; where it has none, there is
   * no layout in this environment and the connected element is the best answer
   * available. The browser suite is the authority for the hidden-copy case and
   * asserts it directly.
   */
  const documentHasLayout =
    element.ownerDocument.documentElement.getClientRects().length > 0
  if (!documentHasLayout) return true
  return element.getClientRects().length > 0
}

export function useFocusReturn(): FocusReturn {
  const openerRef = useRef<HTMLElement | null>(null)

  const captureOpener = useCallback((opener: HTMLElement | null) => {
    if (opener) {
      openerRef.current = opener
      return
    }
    const active = typeof document === 'undefined' ? null : document.activeElement
    openerRef.current = active instanceof HTMLElement ? active : null
  }, [])

  const returnFocus = useCallback(() => {
    const opener = openerRef.current
    openerRef.current = null
    if (!canReceiveFocus(opener)) return false
    opener.focus()
    return true
  }, [])

  return { captureOpener, returnFocus }
}
