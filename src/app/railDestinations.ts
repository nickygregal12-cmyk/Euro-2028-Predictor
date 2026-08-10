import type { RailGroup, RailLink } from '../design-system/SideRail'
import {
  BallIcon,
  CalendarIcon,
  CardsIcon,
  GlobeIcon,
  HomeIcon,
  InfoIcon,
  MoreIcon,
  TrophyIcon,
} from '../design-system/icons'
import { competitionPath } from '../features/hub/competitionCatalogue'
import type { PlayerCompetitions } from '../features/hub/playerCompetitions'
import { weeklyRoutes } from './weeklyRoutes'

/**
 * What the persistent desktop rail offers.
 *
 * THE RAIL IS PERMANENTLY GLOBAL AND NEVER BECOMES A COMPETITION TREE. That is
 * the 10 August 2026 navigation authority, and it is a correction to what this
 * module did first: it expanded the competition the player was inside into
 * Overview / Play / Matches / Games / Leagues, which put a second copy of the
 * competition's own navigation in the frame beside the real one under the
 * masthead. Two navigations answering the same question is worse than one, and
 * the one in the content column is the one that belongs to the competition.
 *
 * THE TWO LAYERS ANSWER DIFFERENT QUESTIONS and are both visible on desktop:
 * the rail answers "where am I going in the platform", the competition
 * sub-navigation answers "where am I going inside this competition". A
 * competition shortcut here opens that competition's OVERVIEW and nothing
 * deeper.
 *
 * IT IS BOUNDED, BECAUSE TWENTY COMPETITIONS IS THE DESIGN TARGET. Only the
 * player's own competitions appear, capped at `COMPETITION_SHORTCUT_LIMIT`,
 * followed by All competitions. The rail's height is therefore a function of
 * what the player plays, never of what the platform publishes — a platform with
 * twenty published competitions and a player relevant to three renders three
 * rows.
 *
 * IT CLAIMS NO MEMBERSHIP IT WAS NOT TOLD. The shortcuts come from the server's
 * membership read through `PlayerCompetitions`, never from the presentation
 * catalogue's `joined` flags, which are placeholders. While that read is in
 * flight or after it fails, the group is the single Explore destination: an
 * honest "here is where competitions are" rather than a guess at which are
 * yours.
 *
 * WHY IT LIVES HERE AND NOT IN THE DESIGN SYSTEM. Which destinations exist is a
 * routing and catalogue fact; `SideRail` renders whatever it is handed. That
 * separation is what lets this be a pure function with a test.
 */

/**
 * "PL", "SP" — the initials of a competition's name.
 *
 * A COMPETITION IS NOT A CATEGORY, so it does not get a category's icon. Every
 * competition drawn as the same globe is indistinguishable in the collapsed
 * rail, where the name is only a tooltip; its own initials are not. One word
 * gives two letters of that word so a single-word competition is not one
 * character.
 */
export function monogramOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return (words[0] as string).slice(0, 2).toUpperCase()
  return words
    .slice(0, 2)
    .map((word) => (word as string)[0])
    .join('')
    .toUpperCase()
}

function mainGroup(): RailGroup {
  return {
    key: 'main',
    links: [
      { key: 'home', label: 'Home', href: weeklyRoutes.hub, Icon: HomeIcon },
      { key: 'play', label: 'Play', href: weeklyRoutes.play, Icon: BallIcon },
      { key: 'matches', label: 'Matches', href: weeklyRoutes.matches, Icon: CalendarIcon },
      // "Leagues", not "Leagues & Competitions". The label was widened on
      // desktop and the authority narrowed it back: the page itself explains
      // the difference between a private league and a private LMS or
      // Championship competition, and a two-word navigation label is a worse
      // place to teach it than the page that lists them.
      { key: 'leagues', label: 'Leagues', href: weeklyRoutes.leagues, Icon: TrophyIcon },
    ],
  }
}

function competitionsGroup(player: PlayerCompetitions | null): RailGroup {
  const links: RailLink[] = []

  for (const entry of player?.shortcuts ?? []) {
    links.push({
      key: entry.competition.seasonRowName,
      label: entry.competition.name,
      // The competition's OVERVIEW. Never a section, never a game: those are
      // the content shell's, and putting one here would be the tree again.
      href: competitionPath(entry.competition),
      monogram: monogramOf(entry.competition.name),
    })
  }

  // Always last and always present. It is where the rest of `mine` goes when
  // the player has more than the rail shows, and it is the whole catalogue's
  // only permanent entry point.
  links.push({
    key: 'explore',
    label: 'All competitions',
    href: weeklyRoutes.competitions,
    Icon: GlobeIcon,
  })

  return { key: 'competitions', title: 'My competitions', links }
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

export function railGroups(player: PlayerCompetitions | null): RailGroup[] {
  return [mainGroup(), competitionsGroup(player), moreGroup()]
}
