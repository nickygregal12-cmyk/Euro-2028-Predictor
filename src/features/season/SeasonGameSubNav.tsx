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
  const { active, items } = itemsFor(game, pathname)
  const instanceId = game === 'championship' ? championshipInstanceId(pathname, base) : null
  const backHref = instanceId ? base : gamesHref
  const backLabel = instanceId ? 'Back to Championships' : 'Back to Games'

  return (
    <div className={styles.wrap}>
      {pathname !== base ? (
        <Link className={styles.back} to={backHref}>
          {backLabel}
        </Link>
      ) : null}
      <nav
        className={styles.nav}
        aria-label={`${GAME_NAMES[game]} navigation`}
        tabIndex={0}
      >
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.key}>
              {item.key === active ? (
                <span className={styles.active} aria-current="page">
                  {item.label}
                </span>
              ) : item.href ? (
                <Link className={styles.link} to={item.href}>
                  {item.label}
                </Link>
              ) : (
                <span className={styles.disabled} aria-disabled="true" title="Not built yet">
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
