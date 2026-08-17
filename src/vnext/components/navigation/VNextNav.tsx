import { useId } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, Gamepad2, Home, Users } from 'lucide-react'
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
  /** `bar` is the mobile bottom bar; `rail` is the desktop rail's column. */
  variant?: 'bar' | 'rail'
  /** The navigation landmark's name. Two shapes, one name. */
  label?: string
}

/**
 * THE FOUR COMPETITION-SCOPED DESTINATIONS — STAGE 7.6.
 *
 * They belong to the ACTIVE FOOTBALL COMPETITION and not to the platform. That
 * is the whole of the selected information architecture in one array: there is
 * no global Matches, no global Games and no global Leagues, because the
 * competition is the root and these are its own sections.
 *
 * WHAT THEY REPLACED, AND WHY. Stage 4 settled `Home · Fixtures · Leagues ·
 * Season` for a product whose navigation was the platform's. `Season` was a
 * destination because the competition had nowhere else to be stated; under the
 * Competition Deck the competition IS the chrome above these four, so a Season
 * tab would be a link to where the player already is. `Fixtures` became
 * `Matches` to match the product's own word for football
 * (`SeasonMatchesRoute`, `/competitions/:c/:s/matches`, the Match Centre), and
 * `Games` is new: the place where Match Predictor, Last Man Standing and the
 * Predictor Championship are PEERS. That place is what stopped Last Man
 * Standing being "another little tab".
 *
 * `Games` AND NOT `Play`. Independent review asked whether "Matches" and
 * "Games" read as synonyms in a UK football product. They can — and "Play" is
 * still the wrong fix here, because this product already uses both words and
 * they already mean different things: a *game* is a joinable format
 * (`get_competition_games`, `CompetitionGameKey`, onboarding's "Choose your
 * games"), and *Play* is the cross-competition action inbox at `/play` whose
 * job the Competition Deck moves into Home. The full comparison is in
 * `docs/product/vnext-shell-ia.md` §"Games versus Play".
 *
 * STILL FOUR. Four is the most that clears a 44px target across a 375px bar
 * without the labels shrinking to a memory test — the finding Stage 4 recorded
 * and the reason the attention layer and Jump are not a fifth and a sixth.
 */
export const defaultNavItems: readonly VNextNavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'matches', label: 'Matches', icon: CalendarDays },
  { id: 'games', label: 'Games', icon: Gamepad2 },
  { id: 'leagues', label: 'Leagues', icon: Users },
]

/**
 * Navigation, in the two shapes vNext needs.
 *
 * WHY ONE COMPONENT. A bottom bar and a masthead band are the same list of
 * destinations with the same state; splitting them into two components would
 * mean two places to keep the active item, the badge and the label in step.
 * Only the CSS differs.
 *
 * WHY A RAIL AND NOT A BAND, NOW. Stage 5 chose a masthead band on the argument
 * that a vertical rail takes a column off the football for the life of the
 * page. That argument was right about a page and wrong about a PRODUCT: the
 * Competition Deck has permanent things to say that a 48px band cannot hold —
 * which competition you are in, which others you have, what is waiting in one
 * of them — and squeezing those into a band was how Stage 5's navigation ran
 * out of room and grew a `Season` tab. The rail is bounded (see
 * `SHELL_SHORTCUT_LIMIT`) and appears only at 1120px and above, where the
 * column is spare.
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
  label = 'Competition sections',
}: VNextNavProps) {
  const instanceId = useId()
  const reduced = useReducedMotionPreference()
  const indicator = useVNextMotion(vnextMotion.navIndicator)
  const indicatorTravel = useVNextTransition(vnextTransition.navIndicator)

  return (
    <nav
      className={`${styles.nav} ${styles[variant]}`}
      aria-label={label}
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
