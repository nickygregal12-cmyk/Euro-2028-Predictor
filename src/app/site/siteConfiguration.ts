import { type SiteVariant } from './siteVariant.js'

/**
 * Everything that differs between the Prediction Hub deployment and the Euro
 * 2028 deployment, in one typed value.
 *
 * WHY A CONFIGURATION AND NOT A SCATTER OF `variant === 'euro'` CHECKS. Two
 * products built from one commit can only be trusted if the differences are
 * enumerable. As a single derived value they can be asserted — a test can build
 * both and compare them field by field, and `siteConfigurationParity` can prove
 * that no Hub build carries the Euro origin and no Euro build carries the Hub's.
 * As branches spread through components, nobody can state what the two sites
 * actually differ by, and the honest answer becomes "whatever the branches do".
 *
 * IT CARRIES PRESENTATION AND ADDRESSING ONLY. Nothing here is a scoring, lock,
 * membership, settlement, progression or reveal rule, and nothing here decides
 * whether Euro 2028 is published — that is `euro_publication_state`, contract
 * 143, read from the server. A variant chooses which product is presented; the
 * server still decides what that product may show.
 *
 * PURE, AND FREE OF `import.meta.env`. `vite.config.ts` imports this to generate
 * the document head, the sitemap and `robots.txt` at build time, so it must load
 * under plain Node with no Vite client types. `currentSite.ts` is the only
 * module that reads the environment.
 *
 * THE `.js` IMPORT EXTENSIONS IN THIS DIRECTORY ARE LOAD-BEARING, and are the
 * only ones in `src/`. `vite.config.ts` belongs to `tsconfig.node.json`, which
 * resolves modules as `nodenext` and requires explicit extensions; importing
 * this file from there pulls this whole directory into that project. The app
 * project's `bundler` resolution accepts the same specifiers, so one extension
 * satisfies both. Removing them to match the rest of `src/` fails the build.
 */

/**
 * A game as this site presents it.
 *
 * `rank` is presentation weight and nothing else. It never decides entry,
 * eligibility or scoring: a Bonus Game is the same game with the same server
 * authorities, shown in a secondary group because the tournament is what its
 * site is about.
 */
export type SiteGameRank = 'primary' | 'equal' | 'bonus'

export type SiteGameKey = 'euroPredictor' | 'matchPredictor' | 'lms' | 'championship'

export type SiteGamePresentation = {
  readonly key: SiteGameKey
  readonly name: string
  /** One sentence describing the FORMAT, identical in every competition running it. */
  readonly summary: string
  readonly rank: SiteGameRank
}

/** A global destination, in the order this site's navigation offers it. */
export type SiteDestination = {
  readonly key: string
  readonly label: string
  readonly href: string
}

export type SiteNavigation = {
  /**
   * The bottom bar's destinations and the desktop rail's first group, in one
   * order. The two navigations need not share composition, but they must not
   * disagree about which destinations exist or what they are called.
   */
  readonly destinations: readonly SiteDestination[]
  /** What the rail calls the player's own competitions group. */
  readonly competitionsGroupLabel: string
  /**
   * The heading over games this site ranks `'bonus'`, or null when it ranks
   * none of them that way. The Hub has no such group by design: its three
   * weekly games are equal, and a "Bonus Games" heading on the Hub would be a
   * hierarchy the product does not have.
   */
  readonly bonusGamesLabel: string | null
}

export type SiteBrand = {
  readonly productName: string
  /** For a narrow app bar and the collapsed rail. */
  readonly shortName: string
  readonly monogram: string
  readonly tagline: string
  /** The `<meta name="description">` and the Open Graph description. */
  readonly description: string
}

