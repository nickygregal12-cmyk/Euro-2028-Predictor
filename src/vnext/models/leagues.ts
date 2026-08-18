/**
 * THE vNEXT LEAGUES PRESENTATION CONTRACT — STAGE 9.
 *
 * ============================ WHAT THIS ANSWERS ===========================
 *
 * > **WHO AM I COMPETING AGAINST HERE, AND WHERE DO I STAND?**
 *
 * Inside the active football competition, and inside one of its games. Leagues
 * is the PEOPLE layer of the Competition Deck: the third dimension the shell
 * has kept apart from football context and from game since Stage 7.6, and this
 * is where it finally has a surface.
 *
 * ============================ TWO TABLES, AND THEY ARE NOT ONE ============
 *
 * The single most important decision in this file, and it is not ours — it is
 * ADR 0011's and contract 128's, and `seasonLeagueStandingsModel.ts` states the
 * reasoning in terms:
 *
 *   the totals come from `season_standings` so a league cannot disagree with
 *   the season, but the RANK is recomputed inside the league. Two rows carrying
 *   the same `points` therefore carry different ranks in the two payloads, and
 *   a shared parser would invite a shared presenter, which is how a
 *   competition-wide ranking gets asserted by accident.
 *
 * So `LeaguesGlobalTable` and `LeaguesPrivateTable` are DIFFERENT TYPES with
 * different row shapes. Not one table with a `kind` on it, and not one row type
 * with half its fields nullable. A component that draws one cannot silently
 * draw the other, which is the only way to keep the accident from happening.
 *
 * ============================ RANK IS NEVER COMPUTED HERE =================
 *
 * Not sorted, not renumbered, not derived from points, not inferred from array
 * position. `rank` and `position` are two different server-supplied numbers and
 * both are carried: `rank` is the standing (two players can share one), and
 * `position` is where the row sits in the page it came from. Renumbering from
 * the array would look identical today and disagree silently the first time a
 * tie or a stored tie-break changed — which is contract 160's own warning about
 * the football table, and it applies to people just as exactly.
 *
 * ============================ IDENTITY IS THE SERVER'S ANSWER =============
 *
 * Contract 191. A row is addressable because the SERVER said the caller may
 * address it, never because the browser found a display name it liked.
 * `seasonLeaderboardModel.ts` states the rule this file is built to honour:
 *
 *   matching players by display name is the defect the reference exists to make
 *   impossible, and inferring `reach` from the presence of `playerId` would put
 *   a permission rule in the browser.
 *
 * So `LeaguePlayer.destination` is a discriminated union with exactly one
 * addressable case, and that case REQUIRES the id. A row the caller may not
 * open has no id to open it with — not a disabled link, not a link that
 * refuses: no destination at all.
 *
 * ============================ WHAT IT IS NOT ==============================
 *
 * IT IS NOT A PROFILE, AND NOT A SOCIAL NETWORK. Stage 10 owns what a player
 * looks like once opened; Stage 9 owns the doorway and whether it exists. There
 * is no follower, no friend, no directory, no search and no cross-competition
 * identity in this file, and there is no rank-over-time series — that is
 * contract 192 and Stage 10's.
 *
 * IT IS NOT A RULE AUTHORITY. Nothing here defines a rank, a points total, a
 * membership, an eligibility or a permission.
 */

/* ==========================================================================
   WHERE THE PLAYER IS: competition → game → people
   ========================================================================== */

/**
 * THE THREE DIMENSIONS, NAMED ON THE SURFACE THAT NEEDS THEM MOST.
 *
 * A standings table is the easiest place in the product to lose track of what
 * is being ranked. "Sunday Club" alone could be any of three games in any of
 * twenty competitions, which is exactly why `ShellLeague` has carried its game
 * since Stage 7.6 — the same discipline, one layer down.
 */
export type LeaguesContext = {
  readonly competitionName: string
  readonly seasonLabel: string | null
  /** The game these standings rank. Never merged with the competition. */
  readonly gameName: string
}

/* ==========================================================================
   PEOPLE
   ========================================================================== */

/**
 * WHERE A PLAYER ROW MAY SEND THE READER, AS A UNION WITH ONE OPEN DOOR.
 *
 * `open` is the ONLY case carrying an id, so a surface cannot construct a
 * destination it has no permission for: there is nothing to construct it from.
 * `you` is the caller, who is always reachable in the sense that matters and is
 * drawn differently rather than linked. `closed` is a real, ordinary answer —
 * a same-season entrant the caller shares no private league with — and it is
 * NOT an error and NOT a disabled control.
 *
 * `reason` exists so a surface can be honest without inventing a sentence, and
 * it is the SERVER's classification rather than a guess.
 */
