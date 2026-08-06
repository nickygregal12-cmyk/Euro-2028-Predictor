import type { SeasonShellSection } from './SeasonCompetitionShell'

/**
 * Where each §7.3 section lives for one competition season.
 *
 * ONE PLACE, BECAUSE TWO WOULD DRIFT. Several routes render the competition
 * shell and each needs the same map; when they built it inline, a section
 * becoming reachable meant remembering every one of them, and the one that was
 * forgotten kept rendering a section as unavailable after it had shipped. A
 * section is added here once.
 *
 * A SECTION WITH NO SEASON IMPLEMENTATION IS ABSENT, NOT LINKED. The shell
 * renders an absent section as an explicitly unavailable label, which is a
 * better answer than a dead link.
 *
 * OVERVIEW AND GAMES DELIBERATELY SHARE ONE DESTINATION, and it is worth being
 * plain about why rather than letting it look like a mistake. §7.3 separates
 * them — Overview is the "state-driven competition dashboard", Games is
 * "joined games first, available games second" — but the dashboard has no
 * state to drive it yet, so the games catalogue *is* what it renders. Splitting
 * them today would leave Overview empty and put the same list on two addresses.
 * Pointing Games at the page that genuinely holds the games is the honest
 * arrangement in the meantime: before this, Last Man Standing and the
 * Championship both declared themselves to be in a section the player could
 * not navigate to. They separate when Overview has next action and next lock to
 * show, which is the read that is missing rather than the page.
 */
export function seasonShellDestinations(
  base: string,
): Partial<Record<SeasonShellSection, string>> {
  return {
    overview: base,
    play: `${base}/play`,
    matches: `${base}/matches`,
    games: base,
    leagues: `${base}/leagues`,
  }
}

/** The competition's own address, from the two slugs a season URL carries. */
export function seasonBasePath(competitionSlug: string, seasonSlug: string): string {
  return `/competitions/${competitionSlug}/${seasonSlug}`
}