export type SiteAddressing = {
  /**
   * The absolute origin this site's canonical URL, Open Graph URLs, sitemap and
   * share links are built on, or null when no domain is configured for it.
   *
   * NULL IS A REAL AND EXPECTED VALUE, not a gap to paper over. The Hub's
   * permanent domain is not purchased, and a build that guessed one — or worse,
   * fell back to the other site's — would emit a canonical tag pointing at a
   * different product. Every consumer omits the tag rather than inventing a
   * URL; `documentMetadata.ts` is where that is carried out.
   */
  readonly canonicalOrigin: string | null
  /** Path of the Open Graph image, resolved against `canonicalOrigin`. */
  readonly openGraphImagePath: string
  /** Public paths worth listing in this site's sitemap, root first. */
  readonly sitemapPaths: readonly string[]
}

export type SiteConfiguration = {
  readonly variant: SiteVariant
  readonly brand: SiteBrand
  readonly navigation: SiteNavigation
  readonly addressing: SiteAddressing
  readonly games: readonly SiteGamePresentation[]
  /**
   * Where a signed-in player lands, and where "keep playing" points when this
   * site cannot serve what they came for.
   */
  readonly routes: {
    readonly signedInHome: string
    /**
     * The OTHER deployment's origin, when it is configured, so each site can
     * link to its sibling. Null when the sibling has no configured domain — the
     * link is then omitted rather than pointed at a guess.
     */
    readonly siblingSiteOrigin: string | null
    readonly siblingSiteName: string
  }
  /**
   * Whether this build serves the Euro 2028 tournament's own player routes.
   *
   * FALSE ON THE HUB, AND THAT IS `EURO-001`. Euro 2028 must be completely
   * hidden from the weekly platform until an owner-approved publication state,
   * and a catalogue that merely omits it is not a control — a guessable URL
   * still resolves. The Hub build refuses those routes outright; the Euro build
   * serves them and defers to contract 143's server-owned state for whether the
   * tournament may be seen at all. Two independent gates, neither replacing the
   * other.
   */
  readonly servesEuroTournament: boolean
}

/** Environment-supplied addressing. Absent values stay absent. */
export type SiteOrigins = {
  /** `VITE_PUBLIC_ORIGIN` — the origin of the site being built. */
  readonly publicOrigin?: string | undefined
  /** `VITE_SIBLING_SITE_ORIGIN` — the other deployment's origin. */
  readonly siblingOrigin?: string | undefined
}

/**
 * Accept an absolute `http(s)` origin, or nothing.
 *
 * A trailing slash is stripped so every consumer can concatenate a path without
 * checking, and anything unparseable is treated as absent. A malformed origin
 * produces no canonical tag; it never produces a malformed one.
 */
export function normaliseOrigin(value: string | undefined | null): string | null {
  const raw = (value ?? '').trim()
  if (!raw) return null

  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.origin
  } catch {
    return null
  }
}

const WEEKLY_GAME_SUMMARIES: Record<Exclude<SiteGameKey, 'euroPredictor'>, string> = {
  matchPredictor:
    'Predict every scoreline in the matchweek, play a Joker when you fancy it, and bank points as the results land.',
  lms: 'Pick one club to win each round. Get it right and you go through; get it wrong and you are out.',
  championship:
    'Drawn into a group and playing a fixture a matchweek — your prediction points decide the result.',
}

function weeklyGames(rank: SiteGameRank): readonly SiteGamePresentation[] {
  return [
    {
      key: 'matchPredictor',
      name: 'Match Predictor',
      summary: WEEKLY_GAME_SUMMARIES.matchPredictor,
      rank,
    },
    { key: 'lms', name: 'Last Man Standing', summary: WEEKLY_GAME_SUMMARIES.lms, rank },
    {
      key: 'championship',
      name: 'Predictor Championship',
      summary: WEEKLY_GAME_SUMMARIES.championship,
      rank,
    },
  ]
}

