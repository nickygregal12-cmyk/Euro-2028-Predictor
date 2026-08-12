/**
 * `INNOV-024` — native view transitions, used selectively.
 *
 * WHAT IT IS FOR. A fixture card opening into its Match Centre, a league row
 * opening into that league: transitions that PRESERVE CONTEXT by showing the
 * thing the player tapped becoming the page they land on. It is not a page
 * transition system and must not become one — animating every navigation is the
 * gimmick the design authority rules out, and it costs the most on the phones
 * that can afford it least.
 *
 * IT IS PROGRESSIVE ENHANCEMENT AND NOTHING DEPENDS ON IT. Where
 * `document.startViewTransition` is absent — Firefox, older Safari, any engine
 * that has not shipped it — the callback runs immediately and the navigation
 * happens exactly as it does today. There is no fallback animation, because the
 * fallback IS the product.
 *
 * REDUCED MOTION IS HONOURED IN CODE, NOT ONLY IN CSS. A view transition is a
 * document-level animation the browser drives, so a `prefers-reduced-motion`
 * media query in a stylesheet cannot suppress it. This checks the preference
 * itself and skips the transition entirely, which is the only way to actually
 * respect it.
 *
 * IT NEVER SWALLOWS THE NAVIGATION. If the browser throws for any reason the
 * callback has already been invoked or is invoked directly, so a failed
 * transition can never leave the player on the page they tried to leave.
 */

type TransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => { finished?: Promise<void> }
}

export function prefersReducedMotion(view: Window | undefined = globalThis.window): boolean {
  return view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export function viewTransitionsSupported(
  target: Document | undefined = globalThis.document,
): boolean {
  return typeof (target as TransitionDocument | undefined)?.startViewTransition === 'function'
}

/**
 * Run `update` inside a view transition where the platform and the player's
 * motion preference both allow one; otherwise run it directly.
 */
export function withViewTransition(
  update: () => void,
  options: { document?: Document; window?: Window } = {},
): void {
  const target = (options.document ?? globalThis.document) as TransitionDocument | undefined
  if (!viewTransitionsSupported(target) || prefersReducedMotion(options.window)) {
    update()
    return
  }
  try {
    const transition = target?.startViewTransition?.(update)
    // A rejected transition is not an error the player can act on, and the
    // update it wraps has already run.
    void transition?.finished?.catch(() => {})
  } catch {
    update()
  }
}
