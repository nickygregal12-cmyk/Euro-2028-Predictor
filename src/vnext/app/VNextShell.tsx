import { useId } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { VNextNav, defaultNavItems } from '../components/navigation/VNextNav'
import type { VNextNavItem } from '../components/navigation/VNextNav'
import { competitionColourStyle } from '../foundations/teamColour'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { VNextPageHeadingContext } from './VNextPageHeader'
import styles from './VNextShell.module.css'

export type VNextShellProps = {
  /** The page. The shell has no opinion about what is in here. */
  children: ReactNode
  /** Which global destination this page is, for the navigation's current item. */
  destination: string
  /** Use `VNextPageHeader`. See the heading contract below. */
  header?: ReactNode
  /** Overrides the four destinations — badges, or a localised label set. */
  navItems?: readonly VNextNavItem[]
  onNavigate?: (id: string) => void
  /**
   * The competition palette behind the page, when the page is inside one.
   *
   * Omitted, the canvas is plain: the wash is written against custom properties
   * that fall back to `transparent`, so a page with no competition context does
   * not get a grey smear where a colour should have been.
   */
  competitionColours?: { readonly primary: string; readonly accent: string } | null
}

/**
 * THE vNext APPLICATION SHELL.
 *
 * Stage 4 proved the visual language on one page. This is the part of it that
 * belongs to the APP rather than to Home: the canvas and its competition
 * atmosphere, the page bounds, the sticky masthead band, the two navigations
 * and the width at which they swap, the `<main>` landmark, and the bottom
 * spacing a mobile page needs so its content clears the bar.
 *
 * WHAT IT DELIBERATELY DOES NOT OWN. There is no hero slot, no ticker slot, no
 * social rail and no grid. Home's composition — the emphasis system, the stage,
 * Around the Grounds, the competitive module and the order they come in — is
 * Home's, and a shell with a `featuredMatch` prop would be Home pretending to
 * be infrastructure. A page gets a canvas, bounds, navigation and a heading
 * contract; everything between is the page's own.
 *
 * THE CONTENT REGION IS THE CONTAINER. `<main>` declares `vnext-page`, and every
 * vNext page makes its layout decisions against that rather than against the
 * viewport. It carries no inline padding of its own — the inset arrives as
 * `--vnext-page-inset` for the page to apply where it wants it — so a standings
 * table can bleed to the page bounds while an editorial column stays inset, and
 * both measure the same number.
 *
 * NO MAXIMUM WIDTH. A reading column would be right for Home and wrong for the
 * data-dense pages this shell exists to host, so the page decides. At 1920 a
 * fixtures grid can use the whole workspace; the shell will not take it back.
 *
 * THE HEADING CONTRACT, which is the one thing a page can get wrong:
 *
 *   - the SHELL renders the single `<main>`, and nothing else may;
 *   - the PAGE renders the single `<h1>`, through `VNextPageHeader` in `header`;
 *   - the shell points `<main aria-labelledby>` at the id it handed the header
 *     down through context, so neither side invents one.
 *
 * `tests/vnext/shell.test.tsx` holds all three, across Home and the neutral
 * demonstrations, because a landmark contract stated only in a comment is a
 * landmark contract that lasts until the next page.
 *
 * MOTION IS THE MASTHEAD AND THE NAVIGATION INDICATOR, and nothing else. A
 * shell-level content entrance would run on top of whatever entrance the page
 * already has — Home staggers its own zones — and two entrances competing is
 * how a page arrives twice. Route transitions are not this stage's business.
 */
export function VNextShell({
  children,
  destination,
  header,
  navItems = defaultNavItems,
  onNavigate,
  competitionColours,
}: VNextShellProps) {
  const headingId = useId()
  const contentId = useId()
  const rise = useVNextMotion(vnextMotion.riseIn)

  return (
    <div
      className={styles.shell}
      data-vnext-shell=""
      style={competitionColours ? competitionColourStyle(competitionColours) : undefined}
    >
      <motion.header
        className={styles.masthead}
        data-vnext-zone="masthead"
        variants={rise}
        initial="hidden"
        animate="visible"
      >
        {/* First in the DOM, so it is the first stop for a keyboard user rather
            than something they reach after four destinations. */}
        <a className={styles.skipLink} href={`#${contentId}`}>
          Skip to content
        </a>

        <VNextPageHeadingContext.Provider value={headingId}>
          {header}
        </VNextPageHeadingContext.Provider>

        {/* Both navigations are always rendered and CSS shows exactly one.
            `display: none` takes the other out of the accessibility tree as
            well as off the page, so there is never a duplicate landmark or a
            focus stop nobody can see. */}
        <div className={styles.navBand}>
          <VNextNav
            variant="band"
            activeId={destination}
            items={navItems}
            onSelect={onNavigate}
          />
        </div>
      </motion.header>

      <main
        id={contentId}
        className={styles.main}
        aria-labelledby={header ? headingId : undefined}
        tabIndex={-1}
      >
        {children}
      </main>

      <div className={styles.navBar}>
        <VNextNav
          variant="bar"
          activeId={destination}
          items={navItems}
          onSelect={onNavigate}
        />
      </div>
    </div>
  )
}
