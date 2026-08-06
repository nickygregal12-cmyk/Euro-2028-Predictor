/**
 * What a season route knows before it can render a card.
 *
 * A URL carries two slugs. A matchweek card needs a season id and a matchweek
 * number, and neither is derivable in the browser: `public.competitions` is
 * revoked from every browser role (contract 65) so nothing client-side can turn
 * a slug into a season, and `public.competition_rounds` is revoked too, so
 * nothing client-side can say which matchweek is open. Contract 120's
 * `get_season_play_context` answers both, and this module is the pure half of
 * consuming it: the shape the route works in, and the state machine that turns
 * a load outcome into exactly one thing to show.
 *
 * IT IS A STATE MACHINE RATHER THAN A CHAIN OF TERNARIES because the states are
 * genuinely different pages and one of them is easy to get wrong. A season past
 * its last lock has no open matchweek — that is an ordinary end-of-season state
 * and must read as one. A slug naming nothing is a mistyped URL. Collapsing
 * them into "no card" would tell a player whose season has finished that their
 * competition does not exist, and tell a player who mistyped that their season
 * is over. The database already refuses to conflate them; this keeps the
 * distinction on the way to the screen.
 */

export type SeasonPlayContext = {
  /** The season's `tournaments.id` — the argument every season RPC takes. */
  readonly tournamentId: string
  readonly competitionName: string
  /** Display form of `season_key`: `2026-27` reads as `2026/27`. */
  readonly seasonLabel: string
  readonly timeZone: string
  readonly status: string
  /** The matchweek that locks next, or null once the season has none left. */
  readonly matchweek: number | null
  readonly matchweekCount: number
  readonly locksAt: string | null
}

export type SeasonPlayContextGateway = {
  load(competitionSlug: string, seasonKey: string): Promise<SeasonPlayContext>
}

export type SeasonPlayState =
  | { readonly kind: 'loading' }
  /**
   * The season could not be resolved, or the read failed. `title` and `detail`
   * are what the page shows; the raw error is not, because a PostgREST message
   * is not addressed to a player.
   */
  | { readonly kind: 'unavailable'; readonly title: string; readonly detail: string }
  /** Resolved, but no matchweek is open — the season has played its last lock. */
  | { readonly kind: 'season_over'; readonly context: SeasonPlayContext }
  | {
      readonly kind: 'ready'
      readonly context: SeasonPlayContext
      readonly matchweek: number
    }

/**
 * `2026-27` → `2026/27`, and anything else through unchanged.
 *
 * Only the first hyphen is replaced. A season key is `<year>-<year>` and a
 * blanket replace would mangle any other shape rather than leaving it alone,
 * which is the wrong instinct for a value that comes from the database.
 */
export function seasonLabelFor(seasonKey: string): string {
  return seasonKey.replace('-', '/')
}

/**
 * The one refusal the database raises that a player can act on.
 *
 * Everything else — a network failure, a malformed payload, a missing grant —
 * is the same thing from where the player sits: the page could not load. It is
 * worth telling apart the URL that names nothing, because that one has an
 * obvious fix and the others do not.
 */
function isUnknownSeason(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return (
    message.includes('That competition season does not exist') ||
    message.includes('That competition is not a league season')
  )
}

export function presentSeasonPlay(input: {
  readonly status: 'loading' | 'ready' | 'failed'
  readonly context: SeasonPlayContext | null
  readonly error: unknown
}): SeasonPlayState {
  if (input.status === 'loading') return { kind: 'loading' }

  if (input.status === 'failed' || input.context === null) {
    if (isUnknownSeason(input.error)) {
      return {
        kind: 'unavailable',
        title: 'This competition season could not be found',
        detail:
          'The address does not match a season in the hub. Return to the hub and choose a competition from there.',
      }
    }
    return {
      kind: 'unavailable',
      title: 'This season could not be loaded',
      detail:
        'The season did not respond. Nothing you have entered is affected — try again in a moment.',
    }
  }

  if (input.context.matchweek === null) {
    return { kind: 'season_over', context: input.context }
  }

  return { kind: 'ready', context: input.context, matchweek: input.context.matchweek }
}
