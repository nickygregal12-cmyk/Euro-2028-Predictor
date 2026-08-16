import type { CSSProperties, ReactNode } from 'react'
import { VNextRoot } from '../foundations/VNextRoot'
import type { VNextMotionSetting } from '../foundations/VNextRoot'
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
  { id: 'laptop-1440', label: 'Laptop 1440', width: 1440, height: 900 },
  { id: 'desktop-1920', label: 'Desktop 1920', width: 1920, height: 1080 },
]

export type WorkshopCanvasProps = {
  /** Viewport ids from `workshopViewports`. Unknown ids are ignored. */
  viewports?: readonly string[]
  motion?: VNextMotionSetting
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
              <VNextRoot motion={motion} fill>
                <div className={styles.scroller}>{children}</div>
              </VNextRoot>
            </div>
          </div>
        </figure>
      ))}
    </div>
  )
}
