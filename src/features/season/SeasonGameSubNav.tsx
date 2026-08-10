import { Link, useLocation } from 'react-router'
import {
  competitionChampionshipFixturesRoute,
  competitionChampionshipInstanceRoute,
  competitionChampionshipTableRoute,
  competitionGameRoute,
  competitionGameStandingsRoute,
  competitionRefFromPath,
  competitionSectionRoute,
  type DomesticGameRoute,
} from '../../app/weeklyRoutes'
import styles from './SeasonGameSubNav.module.css'

/**
 * A game's own secondary navigation.
 *
 * IT LISTS ONLY WHAT EXISTS. Every item used to be declared whether or not it
 * had a destination, and one without was rendered as a greyed span titled "Not
 * built yet" — nine of them across the three games, three of the four on Last
 * Man Standing, so its navigation read as four tabs of which one worked. A
 * label that cannot be pressed is not navigation; it is a roadmap printed on
 * the furniture, and it is what a player means by an unclickable button.
 *
 * `href: null` stays expressible and is filtered rather than deleted from the
 * type: it is how the Championship's History and the Match Predictor's Trends
 * remain recorded as intended sections in the one place that would otherwise
 * forget them. They return, from this same list, when they have a page.
 */
type Item = {
  key: string
  label: string
  href: string | null
}

function championshipInstanceId(pathname: string, base: string): string | null {
  if (!pathname.startsWith(`${base}/`)) return null
  const first = pathname.slice(base.length + 1).split('/').filter(Boolean)[0]
  return first ?? null
}

function itemsFor(game: DomesticGameRoute, pathname: string): { active: string; items: Item[] } {
  const ref = competitionRefFromPath(pathname)
  if (!ref) return { active: '', items: [] }
  const base = competitionGameRoute(ref, game)

  if (game === 'match-predictor') {
    const standings = competitionGameStandingsRoute(ref)
    return {
      active: pathname.startsWith(standings) ? 'standings' : 'play',
      items: [
        { key: 'play', label: 'Play', href: base },
        { key: 'standings', label: 'Standings', href: standings },
        { key: 'trends', label: 'Trends', href: null },
        { key: 'history', label: 'History', href: null },
      ],
    }
  }

  if (game === 'lms') {
    return {
      active: 'pick',
      items: [
        { key: 'pick', label: 'Pick', href: base },
        { key: 'standings', label: 'Standings', href: null },
        { key: 'history', label: 'History', href: null },
        { key: 'rules', label: 'Rules', href: null },
      ],
    }
  }

  const competitionId = championshipInstanceId(pathname, base)
  if (!competitionId) {
    return {
      active: 'championships',
      items: [{ key: 'championships', label: 'Championships', href: base }],
    }
  }

  const fixture = competitionChampionshipInstanceRoute(ref, competitionId)
  const table = competitionChampionshipTableRoute(ref, competitionId)
  const fixtures = competitionChampionshipFixturesRoute(ref, competitionId)
  const active = pathname.startsWith(fixtures)
    ? 'fixtures'
    : pathname.startsWith(table)
      ? 'table'
      : 'fixture'

  return {
    active,
    items: [
      { key: 'fixture', label: 'My Fixture', href: fixture },
      { key: 'table', label: 'Table', href: table },
      { key: 'fixtures', label: 'Fixtures', href: fixtures },
      { key: 'history', label: 'History', href: null },
    ],
  }
}

const GAME_NAMES: Record<DomesticGameRoute, string> = {
  'match-predictor': 'Match Predictor',
  lms: 'Last Man Standing',
  championship: 'Predictor Championship',
}

export function SeasonGameSubNav({ game }: { game: DomesticGameRoute }) {
  const { pathname } = useLocation()
  const ref = competitionRefFromPath(pathname)
  if (!ref) return null

  const base = competitionGameRoute(ref, game)
  const gamesHref = competitionSectionRoute(ref, 'games')
  const { active, items: declared } = itemsFor(game, pathname)
  // The active item keeps its place though it is not a link: it is where the
  // player is, which is the one label that needs no destination.
  const items = declared.filter((item) => item.href !== null || item.key === active)
  // A navigation with nowhere else to go is not a navigation. Last Man Standing
  // has exactly one built section, so it renders its parent link and its page
  // rather than a lone tab restating where the player already is.
  const navigable = items.some((item) => item.key !== active)
  const instanceId = game === 'championship' ? championshipInstanceId(pathname, base) : null
  const backHref = instanceId ? base : gamesHref
  const backLabel = instanceId ? 'Back to Championships' : 'Back to Games'
  // The game's own root already has its parent from the competition shell, so
  // this component's back link is for the level below it.
  const back = pathname === base ? null : { href: backHref, label: backLabel }

  // With the unbuilt sections gone, a game at its own root can have neither a
  // back link nor a second destination — Last Man Standing today. An empty
  // wrapper would still occupy its gap in the page's flex column, so it renders
  // nothing at all rather than blank space above the content.
  if (!back && !navigable) return null

  return (
    <div className={styles.wrap}>
      {back ? (
        <Link className={styles.back} to={back.href}>
          {back.label}
        </Link>
      ) : null}
      {navigable ? (
        <nav
          className={styles.nav}
          aria-label={`${GAME_NAMES[game]} navigation`}
          tabIndex={0}
        >
          <ul className={styles.list}>
            {items.map((item) =>
              item.key === active ? (
                <li key={item.key}>
                  <span className={styles.active} aria-current="page">
                    {item.label}
                  </span>
                </li>
              ) : item.href ? (
                <li key={item.key}>
                  <Link className={styles.link} to={item.href}>
                    {item.label}
                  </Link>
                </li>
              ) : // Unreachable: the filter above keeps only linked items and
              // the active one. Left as a null branch rather than a non-null
              // assertion, so a future edit to the filter degrades to a missing
              // label instead of a link pointing at the wrong page.
              null,
            )}
          </ul>
        </nav>
      ) : null}
    </div>
  )
}