function hubConfiguration(origins: SiteOrigins): SiteConfiguration {
  return {
    variant: 'hub',
    brand: {
      productName: 'Football Prediction Hub',
      shortName: 'Prediction Hub',
      monogram: 'PH',
      tagline: 'Three games. Every matchweek. One private league to settle it.',
      description:
        'Score predictions, Jokers and private leagues across the Premier League and the Scottish Premiership.',
    },
    navigation: {
      // The 10 August 2026 navigation authority's four, in its order.
      destinations: [
        { key: 'home', label: 'Home', href: '/' },
        { key: 'play', label: 'Play', href: '/play' },
        { key: 'matches', label: 'Matches', href: '/matches' },
        { key: 'leagues', label: 'Leagues', href: '/leagues' },
      ],
      competitionsGroupLabel: 'My competitions',
      // No bonus grouping. The three weekly games are equal on the Hub, and a
      // secondary heading would invent a hierarchy the product does not have.
      bonusGamesLabel: null,
    },
    addressing: {
      canonicalOrigin: normaliseOrigin(origins.publicOrigin),
      openGraphImagePath: '/og-image.jpg',
      sitemapPaths: ['/'],
    },
    games: weeklyGames('equal'),
    routes: {
      signedInHome: '/',
      siblingSiteOrigin: normaliseOrigin(origins.siblingOrigin),
      siblingSiteName: 'Euro 2028 Predictor',
    },
    servesEuroTournament: false,
  }
}

function euroConfiguration(origins: SiteOrigins): SiteConfiguration {
  return {
    variant: 'euro',
    brand: {
      productName: 'Euro 2028 Predictor',
      shortName: 'Euro 2028',
      monogram: 'E28',
      tagline: 'One tournament. Every match. The league that decides it.',
      description:
        'Predict every Euro 2028 match, play the knockout bracket and settle it in a private league with your mates.',
    },
    navigation: {
      // Tournament-led order: the tournament's own football comes before the
      // cross-competition inbox, because on this site there is one competition.
      destinations: [
        { key: 'home', label: 'Home', href: '/' },
        { key: 'play', label: 'Predict', href: '/play' },
        { key: 'matches', label: 'Matches', href: '/matches' },
        { key: 'leagues', label: 'Leagues', href: '/leagues' },
      ],
      competitionsGroupLabel: 'Tournament',
      bonusGamesLabel: 'Bonus Games',
    },
    addressing: {
      canonicalOrigin: normaliseOrigin(origins.publicOrigin),
      openGraphImagePath: '/og-image.jpg',
      sitemapPaths: ['/'],
    },
    games: [
      {
        key: 'euroPredictor',
        name: 'Euro Predictor',
        summary:
          'Predict every Euro 2028 scoreline from the group stage to the final, and call the bracket before a ball is kicked.',
        rank: 'primary',
      },
      ...weeklyGames('bonus'),
    ],
    routes: {
      signedInHome: '/',
      siblingSiteOrigin: normaliseOrigin(origins.siblingOrigin),
      siblingSiteName: 'Football Prediction Hub',
    },
    servesEuroTournament: true,
  }
}

/**
 * Build the configuration for one variant.
 *
 * Deliberately a function of its arguments alone, so a test can construct both
 * sites in one process and compare them. Nothing about the running build leaks
 * in.
 */
export function siteConfiguration(
  variant: SiteVariant,
  origins: SiteOrigins = {},
): SiteConfiguration {
  return variant === 'euro' ? euroConfiguration(origins) : hubConfiguration(origins)
}

/** The games this site presents above the fold, in its own order. */
export function primaryGames(
  configuration: SiteConfiguration,
): readonly SiteGamePresentation[] {
  return configuration.games.filter((game) => game.rank !== 'bonus')
}

/** The games grouped under `navigation.bonusGamesLabel`, if any. */
export function bonusGames(
  configuration: SiteConfiguration,
): readonly SiteGamePresentation[] {
  return configuration.games.filter((game) => game.rank === 'bonus')
}

/**
 * Resolve a path against this site's canonical origin.
 *
 * Returns null when no origin is configured. Every caller must treat that as
 * "emit nothing" — never as "use a default" — because the only default
 * available is the other site's domain, and pointing one product's canonical
 * URL at the other is the exact failure this whole seam exists to prevent.
 */
export function absoluteUrl(
  configuration: SiteConfiguration,
  path: string,
): string | null {
  const origin = configuration.addressing.canonicalOrigin
  if (!origin) return null
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}
