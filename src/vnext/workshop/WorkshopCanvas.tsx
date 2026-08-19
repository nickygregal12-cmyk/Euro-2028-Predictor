import type { CSSProperties, ReactNode } from 'react'
import { VNextRoot } from '../foundations/VNextRoot'
import type { VNextMotionSetting, VNextThemeSetting } from '../foundations/VNextRoot'
// The workshop board is painted before any VNextRoot mounts, so it needs the
// token sheet in its own right rather than by way of a child.
import '../foundations/tokens.css'
import styles from './WorkshopCanvas.module.css'

export type WorkshopViewport = {
  id: string
  label: string
  width: number
  height: number
}

/**
 * The widths vNext is judged at. Two phones (the small one that everything has
 * to survive and the large one most people actually hold), a tablet, a laptop
 * and a large desktop.
 */
export const workshopViewports: readonly WorkshopViewport[] = [
  { id: 'phone-375', label: 'Phone 375', width: 375, height: 812 },
  { id: 'phone-430', label: 'Phone 430', width: 430, height: 900 },
  { id: 'tablet-768', label: 'Tablet 768', width: 768, height: 1024 },
  /**
   * Added in Stage 7, because the Match Predictor's page-level composition
   * changes between 768 and 1440 — the brief stops being a band above the list and
   * becomes a rail beside it — and there was no frame at the width where that
   * happens. It is ADDITIVE: every existing story names the frames it wants, so
   * none of them gained one, and the default pair is unchanged.
   */
  { id: 'laptop-1024', label: 'Laptop 1024', width: 1024, height: 768 },
  { id: 'laptop-1440', label: 'Laptop 1440', width: 1440, height: 900 },
  { id: 'desktop-1920', label: 'Desktop 1920', width: 1920, height: 1080 },
]

export type WorkshopCanvasProps = {
  /** Viewport ids from `workshopViewports`. Unknown ids are ignored. */
  viewports?: readonly string[]
  motion?: VNextMotionSetting
  /**
   * WHICH THEME THE BOARD RENDERS IN, PINNED TO DARK BY DEFAULT.
   *
   * Not `system`, and the difference is not cosmetic. `VNextRoot`'s default
   * follows `prefers-color-scheme`, which is right for a player and wrong for a
   * review surface: a Storybook frame that follows the machine renders dark on
   * one reviewer's laptop and light on another's, and every visual-regression
   * screenshot then depends on the CI runner's OS preference rather than on the
   * change under review. This was observed, not predicted — the first browser
   * probe after the light theme landed came back with the LIGHT accent because
   * this container prefers light.
   *
   * So the board states its theme. Passing `light` is how a reviewer sees the
   * other one deliberately.
   */
  theme?: VNextThemeSetting
  /**
   * Shrinks the frames so several fit on one screen. Layout is unaffected: a
   * CSS transform does not change layout width, so a 1920 frame at 0.4 still
   * answers container queries as 1920 — which is the only reason side-by-side
   * comparison is trustworthy.
   */
  scale?: number
  children: ReactNode
}

/**
 * The responsive workshop.
 *
 * Every frame renders the SAME children inside its own `VNextRoot` at a fixed
 * width, so mobile and desktop can be judged against each other rather than one
 * after the other. Because the vNext layout primitives use container queries,
 * each frame gets the composition its own width deserves regardless of how
 * large the browser showing the workshop happens to be.
 *
 * The frames scroll their own content. A composition that only works because
 * the page is tall is a composition that has not been reviewed.
 */
export function WorkshopCanvas({
  viewports = ['phone-375', 'laptop-1440'],
  motion = 'system',
  theme = 'dark',
  scale = 1,
  children,
}: WorkshopCanvasProps) {
  const frames = workshopViewports.filter((viewport) =>
    viewports.includes(viewport.id),
  )

  return (
    <div className={styles.canvas} data-vnext-workshop="">
      {frames.map((viewport) => (
        <figure key={viewport.id} className={styles.figure}>
          <figcaption className={styles.caption}>
            {viewport.label}
            {scale === 1 ? null : ` · shown at ${Math.round(scale * 100)}%`}
          </figcaption>
          <div
            className={styles.outer}
            style={
              {
                '--frame-width': `${viewport.width}px`,
                '--frame-height': `${viewport.height}px`,
                '--frame-scale': scale,
              } as CSSProperties
            }
          >
            <div className={styles.inner}>
              <VNextRoot motion={motion} theme={theme} fill>
                {/* The scroller IS the frame's scrollport, so it is the thing
                    that knows how tall the frame is. Declaring
                    `--vnext-frame-block` here — inside `[data-vnext]`, which
                    defaults it to `none` — is how a sticky rail bounds itself
                    to the device shell instead of to the browser window
                    showing the workshop. */}
                <div
                  className={styles.scroller}
                  style={
                    {
                      '--vnext-frame-block': `${viewport.height}px`,
                    } as CSSProperties
                  }
                >
                  {children}
                </div>
              </VNextRoot>
            </div>
          </div>
        </figure>
      ))}
    </div>
  )
}
