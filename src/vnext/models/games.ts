/**
 * vNEXT GAMES — the one surface where the games are PEERS.
 *
 * ============================ WHY IT IS ONE OF THE FOUR =================
 *
 * Stage 7.6 resolved `games` as a permanent destination, and the route matrix
 * gives the reason: it is the only surface where Match Predictor, Last Man
 * Standing and the Predictor Championship stand beside each other. That is the
 * thing that stopped Last Man Standing being under-scoped a second time, and it
 * is the thing this model must not undo by treating one game as the default and
 * the others as extras.
 *
 * ============================ WHAT THE READ CANNOT SAY ==================
 *
 * `get_competition_games` carries `allow_rejoin`, and `allow_rejoin` IS NOT THE
 * REJOIN RULE. Contract 126 changed it and said so in its own header: the flag
 * "bites when the competition is running, and not before", because ADR 0013
 * fixes the field at the first round's lock and a player who left before that
 * "is in precisely the position of one who never joined". The installed
 * function agrees:
 *
 *     if v_membership.status = 'disqualified' then
 *       raise exception 'A disqualified game entry cannot be rejoined'
 *     ...
 *     if not v_definition.allow_rejoin
 *        and predictor_internal.competition_is_running(v_availability.id)
 *     then
 *       raise exception 'This game cannot be rejoined once it has started'
 *
 * `competition_is_running` is `revoke`d from `authenticated`, so NO BROWSER CAN
 * LEARN IT. A hub that rendered "Rejoin" from `allow_rejoin` alone would be
 * guessing at a fact the server deliberately withholds, and would be wrong for
 * exactly the player who left a game that has since started.
 *
 * So `RejoinOutlook` has an `only-before-it-starts` case. It is not a hedge: it
 * is the shape of what is knowable here.
 */

/** The catalogue's own keys. Never inferred from a display name. */
export type GameKey =
  | 'main_predictor'
  | 'last_man_standing'
  | 'predictor_cup'
  | 'original_predictor'
  | 'ko_predictor'

/**
 * WHERE REGISTRATION STANDS for a player who is not in the game.
 *
 * The four cases and their ORDER are `lmsRegistrationModel.ts`'s, not this
 * lane's: finished outranks everything, and "not open" is kept apart from
 * "closed" because they ask opposite things of a player — come back, versus do
 * not wait. That module is the authority for the rule and this is a vocabulary
 * that mirrors it, so the two cannot drift into disagreeing about one rule.
 */
export type RegistrationOutlook = 'finished' | 'not-open' | 'closed' | 'open'

/**
 * WHETHER A PLAYER WHO LEFT MAY COME BACK.
 *
 * `allowed` is the determinate case: the game permits rejoining whatever has
 * happened. `only-before-it-starts` is the honest one — the game refuses a
 * rejoin once the competition is RUNNING, and running-ness is not readable
 * from any browser. The hub states the rule and does not predict the answer.
 */
export type RejoinOutlook = 'allowed' | 'only-before-it-starts'

/**
 * THE PLAYER'S RELATIONSHIP TO ONE GAME.
 *
 * Four cases, from `membership.status`, whose permitted values the catalogue's
 * own check constraint fixes at `active | left | disqualified` — plus the
 * absence of a membership row, which is a fifth thing and not a status.
 */
export type GameStanding =
  | { readonly kind: 'playing' }
  | { readonly kind: 'left'; readonly rejoin: RejoinOutlook }
  /** Absolute. The server refuses a rejoin whatever the game allows. */
  | { readonly kind: 'disqualified' }
  | { readonly kind: 'never-joined'; readonly registration: RegistrationOutlook }

export type GameEntry = {
  /** `game_competition_id` — what every join and leave is addressed by. */
  readonly id: string
  readonly gameKey: GameKey
  /**
   * The catalogue's own name, or null. NEVER derived from the key: a key is an
   * identifier and turning `predictor_cup` into "Predictor Cup" would be this
   * lane naming a game the catalogue already names.
   */
  readonly displayName: string | null
  /** The catalogue's own flag. A game switched off is not a game missing. */
  readonly active: boolean
  readonly standing: GameStanding
}

/**
 * THE GAMES PANEL.
 *
 * `not-a-member` is the competition's answer about the CALLER, not about the
 * games: `get_competition_games` returns `competition_member` separately, and a
 * player who is not in the competition is told that rather than shown an empty
 * catalogue.
 */
export type GamesPanel =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'not-a-member' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'games'; readonly entries: readonly GameEntry[] }

export type GamesContext = {
  readonly competitionName: string
  readonly seasonLabel: string
}

export type GamesPageModel = {
  /** The instant the model describes — the SERVER's, where the read supplied one. */
  readonly generatedAt: string
  readonly context: GamesContext
  readonly games: GamesPanel
}

/* ==========================================================================
   SELECTORS
   ========================================================================== */

/**
 * The games this player is IN, and the rest, KEPT APART without reordering
 * either.
 *
 * The read orders its own games and nothing here sorts. This partitions in
 * place so a surface can head two groups while both keep the catalogue's
 * sequence — and so no game is promoted above its peers, which is the whole
 * reason this surface exists.
 */
export function partitionByPlaying(
  entries: readonly GameEntry[],
): { readonly playing: readonly GameEntry[]; readonly rest: readonly GameEntry[] } {
  const playing: GameEntry[] = []
  const rest: GameEntry[] = []
  for (const entry of entries) {
    if (entry.standing.kind === 'playing') playing.push(entry)
    else rest.push(entry)
  }
  return { playing, rest }
}

/**
 * Whether the hub may offer a way IN.
 *
 * ONE PLACE, so the rule the surface renders and the rule a test asserts cannot
 * drift. The hub offers entry only where the answer is determinate: an open
 * registration for a player who never joined. It never offers a rejoin, because
 * it cannot know whether one would be refused — see the model header.
 */
export function offersEntry(entry: GameEntry): boolean {
  return entry.standing.kind === 'never-joined' && entry.standing.registration === 'open'
}
