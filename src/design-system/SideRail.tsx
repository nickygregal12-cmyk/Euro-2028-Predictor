import { Link } from 'react-router'
import styles from './SideRail.module.css'
import { ChevronLeftIcon, ChevronRightIcon, type IconProps } from './icons'

/**
 * The persistent desktop navigation rail.
 *
 * WHY IT EXISTS. Until now the signed-in frame was the phone frame at every
 * width: a five-tab bar pinned to the bottom of a 27-inch monitor, with the
 * content in one narrow column above it. The design authority has specified
 * this rail since the modernisation plan was written — 240px expanded, 64px
 * collapsed, the choice persisted — and the owner's 10 August 2026 UI direction
 * makes it the first item of the finalisation programme. Desktop must never be
 * a mobile page stretched into an 800px column.
 *
 * IT IS THE SAME DESTINATIONS, IN A DIFFERENT PRESENTATION. The bar and the
 * rail never both show: below the desktop breakpoint the bottom bar is the
 * navigation, at and above it the rail is. That is not the swap the design
 * authority forbids — that rule is about competition context REPLACING the
 * global destinations at one width, which never happens here. The rail's first
 * group is exactly the bar's five, in the bar's order.
 *
 * WHAT THE EXTRA WIDTH BUYS is the two groups below it, which the owner's
 * direction adds deliberately: desktop "does not need to mirror mobile paths
 * exactly where the extra space enables better navigation". A competition is
 * reachable in one click rather than three, and the competition the player is
 * currently inside expands in place so they can move between its sections and
 * its games without going back up to a hub.
 *
 * IT CLAIMS NO MEMBERSHIP. The competitions listed are the ones the platform
 * runs, not the ones the player has joined — the same list the chooser offers.
 * Each link opens that competition's own surfaces, which read the player's real
 * membership from the server; a rail that inferred "your competitions" from the
 * presentation catalogue would confidently name competitions nobody entered.
 *
 * PRESENTATIONAL. Every destination is supplied by the caller, so the design
 * system holds no route knowledge and no competition catalogue.
 */

export type RailLink = {
  /** Stable within its group. */
  key: string
  label: string
  href: string
  Icon?: (props: IconProps) => React.ReactElement
  /** Rendered indented under its competition — a section or a game. */
  nested?: boolean
}

export type RailGroup = {
  key: string
  /** The heading above the group. Omitted for the first, which needs none. */
  title?: string
  links: readonly RailLink[]
}

export type SideRailProps = {
  groups: readonly RailGroup[]
  /** The current pathname, for `aria-current`. Matched exactly. */
  pathname: string
  collapsed: boolean
  onToggleCollapsed: () => void
}

function isCurrent(pathname: string, href: string): boolean {
  // Exact only. A prefix match would light both "Premier League" and its
  // "Matches" child at once, and the child is the honest answer.
  const [path] = href.split('?')
  return pathname === path
}

export function SideRail({ groups, pathname, collapsed, onToggleCollapsed }: SideRailProps) {
  return (
    <nav
      className={`${styles.rail} ${collapsed ? styles.collapsed : ''}`}
      aria-label="Sections"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div className={styles.scroll}>
        {groups.map((group) => (
          <div className={styles.group} key={group.key}>
            {/* The heading is hidden from sight when collapsed but never from
                assistive technology: the grouping is the same navigation
                either way, and only the room for a word has gone. */}
            {group.title ? (
              <h2 className={collapsed ? styles.srOnly : styles.groupTitle}>{group.title}</h2>
            ) : null}
            <ul className={styles.list}>
              {group.links.map((link) => {
                const current = isCurrent(pathname, link.href)
                const Icon = link.Icon
                return (
                  <li key={link.key}>
                    <Link
                      to={link.href}
                      className={[
                        styles.link,
                        link.nested ? styles.nested : '',
                        current ? styles.current : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-current={current ? 'page' : undefined}
                      // Collapsed, the label is the accessible name and the
                      // native tooltip. An icon-only link with no name is the
                      // commonest way a rail like this fails an audit.
                      title={collapsed ? link.label : undefined}
                      aria-label={collapsed ? link.label : undefined}
                    >
                      <span className={styles.glyph} aria-hidden="true">
                        {Icon ? <Icon size={20} /> : <span className={styles.dot} />}
                      </span>
                      <span className={collapsed ? styles.srOnly : styles.label}>{link.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <button
        type="button"
        className={styles.toggle}
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
      >
        <span className={styles.glyph} aria-hidden="true">
          {collapsed ? <ChevronRightIcon size={18} /> : <ChevronLeftIcon size={18} />}
        </span>
        {/* The word is hidden when collapsed but still the button's accessible
            name — a control whose only label is a chevron says nothing. */}
        <span className={collapsed ? styles.srOnly : styles.label}>
          {collapsed ? 'Expand navigation' : 'Collapse navigation'}
        </span>
      </button>
    </nav>
  )
}
