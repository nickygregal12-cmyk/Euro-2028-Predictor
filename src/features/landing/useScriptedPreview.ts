import { useCallback, useEffect, useRef, useState } from 'react'
import { PREVIEW_FRAME_MS, PREVIEW_STEPS } from './landingPreviewScript'

/**
 * Drives the landing page's scripted product preview.
 *
 * THE STATIC STATE IS THE REAL ONE, AND THE MOTION IS ADDED TO IT. The first
 * phase renders on the first paint with no effect having run, so a print
 * stylesheet, a screenshot with animations frozen and a visitor who never
 * scrolls all get a complete, truthful picture of the product rather than an
 * empty device waiting for a timer. Everything this hook does is an enhancement
 * of that.
 *
 * THE CLAIM THIS COMMENT USED TO MAKE ABOUT NO-JAVASCRIPT WAS NOT TRUE, and
 * saying so is cheaper than leaving it to be discovered. The application is a
 * client-rendered single-page app with no prerender step, so a visitor with
 * JavaScript disabled gets an empty document — not a still preview. The
 * property that IS real is the one above: no effect has to run before the
 * device is complete.
 *
 * IT STOPS WHEN NOBODY IS LOOKING. An interval that keeps firing while the
 * preview is three screens up is a timer burning a phone battery to animate
 * something nobody can see. `IntersectionObserver` decides, because it answers
 * the actual question — is this element in the viewport — rather than the
 * proxy questions scroll handlers answer badly. It also stops when the
 * DOCUMENT is hidden: a backgrounded tab is a viewport nothing is looking at,
 * and `IntersectionObserver` alone does not notice.
 *
 * REDUCED MOTION IS A FULL STOP, NOT A SLOWER LOOP. `prefers-reduced-motion`
 * is a request not to animate, and a five-second cross-fade is animation
 * whatever its duration. The sequence then holds on whichever frame the
 * visitor chose, and the step controls remain — which is the point: the
 * content is still all reachable, by hand rather than on a timer. The query is
 * watched rather than read once, so a visitor who turns the preference on
 * mid-visit is obeyed without a reload.
 *
 * A MANUAL STEP ENDS THE AUTOMATIC ONE, FOR GOOD. Somebody who has taken hold
 * of the sequence is reading at their own pace, and resuming the timer under
 * them would move the page while they read it. There is no resume control
 * because there is nothing to resume TO — every frame is reachable by the
 * controls that stopped it.
 *
 * NO CLOCK, NO RANDOMNESS. The frames are literals and the order is the array
 * order, so two visitors, two renders and a screenshot runner all see the same
 * sequence in the same order.
 */

export type ScriptedPreview = {
  /** The frame index to render. Always valid. */
  index: number
  /** Attach to the element whose visibility gates the sequence. */
  containerRef: (node: HTMLElement | null) => void
  /** Step to a specific frame. Ends automatic advance permanently. */
  goTo: (index: number) => void
  /** Whether the sequence is currently advancing on its own. */
  playing: boolean
}

function prefersReducedMotion(): boolean {
  // Guarded rather than assumed: jsdom has `matchMedia` only when a test
  // installs it, and a preview that throws on a missing API would take the
  // whole landing page down over an animation.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useScriptedPreview(): ScriptedPreview {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [manual, setManual] = useState(false)
  const [reduced, setReduced] = useState(prefersReducedMotion)
  const nodeRef = useRef<HTMLElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // The preference, watched rather than sampled. Somebody who turns reduced
  // motion on while the page is open has asked for the motion to stop now.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(query.matches)
    setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const containerRef = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    nodeRef.current = node
    if (!node) return

    // No observer is not a reason to animate for ever. Where the API is
    // absent the sequence simply never starts, which is the safe half of the
    // trade: a still preview is complete, a hidden one that keeps ticking is
    // a cost with no benefit.
    if (typeof IntersectionObserver !== 'function') return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        setVisible(entry?.isIntersecting === true)
      },
      // A quarter of the device on screen is enough to be worth animating, and
      // is high enough that a preview clipped to a sliver at the edge of the
      // viewport does not count as being looked at.
      { threshold: 0.25 },
    )
    observer.observe(node)
    observerRef.current = observer
  }, [])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  const playing = visible && !manual && !reduced

  useEffect(() => {
    if (!playing) return
    // Also stops for a backgrounded tab. `IntersectionObserver` reports an
    // element in a hidden document as still intersecting, so without this the
    // sequence runs on in a tab nobody has open.
    const documentHidden = () =>
      typeof document !== 'undefined' && document.visibilityState === 'hidden'

    const timer = window.setInterval(() => {
      if (documentHidden()) return
      setIndex((current) => (current + 1) % PREVIEW_STEPS.length)
    }, PREVIEW_FRAME_MS)
    return () => window.clearInterval(timer)
  }, [playing])

  const goTo = useCallback((next: number) => {
    setManual(true)
    setIndex(((next % PREVIEW_STEPS.length) + PREVIEW_STEPS.length) % PREVIEW_STEPS.length)
  }, [])

  return { index, containerRef, goTo, playing }
}
