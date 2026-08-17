import { useId } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, Home, Trophy, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  useReducedMotionPreference,
  useVNextMotion,
  useVNextTransition,
  vnextMotion,
  vnextTransition,
} from '../../foundations/motion'
import styles from './VNextNav.module.css'

export type VNextNavItem = {
  id: string
  label: string
  icon: LucideIcon
  /** A small count — open predictions, unread invites. Zero renders nothing. */
  badge?: number
}

export type VNextNavProps = {
  items?: readonly VNextNavItem[]
  activeId: string
  onSelect?: ((id: string) => void) | undefined
  /** `bar` is the mobile bottom bar; `band` is the desktop masthead row. */
  variant?: 'bar' | 'band'
}

/**
 * THE vNext DESTINATIONS, AND THE TERMINOLOGY DECISION BEHIND THEM.
 *
 * Stage 4 had to settle whether this surface is the product HOME or a
 * competition MATCHDAY tab, because Stage 3's Matchday Arena shipped both — a
 * "Live" destination and a "Matchday" destination, with Matchday current — and
 * a user cannot tell from that whether they are on the front door or inside one
 * competition.
 *
 * IT IS HOME. Live football is CONTENT on Home, not a place you go: the
 * emphasis system already makes the page rearrange itself around whatever is
 * happening, so a separate "Live" tab would navigate to the state Home is
 * already in. And the competition the user is looking at is context, which the
 * masthead states in words ("Premiership · Matchweek 4") rather than spending a
 * navigation slot on.
 *
 * That leaves four global destinations, and four is deliberate: it is the most
 * that clears a 44px target across a 375px bar without the labels shrinking to
 * a memory test.
 */
export const defaultNavItems: readonly VNextNavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'fixtures', label: 'Fixtures', icon: CalendarDays },
  { id: 'leagues', label: 'Leagues', icon: Users },
  { id: 'season', label: 'Season', icon: Trophy },
]

/**
 * Navigation, in the two shapes vNext needs.
 *
 * WHY ONE COMPONENT. A bottom bar and a masthead band are the same list of
 * destinations with the same state; splitting them into two components would
 * mean two places to keep the active item, the badge and the label in step.
 * Only the CSS differs.
 *
 * WHY A BAND AND NOT A RAIL. A vertical rail takes a column off the football
 * for the entire life of the page; a band in the masthead costs 48px once. On a
 * surface whose whole argument is that football gets the horizontal space, the
 * band wins, and the rail variant was removed rather than left as a shape
 * nothing chooses.
 *
 * THE INDICATOR. The active marker uses a shared `layoutId`, so it travels
 * between items instead of blinking — the piece of motion that makes the two
 * navigations feel like one surface. Under reduced motion the shared layout is
 * dropped entirely and the marker simply appears where it belongs, which is why
 * the id is conditional rather than the animation being tuned down.
 *
 * Both halves of that come from `foundations/motion` already resolved: the fade
 * from `vnextMotion.navIndicator` and the travel from
 * `vnextTransition.navIndicator`. This component never picks a full-motion
 * value itself — that is the point of the foundation being a pair.
 *
 * SEMANTICS. A real `<nav>` with a list of buttons, `aria-current="page"` on the
 * active one, and a visible label under every icon — an icon-only bar is a
 * memory test. Every target clears 44px.
 */
export function VNextNav({
  items = defaultNavItems,
  activeId,
  onSelect,
  variant = 'bar',
}: VNextNavProps) {
  const instanceId = useId()
  const reduced = useReducedMotionPreference()
  const indicator = useVNextMotion(vnextMotion.navIndicator)
  const indicatorTravel = useVNextTransition(vnextTransition.navIndicator)

  return (
    <nav
      className={`${styles.nav} ${styles[variant]}`}
      aria-label="vNext primary"
    >
      <ul className={styles.list}>
        {items.map((item) => {
          const isActive = item.id === activeId
          const Icon = item.icon
          return (
            <li key={item.id} className={styles.item}>
              <button
                type="button"
                className={`${styles.link} ${isActive ? styles.active : ''}`}
                aria-current={isActive ? 'page' : undefined}
                // The badge count belongs in the name, not in a hidden span
                // beside it: name computation joins text nodes with no
                // separator and would announce "2 waitingFixtures".
                aria-label={
                  item.badge && item.badge > 0
                    ? `${item.label}, ${item.badge} waiting`
                    : undefined
                }
                onClick={() => onSelect?.(item.id)}
              >
                {isActive ? (
                  <motion.span
                    className={styles.indicator}
                    transition={indicatorTravel}
                    variants={indicator}
                    initial="hidden"
                    animate="current"
                    aria-hidden="true"
                    {...(reduced ? {} : { layoutId: `${instanceId}-indicator` })}
                  />
                ) : null}
                <span className={styles.iconWrap}>
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  {item.badge && item.badge > 0 ? (
                    <span className={styles.badge} aria-hidden="true">
                      {item.badge}
                    </span>
                  ) : null}
                </span>
                <span className={styles.label}>{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
