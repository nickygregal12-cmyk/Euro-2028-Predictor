/**
 * vNEXT ACCOUNT / YOU — platform identity, outside the four destinations.
 *
 * ============================ WHY THIS EXISTS AT ALL =====================
 *
 * `shell.ts` declares a `kind: 'account'` intent and `VNextShell` emits it from
 * both the desktop rail and the mobile top bar — in both cases as a button
 * showing THE SIGNED-IN PLAYER'S OWN INITIALS AND NAME. Nothing has ever
 * answered it. The seven `/dev` harnesses all route it to the LEGACY
 * `/account` page, so today a player pressing their own name in a vNext surface
 * is dropped into the old visual system — which is the exact failure Stage 13's
 * predicate names ("no longer fall back accidentally to an unrelated visual
 * system"). This is the answer.
 *
 * It is NOT one of the shell's four destinations (`home | matches | games |
 * leagues`) and must not light one of them up; it renders with
 * `destination="none"`, which is consistent with the route matrix keeping
 * platform identity outside the tournament boundary.
 *
 * ============================ THREE ROUTES CONVERGE HERE =================
 *
 * The route matrix sends `/account` (settings, follows, favourite club),
 * `/profile` (platform identity and season history) and `/more` (a directory of
 * both) to one place. `/more` is ABSORBED rather than redesigned, and the
 * matrix's reason is the right one: a directory page exists because a
 * navigation ran out of slots, and this navigation has a slot for it.
 *
 * ============================ IT IS PLATFORM-SCOPED, AND STAYS THERE =====
 *
 * Three profile systems already exist — platform, tournament and season — and
 * the matrix's rule is that vNext must not add a fourth. Stage 10 built the
 * SEASON-scoped player surface. This is the PLATFORM-scoped one, deliberately
 * outside the tournament boundary, and neither may grow a copy of the other.
 * Nothing here is addressed by a competition or a season.
 */

/* ==========================================================================
   FOLLOWS — contract 157, named where a name exists
   ========================================================================== */

/**
 * WHETHER A FOLLOWED COMPETITION CAN BE NAMED, as a state rather than as a
 * nullable string.
 *
 * Contract 157 returns a follow as a `tournamentId` and nothing else — no
 * competition name, no season name, no route. Two other reads can name one:
 * contract 147's published catalogue, and contract 161's participation history.
 * Neither is guaranteed to hold it:
 *
 *   • a season the catalogue no longer publishes is absent from 147;
 *   • a competition the player follows but has never played is absent from 161.
 *
 * So a follow on an unpublished season the player never played is REAL and
 * UNNAMEABLE. `unnamed` is that state, and it is not an error — the follow
 * genuinely exists and the player genuinely chose it. Rendering an id, or a
 * guess, or silently dropping the row, are the three wrong answers.
 */
export type FollowIdentity =
  | {
      readonly kind: 'named'
      readonly competitionName: string
      readonly seasonName: string
      /**
       * Both halves of the address, or null. NEVER derived from a name — a
       * client-side invention of a server-owned identifier is the mistake the
       * season routes exist to avoid, and contract 161 states the absence
       * explicitly for a season that is no longer routable.
       */
      readonly route: { readonly competitionSlug: string; readonly seasonKey: string } | null
    }
  | { readonly kind: 'unnamed' }

/**
 * WHETHER A FAVOURITE CLUB IS SET — and deliberately NOT which one.
 *
 * Contract 157 carries `favouriteTeamId` and no name. The only read that turns
 * a team id into a team name is `fetchSeasonClubs(tournamentId)`, which is
 * scoped to ONE competition and additionally harvests a fixture window to
 * resolve club identities. Naming favourites on this page would therefore be
 * one extra round trip per followed competition, plus a fixture sweep each —
 * the N+1 Stage 9 forbade by name, for a decoration.
 *
 * So the page states the fact it has (`set`) and sends the player to the
 * competition to see or change it, which is where the clubs read already
 * happens. This is a deliberate omission with a reason, not a missing feature:
 * see `docs/product/vnext-supporting-surfaces.md`.
 */
export type FavouriteClub = { readonly kind: 'set' } | { readonly kind: 'none' }

export type FollowedCompetition = {
  /** The season row id, which is the only identifier contract 157 supplies. */
  readonly tournamentId: string
  readonly identity: FollowIdentity
  readonly favourite: FavouriteClub
}

/**
 * THE FOLLOWS PANEL, with its own outcome.
 *
 * `empty` is a REAL ANSWER and not a failure: contract 157's own decoder says
 * so — a player who follows nothing is a supported state, and it must never be
 * substituted for a read that did not answer, because "you follow nothing" and
 * "we could not find out" send a player to different screens.
 */
export type FollowsPanel =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'follows'; readonly competitions: readonly FollowedCompetition[] }

/* ==========================================================================
   SEASON HISTORY — contract 161, keyed on participation
   ========================================================================== */

/**
 * ONE FINISHED SEASON'S RESULT, as contract 156 finalised it.
 *
 * NOTHING HERE IS COMPUTED. Points, rank and field size are the stored Wrapped
 * snapshot, which is the same one the Wrapped surface reads. A second total
 * computed here would be a second scoring authority.
 */
export type SeasonResult = {
  readonly points: number
  /** Null where the snapshot holds no rank. Not a zero and not a last place. */
  readonly rank: number | null
  readonly fieldSize: number | null
  readonly matchweeksPlayed: number
}

