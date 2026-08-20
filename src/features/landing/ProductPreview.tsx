import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { VNextRoot } from '../../vnext/foundations/VNextRoot'
import { VNextShellProvider } from '../../vnext/app/VNextShellProvider'
import { VNextHome } from '../../vnext/home/VNextHome'
import { VNextMatches } from '../../vnext/matches/VNextMatches'
import { VNextLeagues } from '../../vnext/leagues/VNextLeagues'
import { VNextGames } from '../../vnext/games/VNextGames'
import { marketingPhaseAt } from '../../vnext/fixtures/marketing/story'
import type { MarketingSurface } from '../../vnext/fixtures/marketing/story'
import { PREVIEW_DEVICE, previewBoxStyle } from './previewDevice'
import type { ProductPreviewVariant } from './previewDevice'
import s from './ProductPreview.module.css'

/**
 * THE PRODUCT, INSIDE A DEVICE, ON A PUBLIC PAGE.
 *
 * ============================ IT MOUNTS THE PRODUCT, IT DOES NOT DRAW IT ==
 *
 * Everything inside the frame is a real vNext surface rendered from a real
 * model: the Competition Deck's shell, its four destinations, its typography,
 * its team-colour language and its motion. Nothing here reimplements any of
 * them. That is the property the old preview lacked and the reason it advertised
 * an information architecture the product had stopped having — a hand-drawn
 * picture has to be maintained, and a marketing page is the last place anybody
 * remembers to look.
 *
 * ============================ IT IS A PICTURE, AND IT IS INERT ============
 *
 * `role="img"` with a written description is the accessibility contract: the
 * invented competition, table and points inside are announced once, honestly,
 * as a picture of the product rather than as the reader's own standings.
 *
 * `inert` is the other half and it is the stronger one. The old preview used
 * `<span>`s shaped like buttons so a visitor could not press "Continue" and be
 * lied to by the page selling them the product; here the controls are the
 * PRODUCT's real controls, so they are made genuinely unpressable instead of
 * imitated. `inert` removes the whole subtree from hit-testing, from the tab
 * order and from the accessibility tree, which is exactly the set of promises a
 * picture makes. Nothing inside can be focused, pressed or read as a control,
 * and no `onIntent` is passed — so even a browser without `inert` has nothing
 * to route a press to.
 *
 * ============================ IT NEEDS NOTHING TO RENDER ==================
 *
 * No account, no Supabase, no football provider, no clock and no write. The
 * models are literals from `fixtures/marketing/story.ts`; see that file for why.
 *
 * ============================ THE TWO COMPOSITIONS ARE THE PRODUCT'S ======
 *
 * `desktop` and `phone` differ only in the width of the frame, and the product
 * does the rest. `VNextShell.module.css` is written against `@container
 * vnext-shell` rather than the viewport, so a 1280px frame gets the real rail
 * and a 390px frame gets the real bottom bar — on the same page, at the same
 * viewport, at the same time. The section beside the phone is making a point
 * about how the product adapts, and this is that point demonstrated rather than
 * illustrated.
 */

export type ProductPreviewProps = {
  /**
   * WHICH PHASE, AS AN INDEX RATHER THAN AS THE PHASE ITSELF.
   *
   * A `MarketingPhase` prop would look tidier and would cost the page most of
   * what this arrangement saves: the caller would have to import
   * `MARKETING_PHASES` to produce one, which drags the whole marketing world —
   * every fixture family, every club, every table — into the EAGER landing
   * chunk, on the critical path, for a device that has not loaded yet. Measured
   * at roughly nine kilobytes compressed.
   *
   * An index carries the same information and imports nothing. It is total by
   * construction on the other side, so no value of it can render an empty
   * device.
   */
  readonly phaseIndex: number
  readonly variant: ProductPreviewVariant
  /** Follows the page's own theme control, so the device is never the odd one out. */
  readonly theme: 'dark' | 'light'
  /** What assistive technology is told this frame shows. Changes with the phase. */
  readonly description: string
  /**
   * Whether this device is part of the scripted story or a single held frame.
   *
   * IT IS DECLARED RATHER THAN INFERRED. The page carries both — two devices
   * running the five phases and one showing the league table and nothing else —
   * and from the outside they are the same element with the same role. Saying
   * which is which puts the answer in the DOM, where a test asking "did the
   * sequence advance?" can address the devices that were supposed to.
   */
  readonly motion?: 'scripted' | 'still'
}

