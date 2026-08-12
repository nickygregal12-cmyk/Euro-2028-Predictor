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
  /**
   * The product's name, and the ONLY brand field the running application needs
   * — `RouteAccessibility` puts it in the document title on every route.
   *
   * The descriptive copy (short name, monogram, tagline, description) lives in
   * `sitePublicMetadata.ts` because nothing reads it before a route renders,
   * and carrying it here put the entry chunk on its ceiling. See that file.
   */
  readonly productName: string
}

export type SiteConfiguration = {
  readonly variant: SiteVariant
  readonly brand: SiteBrand
  readonly navigation: SiteNavigation
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
   * Whether this build serves the Euro 2028 tournament's own PLAYER routes.
   *
   * ADR 0028 resolved the deployment question on 12 August 2026: the Hub and
   * Euro experiences are separate sites, with contextual links between them.
   * Therefore the Hub refuses the tournament's player routes and the Euro
   * deployment serves them. This deployment gate is separate from publication:
   * `euro_publication_state()` still decides whether a tournament served by the
   * Euro build may actually be seen.
   */
  readonly servesEuroTournament: boolean
  /**
   * Whether this build serves the DOMESTIC weekly competition tree — the
   * published catalogue at `/competitions` and everything under
   * `/competitions/:competitionSlug/:seasonSlug`.
   *
   * The weekly tree belongs to the Hub. The Euro build links back to the Hub
   * instead of duplicating domestic seasons under tournament branding.
   */
  readonly servesDomesticCompetitions: boolean
}

/** Environment-supplied addressing. Absent values stay absent. */
export type SiteOrigins = {
  /** `VITE_PUBLIC_SITE_ORIGIN` — the origin of the site being built. */
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

function hubConfiguration(origins: SiteOrigins): SiteConfiguration {
  return {
    variant: 'hub',
    brand: { productName: 'Football Prediction Hub' },
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
    routes: {
      signedInHome: '/',
      siblingSiteOrigin: normaliseOrigin(origins.siblingOrigin),
      siblingSiteName: 'Euro 2028 Predictor',
    },
    servesEuroTournament: false,
    servesDomesticCompetitions: true,
  }
}

function euroConfiguration(origins: SiteOrigins): SiteConfiguration {
  return {
    variant: 'euro',
    brand: { productName: 'Euro 2028 Predictor' },
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
    routes: {
      signedInHome: '/',
      siblingSiteOrigin: normaliseOrigin(origins.siblingOrigin),
      siblingSiteName: 'Football Prediction Hub',
    },
    servesEuroTournament: true,
    servesDomesticCompetitions: false,
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