export type LeaguePlayerDestination =
  | { readonly kind: 'you' }
  | { readonly kind: 'open'; readonly playerId: string }
  | { readonly kind: 'closed'; readonly reason: 'not-shared' | 'not-stated' }

/**
 * ONE PERSON IN A TABLE.
 *
 * `ref` IS THE IDENTITY AND `displayName` IS ONLY A LABEL. Two players may
 * legitimately share a display name, and when they do the reference is the only
 * thing that tells them apart — which is why it is carried on every row even
 * where nothing can be opened. A surface keying React children by display name,
 * or comparing two rows by it, has reintroduced the defect contract 191 exists
 * to remove.
 */
export type LeaguePlayer = {
  /** Season-scoped, server-issued. `null` only below contract 191. */
  readonly ref: string | null
  readonly displayName: string
  readonly destination: LeaguePlayerDestination
}

/* ==========================================================================
   THE GLOBAL TABLE — the whole competition season
   ========================================================================== */

export type LeaguesGlobalRow = {
  readonly player: LeaguePlayer
  /** The server's standing. Two rows may share one — see `tied`. */
  readonly rank: number
  /** True where this rank is shared. The server decides, not a comparison here. */
  readonly tied: boolean
  /** Where the row sits in the page it came from. NEVER a rank. */
  readonly position: number
  readonly points: number
  /**
   * ADR 0012 pairs this with points and the decoder refuses to default it,
   * because "two players on 84 points from 22 and 23 matchweeks are not tied in
   * meaning". A surface that draws points without it is drawing half a fact.
   */
  readonly matchweeksPlayed: number
  readonly isYou: boolean
}

export type LeaguesGlobalTable = {
  readonly rows: readonly LeaguesGlobalRow[]
  readonly totalCount: number
  /** The caller's own row, wherever they actually stand. */
  readonly you: LeaguesGlobalRow | null
  /** True where the server has more to give. Never derived from a count. */
  readonly hasMore: boolean
}

/* ==========================================================================
   A PRIVATE LEAGUE — its own table, with its own rank
   ========================================================================== */

/**
 * HOW A PRIVATE LEAGUE'S TABLE MOVED OVER ONE SETTLED MATCHWEEK.
 *
 * Contract 150, and it exists only for a SETTLED matchweek: an unsettled one
 * answers `settled: false` with no rows, which is an answer and not a failure.
 * `LeaguesPrivateTable.movement` is therefore `null` far more often than it is
 * present, and that is the normal state rather than a degraded one.
 *
 * POSITIVE MEANS CLIMBED, and the sign is the server's — `rankBefore -
 * rankAfter`, stated rather than recomputed here.
 */
export type LeagueMovement = {
  /** "Matchweek 12" — the settled matchweek this movement is over. */
  readonly matchweekLabel: string
  /** Positive is a climb, negative a fall, zero a hold. */
  readonly places: number
}

export type LeaguesPrivateRow = {
  readonly player: LeaguePlayer
  /** RECOMPUTED WITHIN THE LEAGUE by the server. Never the season's rank. */
  readonly rank: number
  readonly tied: boolean
  readonly position: number
  readonly points: number
  readonly matchweeksPlayed: number
  readonly isYou: boolean
  /** The league's owner, so a surface can say so without a second read. */
  readonly isOwner: boolean
  /**
   * FALSE FOR A MEMBER WHO JOINED THE LEAGUE AND NEVER ENTERED THE GAME.
   *
   * The read includes them deliberately — "the alternative hides a league from
   * the person who created it" — and a row drawing them on zero points beside
   * players who have actually played would be a lie of omission. A surface must
   * mark them rather than rank them silently.
   */
  readonly hasEntry: boolean
  /** Null unless the last matchweek settled. See `LeagueMovement`. */
  readonly movement: LeagueMovement | null
}

export type LeaguesPrivateTable = {
  readonly leagueId: string
  readonly name: string
  readonly memberCount: number
  readonly rows: readonly LeaguesPrivateRow[]
  readonly totalCount: number
  readonly you: LeaguesPrivateRow | null
  readonly hasMore: boolean
  /**
   * Whether movement was ASKED FOR AND ANSWERED. `null` movement on every row
   * with `movementSettled: false` means "nothing has settled yet"; with `true`
   * it means that player did not move.
   */
  readonly movementSettled: boolean
}

/* ==========================================================================
   THE LEAGUE CHOOSER
   ========================================================================== */

