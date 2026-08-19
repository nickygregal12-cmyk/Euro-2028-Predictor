import { type SiteVariant } from './siteVariant.js'

/** A global destination, in the order this site's navigation offers it. */
export type SiteDestination = {
  readonly key: string
  readonly label: string
  readonly href: string
}

export type SiteNavigation = {
  readonly destinations: readonly SiteDestination[]
  readonly competitionsGroupLabel: string
  readonly bonusGamesLabel: string | null
}

export type SiteBrand = {
  /** The product name consumed by route titles and deployment-aware UI. */
  readonly productName: string
}

export type SiteConfiguration = {
  readonly variant: SiteVariant
  readonly brand: SiteBrand
  readonly navigation: SiteNavigation
  readonly routes: {
    readonly signedInHome: string
    readonly siblingSiteOrigin: string | null
    readonly siblingSiteName: string
  }
  readonly servesEuroTournament: boolean
  readonly servesDomesticCompetitions: boolean
}

/** Environment-supplied addressing. Absent values stay absent. */
export type SiteOrigins = {
  readonly publicOrigin?: string | undefined
  readonly siblingOrigin?: string | undefined
}

/** Accept an absolute `http(s)` origin, or nothing. */
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
    // ADR 0031 names the weekly product Predictor Hub. Keep that identity here
    // so auth, navigation, document titles and support copy consume one fact.
    brand: { productName: 'Predictor Hub' },
    navigation: {
      destinations: [
        { key: 'home', label: 'Home', href: '/' },
        { key: 'play', label: 'Play', href: '/play' },
        { key: 'matches', label: 'Matches', href: '/matches' },
        { key: 'leagues', label: 'Leagues', href: '/leagues' },
      ],
      competitionsGroupLabel: 'My competitions',
      bonusGamesLabel: null,
    },
    routes: {
      signedInHome: '/',
      siblingSiteOrigin: normaliseOrigin(origins.siblingOrigin),
      siblingSiteName: 'Euro 2028 Predictor',
    },
    // These route-served values describe today's deployed evidence, not the
    // target architecture. Their changes remain separately governed.
    servesEuroTournament: true,
    servesDomesticCompetitions: true,
  }
}

function euroConfiguration(origins: SiteOrigins): SiteConfiguration {
  return {
    variant: 'euro',
    brand: { productName: 'Euro 2028 Predictor' },
    navigation: {
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
      siblingSiteName: 'Predictor Hub',
    },
    servesEuroTournament: true,
    servesDomesticCompetitions: false,
  }
}

/**
 * Build the configuration for one variant. Pure and Node-importable so the
 * build and browser can assert both products from the same authority.
 */
export function siteConfiguration(
  variant: SiteVariant,
  origins: SiteOrigins = {},
): SiteConfiguration {
  return variant === 'euro' ? euroConfiguration(origins) : hubConfiguration(origins)
}