export function ProductPreview({
  phaseIndex,
  variant,
  theme,
  description,
  motion = 'scripted',
}: ProductPreviewProps): ReactElement {
  const phase = marketingPhaseAt(phaseIndex)
  const device = PREVIEW_DEVICE[variant]
  const { stageRef, scale } = useDeviceScale(device.width)

  return (
    <div
      ref={stageRef}
      className={variant === 'phone' ? `${s.stage} ${s.stagePhone}` : s.stage}
      style={{
        // The stage's HEIGHT comes from its own width and the device's aspect
        // ratio, never from the scale — so the box is the right size before any
        // measurement has happened and the scale can never move the page. It is
        // also the same box the placeholder reserved while this chunk was still
        // being fetched, which is why both take it from `previewBoxStyle`.
        ...previewBoxStyle(variant),
        ['--preview-scale' as string]: `${scale}`,
      }}
      role="img"
      aria-label={description}
      data-preview-variant={variant}
      data-preview-phase={phase.id}
      data-preview-motion={motion}
    >
      <div
        // KEYED ON THE PHASE, so a changed phase is a new subtree. Two things
        // depend on it. The cross-fade below is a CSS entry animation and has
        // nothing to animate without a remount; and the product's own entrance
        // motion — `riseIn`, `stagger`, and every other preset `VNextRoot`
        // governs — replays, which is what makes the change read as the product
        // moving rather than as a slideshow of screenshots. Both respect
        // `prefers-reduced-motion`: this one in the stylesheet beside it, the
        // product's through `VNextRoot`.
        key={phase.id}
        className={s.viewport}
        style={{ width: `${device.width}px`, height: `${device.height}px` }}
        // See the header. Not decoration: it is what makes the product's own
        // controls unpressable without replacing them with imitations.
        inert
      >
        <VNextRoot fill theme={theme}>
          <VNextShellProvider model={phase.shell}>
            <Surface surface={phase.surface} />
          </VNextShellProvider>
        </VNextRoot>
      </div>
    </div>
  )
}

/**
 * The destination this phase is at.
 *
 * EXHAUSTIVE BY TYPE. A fifth destination added to the product fails to compile
 * here rather than quietly rendering nothing on the public page.
 */
function Surface({ surface }: { surface: MarketingSurface }): ReactElement {
  switch (surface.kind) {
    case 'home':
      return <VNextHome model={surface.model} />
    case 'matches':
      return <VNextMatches model={surface.model} />
    case 'leagues':
      return <VNextLeagues model={surface.model} />
    case 'games':
      return <VNextGames model={surface.model} />
  }
}

/**
 * How much the device has to shrink to fit the column it is in.
 *
 * WHY IT IS MEASURED RATHER THAN DECLARED. The frame renders at the product's
 * real viewport width so the product's own container queries resolve to the
 * real composition; the page then scales the result down to whatever room the
 * layout has. CSS can express one of those two and not both — a container query
 * cannot produce a unitless scale factor — so the ratio is measured.
 *
 * IT NEVER SCALES UP. A device rendered larger than its own viewport is a
 * product at the wrong type size pretending to be a screenshot.
 *
 * IT RUNS BEFORE PAINT. `useLayoutEffect` rather than `useEffect`, so the first
 * frame a visitor sees is already at the right scale — and because the stage's
 * height comes from its aspect ratio rather than from its contents, nothing
 * moves either way.
 */
function useDeviceScale(width: number) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const node = stageRef.current
    if (node === null) return

    const measure = () => {
      const available = node.clientWidth
      // A zero width is a node that is not laid out yet — in jsdom it always
      // is. Holding the previous scale is better than dividing by nothing.
      if (available <= 0) return
      setScale(Math.min(1, available / width))
    }

    measure()
    // A landing page changes width on rotation, on a window drag and when a
    // section above it reflows. Absent in jsdom, where the single measurement
    // above is the whole story.
    if (typeof ResizeObserver !== 'function') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [width])

  return { stageRef, scale }
}