/** One league the player can switch to. The list, not the table. */
export type LeagueChoice = {
  readonly id: string
  readonly name: string
  readonly memberCount: number
}

/**
 * WHICH TABLE THE PAGE IS SHOWING.
 *
 * `global` is the whole competition season; `private` is one league the player
 * belongs to. They are a CHOICE rather than a filter, because they are two
 * different tables with two different rank authorities — see the header.
 */
export type LeaguesScope =
  | { readonly kind: 'global' }
  | { readonly kind: 'private'; readonly leagueId: string }

export type LeaguesModel = {
  /** The instant the model describes, supplied rather than read. */
  readonly generatedAt: string
  readonly context: LeaguesContext
  readonly scope: LeaguesScope
  /** Every private league the caller may see. Empty is an ordinary state. */
  readonly leagues: readonly LeagueChoice[]
  /**
   * WHETHER THE LEAGUE LIST ANSWERED AT ALL.
   *
   * `leagues: []` HAS TWO MEANINGS AND THEY ARE NOT THE SAME SENTENCE: the
   * player is in no private league, or the read did not answer. Without this
   * flag a surface saying "you are not in a private league yet" would be
   * turning a failed read into a fact about the reader, which is the one thing
   * §9 of `docs/product/vnext-leagues.md` forbids everywhere else in this lane.
   *
   * `unavailable` reports the same failure in words, but it is a list of
   * SENTENCES for a reader — matching against its contents to make a decision
   * would make a display string load-bearing.
   */
  readonly leaguesKnown: boolean
  /** Present exactly when `scope.kind === 'global'`. */
  readonly global: LeaguesGlobalTable | null
  /** Present exactly when `scope.kind === 'private'`. */
  readonly private: LeaguesPrivateTable | null
  /**
   * Enrichments the application could not answer, named so the surface can be
   * honest instead of silently drawing less. Never an error.
   */
  readonly unavailable: readonly string[]
}

/* ==========================================================================
   SELECTORS — reading the model, never re-deriving it
   ========================================================================== */

/**
 * Whether a row can be opened at all.
 *
 * ONE FUNCTION, SO NO COMPONENT DECIDES FOR ITSELF. The whole permission story
 * is `destination.kind === 'open'`, and a surface that tested `playerId !== null`
 * instead would be inferring a permission from the presence of an id — which is
 * precisely what contract 191's decoder refuses to do one layer down.
 */
export function leaguePlayerIsOpen(player: LeaguePlayer): boolean {
  return player.destination.kind === 'open'
}

/**
 * A STABLE KEY FOR A ROW, WHICH IS NEVER THE DISPLAY NAME.
 *
 * Two players may share a display name; the reference tells them apart. Below
 * contract 191 there is no reference, and the fallback is the row's POSITION —
 * a fact about this page rather than a claim about a person.
 */
export function leagueRowKey(player: LeaguePlayer, position: number): string {
  return player.ref ?? `position:${position}`
}

/**
 * Whether the page has anything to switch between.
 *
 * The same rule the shell applies to its competition switcher: below two
 * choices there is no choice, and a control offering one teaches a player there
 * is a decision and then spends their press proving there is not. Global always
 * counts as one, so a player with a single private league has two.
 */
export function leaguesSwitchable(model: LeaguesModel): boolean {
  return model.leagues.length > 0
}

/**
 * Whether the page may say the reader is in no private league.
 *
 * ONLY WHERE THE LIST ANSWERED. An unread list is empty and means nothing, and
 * a page that spoke from it would tell a player something about themselves that
 * only a read could have established.
 */
export function leaguesKnownEmpty(model: LeaguesModel): boolean {
  return model.leaguesKnown && model.leagues.length === 0
}

/** The league currently being shown, when one is. */
export function selectedLeague(model: LeaguesModel): LeagueChoice | null {
  if (model.scope.kind !== 'private') return null
  const id = model.scope.leagueId
  return model.leagues.find((league) => league.id === id) ?? null
}

/**
 * HOW A MOVEMENT SHOULD READ, IN WORDS.
 *
 * Colour and an arrow are not enough on their own — §31's rule about state
 * never being carried by colour alone applies to a rank change exactly as it
 * applies to a live match — so the words exist and every surface uses these.
 */
export function movementLabel(movement: LeagueMovement): string {
  if (movement.places > 0) {
    return `up ${movement.places} ${movement.places === 1 ? 'place' : 'places'}`
  }
  if (movement.places < 0) {
    const places = Math.abs(movement.places)
    return `down ${places} ${places === 1 ? 'place' : 'places'}`
  }
  return 'no change'
}
