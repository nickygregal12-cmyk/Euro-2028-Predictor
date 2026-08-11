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
 * site is about. Their names and descriptions are identical on both sites —
 * `siteConfiguration.test.ts` holds that.
 *
 * DOMESTIC MATCH PREDICTOR IS NOT A EURO BONUS GAME, and the first version of
 * this file said it was. A Bonus Game is a game that runs ALONGSIDE the
 * competition its site is about — Last Man Standing and the Predictor
 * Championship are drawn over whatever competition you enter them in, so
 * offering them under a tournament is coherent. Match Predictor is not a game
 * you attach to something: it IS a competition season, predicted matchweek by
 * matchweek, and the seasons it runs over are the Premier League and the
 * Scottish Premiership. Listing it under Euro 2028 promised a weekly domestic
 * game on a tournament site and then had nowhere to send anyone who wanted it.
 *
 * So the Euro deployment ranks it `'elsewhere'`: named, because a player looking
 * for it deserves to be told where it is rather than left to conclude it does
 * not exist, and pointed at the Hub rather than at a route this deployment does
 * not serve. ADR 0026's own words — the Hub gives the three weekly games equal
 * weight — are what makes it the Hub's.
 *
 * THE COPY DESCRIBES A GAME FORMAT, NEVER A COMPETITION. One sentence per game,
 * identical in every competition that runs it, so publishing a twenty-first
 * league adds a catalogue row and no frontend edit.
 */

/**
 * How much weight this site gives a game.
 *
 * `elsewhere` is the one that is not a weight: it means this deployment does not
 * offer the game at all and names it only so a player can be sent to the site
 * that does. It is never rendered as something to start here.
 */
export type SiteGameRank = 'primary' | 'equal' | 'bonus' | 'elsewhere'

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

/**
 * The two weekly games a tournament site can coherently offer beside itself.
 *
 * Derived from `WEEKLY_GAMES` rather than restated, so a fourth weekly game
 * added tomorrow does not silently become a Euro Bonus Game by omission — it is
 * absent from both lists until somebody decides which it is, and the coverage
 * assertion in `siteConfiguration.test.ts` fails.
 */
const EURO_BONUS_KEYS: readonly SiteGameKey[] = ['lms', 'championship']

/** Every game this deployment presents, in its own order. */
export function siteGames(variant: SiteVariant): readonly SiteGamePresentation[] {
  if (variant !== 'euro') return ranked(WEEKLY_GAMES, 'equal')

  return [
    { ...EURO_PREDICTOR, rank: 'primary' },
    ...WEEKLY_GAMES.map((game) => ({
      ...game,
      rank: EURO_BONUS_KEYS.includes(game.key) ? ('bonus' as const) : ('elsewhere' as const),
    })),
  ]
}

/** The games this site presents above the fold. */
export function primaryGames(variant: SiteVariant): readonly SiteGamePresentation[] {
  return siteGames(variant).filter(
    (game) => game.rank !== 'bonus' && game.rank !== 'elsewhere',
  )
}

/** The games grouped under `navigation.bonusGamesLabel`, if any. */
export function bonusGames(variant: SiteVariant): readonly SiteGamePresentation[] {
  return siteGames(variant).filter((game) => game.rank === 'bonus')
}

/**
 * The games this deployment names but does not offer.
 *
 * Empty on the Hub, which offers all three of its own. On the Euro deployment it
 * is domestic Match Predictor, and a surface that renders this list must send the
 * player to the sibling site rather than to a local route.
 */
export function gamesPlayedElsewhere(
  variant: SiteVariant,
): readonly SiteGamePresentation[] {
  return siteGames(variant).filter((game) => game.rank === 'elsewhere')
}
