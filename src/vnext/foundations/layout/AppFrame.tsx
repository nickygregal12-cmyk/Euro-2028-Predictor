import type { ReactNode } from 'react'
import styles from './AppFrame.module.css'

export type AppFrameProps = {
  /** Mobile navigation. Shown only in the compact composition. */
  navBar?: ReactNode
  /** Desktop navigation. Shown only once there is room for a rail. */
  navRail?: ReactNode
  /** Competition/matchweek context. Inline on mobile, its own column when wide. */
  context?: ReactNode
  /** The football workspace. */
  children: ReactNode
  /** Personal and rival state. Below the main column until there is room beside it. */
  personal?: ReactNode
}

/**
 * The vNext page frame.
 *
 * TWO THINGS MAKE THIS DIFFERENT FROM STRETCHING A PHONE LAYOUT.
 *
 * First, it responds to its CONTAINER, not the viewport. A 375px frame sitting
 * on a 1440px monitor in the workshop would otherwise get the desktop
 * composition and every mobile review would be a lie. `container-type:
 * inline-size` plus `@container` queries make the frame honest at any width,
 * which is the whole reason the workshop can show five widths at once.
 *
 * Second, the compositions are structurally different rather than differently
 * sized. Compact is one column with navigation at the bottom. Regular puts
 * personal state beside the football. Expanded adds a navigation rail, and wide
 * gives competition context a column of its own — the left nav / main workspace
 * / personal rail shape the concept PRs need to be able to explore.
 *
 * The two navigation slots are both rendered and one is hidden with
 * `display: none`, which removes it from the accessibility tree as well as from
 * the page, so there is never a duplicate landmark or a focus stop on a
 * navigation nobody can see.
 */
export function AppFrame({
  navBar,
  navRail,
  context,
  children,
  personal,
}: AppFrameProps) {
  return (
    // Two elements, not one. `container-type` applies to the element's
    // DESCENDANTS: a grid that declares itself a container cannot then respond
    // to its own width, and every composition below `compact` would silently
    // never fire. The outer div is the container; the inner grid answers it.
    <div className={styles.container}>
      <div className={styles.frame}>
        {navRail ? (
          <div className={styles.navRail} data-vnext-region="nav-rail">
            {navRail}
          </div>
        ) : null}

        {context ? (
          <div className={styles.context} data-vnext-region="context">
            {context}
          </div>
        ) : null}

        <main className={styles.main} data-vnext-region="main">
          {children}
        </main>

        {personal ? (
          <div className={styles.personal} data-vnext-region="personal">
            {personal}
          </div>
        ) : null}

        {navBar ? (
          <div className={styles.navBar} data-vnext-region="nav-bar">
            {navBar}
          </div>
        ) : null}
      </div>
    </div>
  )
}