export type PlayedSeason = {
  readonly tournamentId: string
  readonly seasonName: string
  readonly competitionName: string | null
  /**
   * The address, or null. Contract 161 supplies `competitionSlug` as null for a
   * season the catalogue no longer publishes, and says in its own header that
   * saying "archived" beats rendering a link that goes nowhere.
   */
  readonly route: { readonly competitionSlug: string; readonly seasonKey: string } | null
  /** False for a season the weekly catalogue no longer publishes. */
  readonly inPublishedCatalogue: boolean
  readonly complete: boolean
  /** Contract 156's snapshot. Null until the season is finalised. */
  readonly result: SeasonResult | null
  /** The games this player was actually in, in the server's order. */
  readonly games: readonly { readonly gameName: string; readonly outcome: string | null }[]
}

/**
 * THE HISTORY PANEL. `more` is the server's own paging fact, carried rather
 * than inferred from a count.
 */
export type HistoryPanel =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'empty' }
  | {
      readonly kind: 'seasons'
      readonly seasons: readonly PlayedSeason[]
      readonly total: number
      readonly hasMore: boolean
    }

/* ==========================================================================
   THE PAGE
   ========================================================================== */

/** Not exported: nothing outside this file names it, and `AccountPageModel`
 * carries it. An export nothing imports is a widened surface for free. */
type AccountContext = {
  /** The player's own display name, where the platform states one. */
  readonly displayName: string | null
}

/**
 * THE TWO SETTINGS `/account` ALREADY HAD AND vNEXT DEFERRED.
 *
 * The route matrix defines `/account` as "settings, follow/unfollow, favourite
 * team". Stage 13 built the surface and deliberately left two of the settings
 * proper for their own stage — an email-address change and the reminder-emails
 * preference — on the reasoning that a player can live a season without either.
 *
 * That reasoning holds for a stage boundary and NOT for a cutover. After the
 * cutover this page IS `/account`: the legacy one is gone, so a capability that
 * is not here is a capability that has been removed from the product. Both are
 * a field and a checkbox over service functions that already exist, so the
 * honest answer was to carry them rather than to bridge to a page that will not
 * be there.
 *
 * `unavailable` IS A REAL STATE. The email read is the session's own and the
 * preference is a profile read; either can fail on its own, and a settings
 * panel that silently drew a default would be showing a player a preference
 * they may not have.
 */
type AccountSettingsPanel =
  | { readonly kind: 'unavailable' }
  | {
      readonly kind: 'ready'
      /** The signed-in address. Null where the session did not state one. */
      readonly email: string | null
      /**
       * A replacement the player asked for and has not yet confirmed.
       *
       * SAID OUT LOUD WHEREVER IT EXISTS. Supabase applies the change only once
       * the link in the new address is clicked, so a page that showed only the
       * old address would look like the change had failed.
       */
      readonly pendingEmail: string | null
      readonly reminderEmails: boolean
    }

export type AccountPageModel = {
  /** The instant the model describes, supplied rather than read. */
  readonly generatedAt: string
  readonly context: AccountContext
  /** Contract 157's answer, resolving on its own. */
  readonly follows: FollowsPanel
  /** Contract 161's answer, resolving on its own. */
  readonly history: HistoryPanel
  /**
   * The session's email state and the reminder preference.
   *
   * `null` MEANS THE HOST DID NOT LOAD THEM, which is the shape a story and a
   * render test have — and is different from a panel that loaded and could not
   * answer. The surface draws nothing for `null`.
   */
  readonly settings: AccountSettingsPanel | null
}

/* ==========================================================================
   SELECTORS — reading the model, never re-deriving it
   ========================================================================== */

/**
 * THE SEASONS THAT ARE OVER, AND THOSE STILL RUNNING, KEPT APART without
 * reordering either.
 *
 * IT PARTITIONS ON `complete`, NOT ON `result`, AND THE DIFFERENCE IS A REAL
 * PLAYER'S PAGE. Contract 161 supplies the two as INDEPENDENT facts —
 * `'complete', season.status in ('complete', 'archived')` and a `final` block
 * that is null whenever `season_wrapped` holds no row, with the read's own
 * header saying "a season with no Wrapped it says so". So a finished season
 * that was never wrapped has `complete: true` and `result: null`, and an
 * earlier draft of this function filed it under "Still going" — telling a
 * player a season they finished months ago is still running, because nobody
 * had generated their Wrapped.
 *
 * The result is what a finished row PRINTS, where there is one. It is not what
 * decides the season is finished.
 *
 * Contract 161 orders its own seasons and nothing here sorts. This partitions
 * in place, so a surface can head two groups while both keep the server's
 * sequence — the same rule the bracket follows.
 */
export function partitionByCompletion(
  seasons: readonly PlayedSeason[],
): { readonly finished: readonly PlayedSeason[]; readonly ongoing: readonly PlayedSeason[] } {
  const finished: PlayedSeason[] = []
  const ongoing: PlayedSeason[] = []
  for (const season of seasons) {
    if (season.complete) finished.push(season)
    else ongoing.push(season)
  }
  return { finished, ongoing }
}

/**
 * Whether a season can be opened.
 *
 * ONE PLACE, so the rule a surface renders and the rule a test asserts cannot
 * drift — and so "no route" is never confused with "not published". A season
 * can be absent from the catalogue and still routable, and the reverse.
 */
export function seasonIsOpenable(season: PlayedSeason): boolean {
  return season.route !== null
}
