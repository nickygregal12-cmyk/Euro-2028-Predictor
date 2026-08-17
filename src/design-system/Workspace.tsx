import type { ReactNode } from 'react'
import styles from './Workspace.module.css'

/**
 * A desktop page composition: a main column and an optional contextual panel
 * beside it.
 *
 * WHAT IT IS FOR. The owner's 10 August 2026 direction requires desktop to make
 * purpose-built composition choices rather than widening the phone page —
 * predictions left with match insights right, standings left with the matchweek
 * beside it, a result with its player and league consequence next to it. This
 * is that layout, once, so each surface chooses what goes in the panel instead
 * of inventing a grid.
 *
 * THE PANEL IS AN ENHANCEMENT, NEVER A REQUIREMENT. Below the wide breakpoint
 * it is not a rail at all: it stacks under the main column in source order, so
 * a phone reads main content first and a tablet is not asked to hold two
 * columns in 900px. Nothing may be reachable ONLY from the panel — the design
 * authority's contextual-rail rule, restated here because this component is
 * where it would be broken.
 *
 * IT DOES NOT DUPLICATE THE MAIN COLUMN. The panel derives from what the page
 * already knows or fetches beside it; repeating the main column's own content
 * at a narrower width is the failure mode this composition invites.
 *
 * SOURCE ORDER IS READING ORDER. The main column is first in the DOM, so
 * keyboard and screen-reader users reach the page's own content before its
 * context, at every width. The visual order is the same; there is no grid
 * reordering to get out of step with it.
 */

export type WorkspaceProps = {
  children: ReactNode
  /** The contextual panel. Omitted entirely where a page has no second column. */
  aside?: ReactNode | undefined
  /**
   * Names the panel for assistive technology. Required whenever `aside` is
   * given — an unnamed complementary region is one more landmark to skip past
   * without knowing what is in it.
   */
  asideLabel?: string | undefined
  /**
   * `reading` caps the main column at a comfortable measure (about 820px) and
   * centres it: for prose, forms and single-list pages, where a full-width line
   * is unreadable. `full` lets it use the width, for tables and comparison
   * grids. Ignored when `aside` is present — the panel already bounds it.
   */
  width?: 'reading' | 'full'
}

export function Workspace({ children, aside, asideLabel, width = 'reading' }: WorkspaceProps) {
  if (!aside) {
    return (
      <div className={`${styles.workspace} ${width === 'reading' ? styles.reading : styles.full}`}>
        {children}
      </div>
    )
  }

  return (
    <div className={`${styles.workspace} ${styles.split}`}>
      <div className={styles.main}>{children}</div>
      {/* At desktop width this landmark becomes its own overflow region. A
          focus target is therefore required so keyboard users can scroll it. */}
      <aside className={styles.aside} aria-label={asideLabel} tabIndex={0}>
        <div className={styles.asideInner}>{aside}</div>
      </aside>
    </div>
  )
}
