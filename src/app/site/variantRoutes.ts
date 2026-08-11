import { weeklyRoutes } from '../shellRoutes'
import type { SiteVariant } from './siteVariant.js'

/**
 * Which product each shared top-level path is, on each build.
 *
 * THE PROBLEM THIS EXISTS FOR. ADR 0026 puts two products on one commit, and the
 * four global destinations — `/`, `/play`, `/matches`, `/leagues` — belong to both
 * of them. PR #702 built the seam that makes the two builds differ in brand,
 * navigation wording and public metadata, and stopped there: a signed-in visitor to
 * the Euro deployment still landed on the domestic Hub's home, its joined-game
 * inbox and its followed-competition calendar, wearing Euro labels. The labels were
 * the only thing that had changed.
 *
 * SO THE OWNERSHIP IS DECLARED, NOT SCATTERED. Each row below names one path and,
 * for each build, the surface that path is. A component that branches on
 * `variant === 'euro'` in the middle of a render is unreviewable — nobody can state
 * what the two products differ by — whereas a table can be asserted whole:
 * `tests/app/variantRoutes.test.ts` proves every shared path resolves in both
 * builds, that no path is left unowned, and that the two builds never resolve the
 * same path to the same surface, which would mean the split had quietly regressed.
 *
 * IT IS ADDRESSING, NEVER PERMISSION. Naming the Euro tournament as the owner of
 * `/play` on the Euro build says which surface that path IS. Whether the visitor
 * may see it is contract 143's publication state and `servesEuroTournament`, both
 * resolved in `TournamentJourney`, and neither is repeated here. A surface named
 * below can still render a refusal.
 *
 * PURE, AND IMPORTED BY TESTS AND BY THE ROUTER ALIKE. It resolves no component
 * and reads no environment: the surface is an identifier, and `VariantRoutes.tsx`
 * is the one place that turns an identifier into an element.
 */

/**
 * What renders at a shared path.
 *
 * The identifiers are the product's own words rather than component names, because
 * the question this table answers is "what is this page" and not "which file". A
 * component rename must not read as a change of product.
 */
export type VariantSurface =
  /** The domestic action-led home: what needs doing, across every competition. */
  | 'hub-home'
  /** The domestic joined-game inbox. */
  | 'hub-play'
  /** Followed domestic competitions, and the addressable Match Centre. */
  | 'hub-matches'
  /** Private domestic play. */
  | 'hub-leagues'
  /** The state-aware Euro home, which fails closed to a closed-state page. */
  | 'euro-home'
  /** Euro 2028 prediction entry — the tournament journey's front door. */
  | 'euro-predict'
  /** Euro 2028 tournament matches. */
  | 'euro-matches'
  /** Euro 2028 leagues and standings. */
  | 'euro-leagues'

export type VariantRouteOwnership = {
  readonly path: string
  readonly hub: VariantSurface
  readonly euro: VariantSurface
}

/**
 * Every path both builds serve, and what each build serves there.
 *
 * A path belongs here when BOTH builds answer it and mean different things. A path
 * only one build serves is registered in that build's own authority — the weekly
 * tree in `shellRoutes.ts`, the tournament tree in `euroRoutes.ts` — and needs no
 * row, because there is nothing to disambiguate.
 */
export const VARIANT_ROUTE_OWNERSHIP: readonly VariantRouteOwnership[] = [
  { path: weeklyRoutes.hub, hub: 'hub-home', euro: 'euro-home' },
  { path: weeklyRoutes.play, hub: 'hub-play', euro: 'euro-predict' },
  { path: weeklyRoutes.matches, hub: 'hub-matches', euro: 'euro-matches' },
  { path: weeklyRoutes.leagues, hub: 'hub-leagues', euro: 'euro-leagues' },
]

/**
 * What this build serves at a shared path, or null when the path is not shared.
 *
 * Null rather than a fallback surface: a caller asking about a path no row owns
 * has asked the wrong question, and answering it with the home page would hide
 * that.
 */
export function variantSurface(
  variant: SiteVariant,
  path: string,
): VariantSurface | null {
  const row = VARIANT_ROUTE_OWNERSHIP.find((entry) => entry.path === path)
  if (!row) return null
  return variant === 'euro' ? row.euro : row.hub
}

/** The four shared paths, for a guard that wants to sweep them. */
export const SHARED_TOP_LEVEL_PATHS: readonly string[] = VARIANT_ROUTE_OWNERSHIP.map(
  (row) => row.path,
)
