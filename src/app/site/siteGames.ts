import type { SiteVariant } from './siteVariant.js'

/**
 * How each deployment presents the games it offers.
 *
 * WHY THIS IS NOT PART OF `SiteConfiguration`. The configuration is imported by
 * `SiteProvider`, which sits above the router, so everything in it is in the
 * entry chunk that every visitor downloads before anything renders. The game
 * copy is only ever read by surfaces that LIST games — the two landing pages
 * and the games sections — all of which are lazily routed. Keeping it here
 * means a Prediction Hub visitor never downloads the tournament's copy, and it
 * kept the entry chunk inside its compressed budget rather than over it by
 * 0.2 KB. That is the measured reason, not a stylistic one.
 *
 * `rank` IS PRESENTATION WEIGHT AND NOTHING ELSE. It never decides entry,
 * eligibility or scoring: a Bonus Game is the same game with the same server
 * authorities, shown in a secondary group because the tournament is what its
 * site is about. The Euro deployment ranks the three weekly games `'bonus'`;
 * it does not remove them, and their names and descriptions are identical on
 * both sites — `siteConfiguration.test.ts` holds that.
 *
 * THE COPY DESCRIBES A GAME FORMAT, NEVER A COMPETITION. One sentence per game,
 * identical in every competition that runs it, so publishing a twenty-first
 * league adds a catalogue row and no frontend edit.
 */

export type SiteGameRank = 'primary' | 'equal' | 'bonus'

export type SiteGameKey = 'euroPredictor' | 'matchPredictor' | 'lms' | 'championship'

export type SiteGamePresentation = {
  readonly key: SiteGameKey
  readonly name: string
  readonly summary: string
  readonly rank: SiteGameRank
}

const WEEKLY_GAMES: readonly Omit<SiteGamePresentation, 'rank'>[] = [
  {
    key: 'matchPredictor',
    name: 'Match Predictor',
    summary:
      'Predict every scoreline in the matchweek, play a Joker when you fancy it, and bank points as the results land.',
  },
  {
    key: 'lms',
    name: 'Last Man Standing',
    summary:
      'Pick one club to win each round. Get it right and you go through; get it wrong and you are out.',
  },
  {
    key: 'championship',
    name: 'Predictor Championship',
    summary:
      'Drawn into a group and playing a fixture a matchweek — your prediction points decide the result.',
  },
]

const EURO_PREDICTOR: Omit<SiteGamePresentation, 'rank'> = {
  key: 'euroPredictor',
  name: 'Euro Predictor',
  summary:
    'Predict every Euro 2028 scoreline from the group stage to the final, and call the bracket before a ball is kicked.',
}

function ranked(
  games: readonly Omit<SiteGamePresentation, 'rank'>[],
  rank: SiteGameRank,
): readonly SiteGamePresentation[] {
  return games.map((game) => ({ ...game, rank }))
}

/** Every game this deployment presents, in its own order. */
export function siteGames(variant: SiteVariant): readonly SiteGamePresentation[] {
  return variant === 'euro'
    ? [{ ...EURO_PREDICTOR, rank: 'primary' }, ...ranked(WEEKLY_GAMES, 'bonus')]
    : ranked(WEEKLY_GAMES, 'equal')
}

/** The games this site presents above the fold. */
export function primaryGames(variant: SiteVariant): readonly SiteGamePresentation[] {
  return siteGames(variant).filter((game) => game.rank !== 'bonus')
}

/** The games grouped under `navigation.bonusGamesLabel`, if any. */
export function bonusGames(variant: SiteVariant): readonly SiteGamePresentation[] {
  return siteGames(variant).filter((game) => game.rank === 'bonus')
}
