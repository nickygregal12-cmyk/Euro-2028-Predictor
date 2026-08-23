import { useEffect, type RefObject } from 'react'

/**
 * KEEP THE STICKY CHROME OFF THE THING THAT JUST TOOK FOCUS — `UX-007`.
 *
 * ============================ THE CRITERION AND THE DEFECT ==============
 *
 * WCAG 2.2 AA 2.4.11, Focus Not Obscured (Minimum): when a component receives
 * keyboard focus, no part of it is entirely hidden by author-created content.
 * The vNext shell has a `position: sticky; top: 0` masthead and, below 1120, a
 * bottom navigation bar in the same position at the other end. The scroller is
 * the DOCUMENT — `VNextRoot` uses `overflow-x: clip` rather than `hidden`
 * precisely so that sticky binds to the page — so when the browser scrolls a
 * focused control into view it aligns it to the viewport edge, which is exactly
 * where both bars are.
 *
 * The risk register recorded this as *"suspected from the CSS … and
 * deliberately NOT asserted"*, because vNext had no application route to
 * exercise it on. It has ten now.
 *
 * ============================ WHY IT IS MEASURED AND NOT A CONSTANT =====
 *
 * `scroll-padding-block-start` is the right property and the only question is
 * what to set it to. A constant would be wrong on most screens: the masthead
 * carries a context bar that is hidden at 1120 and above, an attention band
 * that appears only when another competition wants something, and a page header
 * whose title wraps on a long club name. All three change its height, none of
 * them is knowable in CSS, and a value that is too small fails the criterion
 * silently while a value that is too large scrolls every focus jump into the
 * middle of the page.
 *
 * So it is observed. `ResizeObserver` is cheap here — two elements, and only
 * while a vNext surface is mounted.
 *
 * ============================ IT WRITES ON THE SCROLLER, WHICH IS THE PAGE
 *
 * `scroll-padding` applies to the SCROLL CONTAINER, so it has to go on the
 * document element rather than on anything this component renders. That is a
 * side effect on a global, which is why it is here in one place, guarded, and
 * cleaned up on unmount — a legacy route that follows a vNext one must not
 * inherit padding for chrome that is no longer on the screen.
 *
 * ============================ AND IT DEGRADES ===========================
 *
 * No `ResizeObserver`, no `document`, or no elements yet: the hook does nothing
 * and the page is exactly as it was. This is a correction to how far the
 * browser scrolls, never a thing a page depends on to render.
 */
export function useStickyScrollPadding(
  head: RefObject<HTMLElement | null>,
  foot: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement

    const apply = () => {
      const start = measure(head.current)
      const end = measure(foot.current)
      // A SMALL MARGIN BEYOND THE BAR. The criterion asks that no part of the
      // focused control be hidden; landing it flush against the underside of
      // the masthead satisfies the letter and looks like a mistake.
      set(root, 'scroll-padding-block-start', start === 0 ? 0 : start + 8)
      set(root, 'scroll-padding-block-end', end === 0 ? 0 : end + 8)
    }

    apply()

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        clear(root)
      }
    }

    const observer = new ResizeObserver(apply)
    if (head.current) observer.observe(head.current)
    if (foot.current) observer.observe(foot.current)

    return () => {
      observer.disconnect()
      clear(root)
    }
  }, [head, foot])
}

/**
 * The height a sticky bar actually occupies, or zero.
 *
 * A bar hidden by a media query still exists in the tree — the bottom bar is
 * `display: none` above 1120 — and reports a zero box, which is the honest
 * answer: it obscures nothing there.
 */
function measure(element: HTMLElement | null): number {
  if (!element) return 0
  const box = element.getBoundingClientRect()
  return Math.ceil(box.height)
}

function set(root: HTMLElement, property: string, value: number): void {
  if (value <= 0) {
    root.style.removeProperty(property)
    return
  }
  root.style.setProperty(property, `${value}px`)
}

function clear(root: HTMLElement): void {
  root.style.removeProperty('scroll-padding-block-start')
  root.style.removeProperty('scroll-padding-block-end')
}
