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
 *
 * ============================ AND IT IS NOT A SETTINGS PAGE ==============
 *
 * Stage 13 shipped follows, season history and sign out, and named the rest of
 * `/account`'s settings as deliberately left. A cutover cannot leave them: a
 * player must still be able to change their display name, their password and
 * their email address, control the reminder-email preference, read what other
 * players can see, and reach an administrator.
 *
 * **THAT IS A CAPABILITY LIST, NOT A LAYOUT.** The legacy page answers it with
 * four stacked forms and two cards down one column, and reproducing that here
 * would be the vNext lane becoming a reskin of the thing it exists to replace.
 * The placement instead follows this lane's own rules:
 *
 *   • the page stays an OVERVIEW — who you are, what you follow, your seasons;
 *   • the changeable things are a short list of ROWS, not four open forms.
 *     A row states what it holds now, which is most of what a player came to
 *     check, and opens a sheet only when they want to change it;
 *   • ONE SHEET, ONE JOB. Pressing "Email address" opens a sheet about the
 *     email address. Three fields in one sheet is the legacy page with a
 *     backdrop behind it;
 *   • a PREFERENCE IS A SWITCH AND NOT A FORM. Reminder emails toggles in
 *     place, because a one-tap choice that needs a sheet and a Save button is a
 *     one-tap choice made into a task;
 *   • privacy and support sit at the BOTTOM of You, where "who can see my
 *     predictions?" is actually asked, rather than in a directory somewhere.
 *
 * ============================ NOTHING IS OFFERED THAT CANNOT BE DONE =====
 *
 * The same rule as every other surface in this lane. Each editable row exists
 * only where the read behind it landed; the whole settings panel has its own
 * `unavailable` case, separate from follows and from history, because it is its
 * own read. Contact admin renders as a real link where the deployment
 * configured an address and as a stated absence where it did not — never as a
 * button that does nothing.
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
   SETTINGS — the platform identity a player can change
   ========================================================================== */

/**
 * THE PLAYER'S EMAIL ADDRESS, AND THE ONE THEY ARE MOVING TO.
 *
 * A change of address is not immediate: the auth authority holds the new one as
 * PENDING until it is confirmed from the inbox, and both addresses are real
 * during that window. A surface showing only one of them either tells the
 * player their change did not happen or tells them it has when it has not.
 *
 * `unknown` is the session read not landing. It is not an empty address.
 */
/* Not exported: `AccountSettingsPanel` carries it and nothing outside this file
 * names it. An export nothing imports is a widened surface for free — the same
 * reason `AccountContext` is not one. */
type AccountEmail =
  | {
      readonly kind: 'known'
      readonly address: string
      /** The address awaiting confirmation, where one is. Never the current one. */
      readonly pending: string | null
    }
  | { readonly kind: 'unknown' }

/**
 * THE CONSTRAINTS THE PAGE MAY STATE BEFORE THE SERVER REFUSES.
 *
 * Only the ones that are NUMBERS. The display-name moderation policy is a list
 * of banned names mirrored by a database trigger, and it lives in one place on
 * purpose — a copy here would be a second list to keep in step, and it would be
 * the one that went stale. So the page states the length and the minimum, and
 * every other refusal arrives as the write's own message.
 *
 * They arrive as data rather than as an import because this file is the
 * presentation model and the policy lives in `src/features/`, which no
 * presentation module may reach.
 */
export type AccountRules = {
  readonly displayNameMaxLength: number
  readonly passwordMinLength: number
}

/**
 * WHAT A PLAYER MAY CHANGE ABOUT THEMSELVES.
 *
 * ITS OWN READ AND THEREFORE ITS OWN OUTCOME. Follows, history and this are
 * three reads that do not succeed or fail together, and a page with one
 * "loaded" would blank two panels because a third did not answer.
 *
 * `reminderEmails` IS THE STORED PREFERENCE AND NOT A DEFAULT. There is no
 * `false` here standing in for "we did not ask" — the whole panel is
 * `unavailable` in that case, so a switch is never drawn in a position the
 * player did not put it in.
 */
export type AccountSettingsPanel =
  | {
      readonly kind: 'ready'
      readonly email: AccountEmail
      readonly reminderEmails: boolean
      readonly rules: AccountRules
    }
  | { readonly kind: 'unavailable' }

/**
 * HOW TO REACH AN ADMINISTRATOR, WHERE THE DEPLOYMENT CONFIGURED ONE.
 *
 * `unconfigured` is a real state and is stated rather than hidden: a player who
 * cannot find a way to ask for help should be told there isn't one here, not
 * left hunting. It is never a control that does nothing — the same rule
 * `PlayerReach` records for a name with no address.
 */
export type AccountSupport =
  | { readonly kind: 'available'; readonly href: string }
  | { readonly kind: 'unconfigured' }

/* ==========================================================================
   THE PAGE
   ========================================================================== */

/** Not exported: nothing outside this file names it, and `AccountPageModel`
 * carries it. An export nothing imports is a widened surface for free. */
type AccountContext = {
  /** The player's own display name, where the platform states one. */
  readonly displayName: string | null
}

export type AccountPageModel = {
  /** The instant the model describes, supplied rather than read. */
  readonly generatedAt: string
  readonly context: AccountContext
  /** Contract 157's answer, resolving on its own. */
  readonly follows: FollowsPanel
  /** Contract 161's answer, resolving on its own. */
  readonly history: HistoryPanel
  /** The profile and session reads, resolving on their own. */
  readonly settings: AccountSettingsPanel
  /** The deployment's configured administrator address, or its absence. */
  readonly support: AccountSupport
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
