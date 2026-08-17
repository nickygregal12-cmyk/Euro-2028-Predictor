import { createContext, useContext, useId } from 'react'
import type { ReactNode } from 'react'
import typography from '../foundations/typography.module.css'
import styles from './VNextPageHeader.module.css'

/**
 * The id `VNextShell` has already pointed `<main aria-labelledby>` at.
 *
 * The shell owns the `<main>` landmark and the page owns the words in the
 * heading, so one of them has to hand the other an id. Passing it down through
 * context rather than through a prop means a page cannot forget to thread it,
 * and cannot invent a second one — which is how a shell and a page end up
 * arguing about which element is the page heading.
 *
 * Outside a shell the header falls back to an id of its own, so the component
 * is still usable on its own in a story or a test.
 */
export const VNextPageHeadingContext = createContext<string | null>(null)

export type VNextPageHeaderProps = {
  /** The page's own name. This is the page's ONE `<h1>`. */
  title: ReactNode
  /** Which competition the page is showing, when it is showing one. */
  competition?: ReactNode
  /** Where inside that competition — a matchweek, a round, a stage. */
  context?: ReactNode
  /**
   * A page-supplied status or action, aligned to the end of the header row.
   *
   * A SLOT RATHER THAN PROPS, deliberately. Home puts its rank, movement and
   * points here; a fixtures page might put a competition switch; a detail page
   * might put one control. Those have nothing in common but their position, and
   * a prop matrix wide enough to express all three would be Home's masthead
   * wearing a generic name.
   */
  trailing?: ReactNode
}

/**
 * THE REUSABLE HALF OF HOME'S MASTHEAD.
 *
 * Home's masthead answered two questions in the same place every time: WHICH
 * COMPETITION AND MATCHWEEK AM I IN, and HOW AM I DOING. The first question is
 * the one every vNext page has to answer — Fixtures, Leagues, Match Centre and
 * the Predictor all sit inside a competition and a stage of it — so it is here.
 * The second is Home's, and it arrives through `trailing` as a node Home builds
 * itself.
 *
 * WHAT THIS DOES NOT DO. It does not lay out a points panel, it does not know
 * what a rank is, and it does not decide what a page's status looks like. A
 * shell that knew any of that would be Home with a different file name.
 */
export function VNextPageHeader({
  title,
  competition,
  context,
  trailing,
}: VNextPageHeaderProps) {
  const ownId = useId()
  const headingId = useContext(VNextPageHeadingContext) ?? ownId

  return (
    <div className={styles.header}>
      <div className={styles.identity}>
        {competition ? <p className={typography.label}>{competition}</p> : null}
        <h1 id={headingId} className={`${typography.title} ${styles.title}`}>
          {title}
        </h1>
        {context ? <p className={typography.micro}>{context}</p> : null}
      </div>

      {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
    </div>
  )
}
