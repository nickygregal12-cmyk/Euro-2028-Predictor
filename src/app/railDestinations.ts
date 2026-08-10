import type { RailGroup, RailLink } from '../design-system/SideRail'
import {
  BallIcon,
  CalendarIcon,
  CardsIcon,
  HomeIcon,
  InfoIcon,
  MoreIcon,
  TrophyIcon,
} from '../design-system/icons'
import { HUB_COMPETITIONS, competitionPath } from '../features/hub/competitionCatalogue'
import { isNextUi } from './routeFlags'
import {
  competitionGameRoute,
  competitionRefFromPath,
  competitionSectionRoute,
  weeklyRoutes,
} from './weeklyRoutes'

/**
 * What the persistent desktop rail offers, derived from the pathname.
 *
 * WHY IT LIVES HERE AND NOT IN THE DESIGN SYSTEM. Which destinations exist is a
 * routing and catalogue fact; `SideRail` renders whatever it is handed. Keeping
 * the two apart is what lets this be a pure function with a test, and keeps the
 * design system free of route knowledge.
 *
 * THE FIRST GROUP IS THE BOTTOM BAR, EXACTLY. Same five destinations, same
 * order, so the rail is a presentation of the global navigation at a wider
 * width and not a second information architecture. Only the Leagues label
 * differs — "Leagues & Competitions" on desktop, as the direction specifies,
 * because there is room for the distinction to be made.
 *
 * THE COMPETITION GROUP IS DISCOVERY, NOT MEMBERSHIP. It lists the competitions
 * the platform runs. It must never be read as "your competitions": the
 * catalogue's `joined` flags are presentation placeholders, and a rail built on
 * them would confidently name competitions the player never entered. Each link
 * opens surfaces that read real membership from the server.
 *
 * NO DEAD LINKS. A nested game appears only where its route renders something:
 * the Match Predictor is behind `VITE_UI_SEASON_MATCH_PREDICTOR` and its route
 * answers `NotFoundPage` while that flag is off, so it is omitted rather than
 * offered. This is the same rule that removed the nine greyed sub-navigation
 * labels, applied before they can come back in a new place.
 */

function hubGroup(): RailGroup {
  return {
    key: 'hub',
    links: [
      { key: 'home', label: 'Home', href: weeklyRoutes.hub, Icon: HomeIcon },
      { key: 'play', label: 'Play', href: weeklyRoutes.play, Icon: BallIcon },
      { key: 'matches', label: 'Matches', href: weeklyRoutes.matches, Icon: CalendarIcon },
      {
        key: 'leagues',
        // The desktop name. The bottom bar says "Leagues", which is short and
        // familiar on a phone; the extra width here is spent making the
        // distinction between a private league and a competition clearer.
        label: 'Leagues & Competitions',
        href: weeklyRoutes.leagues,
        Icon: TrophyIcon,
      },
    ],
  }
}

/**
 * The sections and games of the competition the player is currently inside,
 * indented under it. Only for the current one: expanding every competition at
 * once would make the rail a sitemap.
 */
function competitionChildren(pathname: string, base: string): RailLink[] {
  const ref = competitionRefFromPath(pathname)
  if (!ref) return []
  if (competitionSectionRoute(ref, 'overview') !== base) return []

  const children: RailLink[] = [
    {
      key: 'overview',
      label: 'Overview',
      href: competitionSectionRoute(ref, 'overview'),
      nested: true,
    },
    { key: 'play', label: 'Play', href: competitionSectionRoute(ref, 'play'), nested: true },
    {
      key: 'matches',
      label: 'Matches',
      href: competitionSectionRoute(ref, 'matches'),
      nested: true,
    },
    { key: 'games', label: 'Games', href: competitionSectionRoute(ref, 'games'), nested: true },
  ]

  if (isNextUi('seasonMatchPredictor')) {
    children.push({
      key: 'match-predictor',
      label: 'Match Predictor',
      href: competitionGameRoute(ref, 'match-predictor'),
      nested: true,
    })
  }
  children.push(
    {
      key: 'lms',
      label: 'Last Man Standing',
      href: competitionGameRoute(ref, 'lms'),
      nested: true,
    },
    {
      key: 'championship',
      label: 'Predictor Championship',
      href: competitionGameRoute(ref, 'championship'),
      nested: true,
    },
    {
      key: 'competition-leagues',
      label: 'Leagues',
      href: competitionSectionRoute(ref, 'leagues'),
      nested: true,
    },
  )

  return children
}

/**
 * "PL", "SP" — the initials of a competition's name.
 *
 * A COMPETITION IS NOT A CATEGORY, so it does not get a category's icon. Every
 * competition drawn as the same globe is indistinguishable in the collapsed
 * rail, where the name is only a tooltip; its own initials are not. One word
 * gives two letters of that word so a single-word competition is not one
 * character.
 */
function monogramOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return (words[0] as string).slice(0, 2).toUpperCase()
  return words
    .slice(0, 2)
    .map((word) => (word as string)[0])
    .join('')
    .toUpperCase()
}

function competitionsGroup(pathname: string): RailGroup {
  const links: RailLink[] = []
  for (const competition of HUB_COMPETITIONS) {
    const base = competitionPath(competition)
    links.push({
      key: competition.competitionSlug,
      label: competition.name,
      href: base,
      monogram: monogramOf(competition.name),
    })
    links.push(...competitionChildren(pathname, base))
  }
  return { key: 'competitions', title: 'Competitions', links }
}

function moreGroup(): RailGroup {
  return {
    key: 'more',
    title: 'More',
    links: [
      { key: 'how-to-play', label: 'How to play', href: '/more/scoring', Icon: InfoIcon },
      { key: 'profile', label: 'Profile', href: '/profile', Icon: CardsIcon },
      { key: 'account', label: 'Account & settings', href: '/account', Icon: MoreIcon },
    ],
  }
}

export function railGroups(pathname: string): RailGroup[] {
  return [hubGroup(), competitionsGroup(pathname), moreGroup()]
}
