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
type LeaguesContext = {
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
  | {
      readonly kind: 'open'
      /**
       * THE ADDRESS, AND IT IS THE REF. Contract 206 made the season-scoped
       * entry reference enough to open a bounded profile, and its own comment
       * says why it is the only one that path exposes: *"player_ref is the only
       * navigation identity exposed by this path."* A row a caller may open
       * always has one.
       */
      readonly playerRef: string
      /**
       * The target's account id, WHERE THE SERVER ALSO CHOSE TO SEND ONE.
       *
       * `null` IS AN ORDINARY OPENABLE ROW AND NOT A HALF-CLOSED ONE. The older
       * shared-private-league boundary reveals an account id and the same-season
       * boundary deliberately does not, so this field says which of the two
       * doors is open rather than whether one is. A surface that tested it to
       * decide openability would be reading a permission out of an absence,
       * which is the defect `leaguePlayerIsOpen` exists to prevent.
       */
      readonly playerId: string | null
    }
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
  /**
   * THE ENTRANTS EITHER SIDE OF THE CALLER, or `null` where that read has not
   * landed. `null` is "not loaded or failed" and is NOT an empty neighbourhood.
   */
  readonly neighbourhood: LeaguesNeighbourhood | null
}

/* ==========================================================================
   THE NEIGHBOURHOOD — who is immediately above and below the caller
   ========================================================================== */

/**
 * WHY THIS EXISTS BESIDE A TABLE THAT ALREADY HAS THE CALLER'S ROW.
 *
 * The paged table answers "who is at the top" and pins the caller's own row on
 * the end, so a player learns they are 412th and can learn nothing else: the
 * players either side are eighty pages away and `LeaguesGlobalTable` has no
 * paging control on purpose. A rank with nobody next to it is a label rather
 * than a chase, and contract 183 exists to close exactly that.
 *
 * IT IS A SECOND READ AND NEVER A SECOND RANKING. Every figure here — rank,
 * points, position, the signed gap and the field size — comes from
 * `predictor_internal.season_standings` through contract 95's ordering, which
 * is the same total order the paged table is built from. pgTAP
 * `232_season_clubs_and_neighbourhood.sql` requires the two reads to agree on
 * `position`, and that guarantee is what makes the join below legitimate.
 */
export type LeaguesNeighbourRow = {
  /**
   * THE PERSON, WITH WHATEVER DOOR THE OTHER READ ALREADY OPENED.
   *
   * The neighbourhood payload predates contract 191 and carries no `playerRef`,
   * no `reach` and no `playerId`. So a neighbour is openable ONLY where the
   * loaded leaderboard page holds contract 191's identity for the same
   * server-issued `position`; everywhere else this is `closed` with reason
   * `not-stated`, which is the honest answer rather than a disabled control.
   *
   * The join is on `position` and never on `displayName`. Two entrants may
   * share a display name, and matching on one is the precise defect contract
   * 191's reference exists to make impossible.
   */
  readonly player: LeaguePlayer
  readonly rank: number
  readonly tied: boolean
  /** The server's total-order ordinal. The only key another read may join on. */
  readonly position: number
  readonly points: number
  readonly matchweeksPlayed: number
  readonly isYou: boolean
  /**
   * SIGNED, AND THE SERVER'S ARITHMETIC. Positive is ahead of the caller,
   * negative behind, zero level — or the caller's own row. Never recomputed
   * here from two points totals.
   */
  readonly pointsFromYou: number
}

export type LeaguesNeighbourhood = {
  readonly rows: readonly LeaguesNeighbourRow[]
  /** The field size, so a rank never stands alone. */
  readonly totalCount: number
  /**
   * STATED BY THE SERVER, NEVER INFERRED FROM THE ROW COUNT. A caller at rank 2
   * legitimately receives fewer rows above them than the window asked for, so
   * counting rows would draw the top of the table as missing data.
   */
  readonly atTop: boolean
  readonly atBottom: boolean
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
  /**
   * WHETHER THE READER HAS CHOSEN TO WATCH THIS PLAYER (contract 157).
   *
   * A PREFERENCE, NEVER A RELATIONSHIP. Watching is one-directional, private to
   * the watcher and invisible to the watched: nothing here tells a player who
   * is watching them, and nothing may. It changes no standing, no reveal
   * boundary and no permission — it decides which rival Home leads with.
   */
  readonly watched: boolean
  /**
   * WHETHER THIS ROW MAY BE WATCHED AT ALL, and it is the server's boundary
   * rather than a rule invented here.
   *
   * `set_pinned_rival` refuses anybody the caller shares no private league
   * with, which is contract 151's disclosure boundary. The same boundary is
   * what decides whether the row carries an account id: a row whose
   * `destination` is openable WITH an id is one the server has already agreed
   * to name, and therefore one it will accept a pin for. Anything else — a
   * closed row, or an openable row the newer same-season boundary named without
   * an id — is not offered a control that would be refused.
   *
   * Your own row is never watchable. Watching yourself is not a thing.
   */
  readonly canWatch: boolean
  /** Null unless the last matchweek settled. See `LeagueMovement`. */
  readonly movement: LeagueMovement | null
}

export type LeaguesPrivateTable = {
  readonly leagueId: string
  readonly name: string
  /**
   * NO `memberCount` HERE, AND THAT IS THE POINT.
   *
   * The league LIST carries one (`LeagueChoice.memberCount`) and contract 128
   * carries `totalCount`. They are two reads and can disagree, and a table
   * holding both is a table that will eventually print "8 members" directly
   * above "5 members" on one screen. The chooser chip states the list's count
   * because it IS the list's control; everything the table says about its own
   * size comes from `totalCount`, and there is no second field to reach for.
   */
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
  // A LEAGUE SCOPE IS ALWAYS SWITCHABLE, whatever the list said.
  //
  // The rule above is the shell's — below two choices there is no choice — and
  // it has one exception this page must make. When the league LIST fails while
  // a league's own table answers, `leagues` is empty and the chooser would not
  // be drawn at all: no "Season" control, and the reader is stranded inside a
  // league with no way back to anything. Standing in a private league IS the
  // second choice, so "Season" is a real one and not a control that spends a
  // press proving there is no decision.
  return model.leagues.length > 0 || model.scope.kind === 'private'
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
