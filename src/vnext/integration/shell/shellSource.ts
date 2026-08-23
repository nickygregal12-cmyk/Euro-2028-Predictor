import type { PlayInbox } from '../../../features/hub/playInboxModel'

/**
 * WHAT THE REAL APPLICATION CAN HONESTLY TELL THE SHELL TODAY.
 *
 * ======================== THE INTEGRATION GAP, STATED ======================
 *
 * The selected architecture can express a player with twenty competitions, work
 * waiting in three of them and a private league in each. The application cannot
 * currently ANSWER most of that from where a connected vNext page stands:
 *
 *   `get_season_play_context` answers ONE competition season — the one the page
 *   is about. It is the read both connected vNext pages are addressed by.
 *
 *   The player's whole competition list DOES exist — `features/hub/
 *   playerCompetitions.ts` over contract 147's catalogue, contract 157's
 *   preferences and `get_competition_games` — but nothing under `integration/`
 *   acquires it, and §9 and §26 of the Stage 7.6 brief forbid adding a read.
 *
 *   A cross-competition attention summary exists NOWHERE. `playInboxModel`
 *   answers something close for the legacy `/play` surface; whether that is the
 *   right shape for this contract is a Stage 8+ question.
 *
 * ======================== AND WHAT STAGE 14 CLOSED ========================
 *
 * The last two paragraphs were the answer for Stages 8 to 13 and they are no
 * longer the whole answer.
 *
 * The route matrix ABSORBS `/play`, and `/play` exists because *"a player
 * should never have to choose a competition merely to discover what needs
 * doing"*. vNext Home is competition-scoped, so a cutover that shipped an empty
 * attention layer would ship that loss with a citation for it. `elsewhere`
 * below is the answer, and it needed NO new capability: `useGlobalPlayInbox`
 * builds the cross-competition inbox in production today, from each
 * competition's own week, and `features/hub/playerCompetitions.ts` holds the
 * player's list with the tournament id beside each competition.
 *
 * **IT IS OPTIONAL, AND `null` IS STILL A REAL ANSWER.** A host that does not
 * load the inbox passes `null` and gets exactly the one-competition shape this
 * file has always described — no switcher, no shortcut group, no attention
 * layer, no Jump. That is what a page-scoped host should pass, because the
 * inbox costs one play-context read plus up to three game reads PER
 * COMPETITION, and a host that mounted it per page would pay that on every
 * navigation. It belongs to a shell-level host, mounted once.
 *
 * ======================== AND WHAT IS STILL DEFERRED, ON PURPOSE ==========
 *
 * **`games` AND `leagues` ON A CONTEXT STAY EMPTY, AND THAT IS THE DECISION.**
 * They are the input to Jump and to the shortcut group, which the shell only
 * draws when a context carries them — so an empty list draws nothing rather
 * than drawing something inert. Filling them honestly would mean a games read
 * and a private-league read PER COMPETITION, on top of the inbox's own
 * per-competition cost, and Stage 14's contract asks for a safe cutover rather
 * than a wider one. Jump is an OPTIONAL accelerator in the selected
 * architecture (`docs/product/vnext-shell-ia.md`), not part of its minimum, so
 * deferring it removes no journey: every game and every league is still one
 * press away through the destination that owns it.
 *
 * NOTHING HERE IS FABRICATED TO MAKE AN AFFORDANCE LIGHT UP. A second context
 * invented from the catalogue, or an attention item derived from a deadline in
 * the page's own model, would both be presentation asserting something the
 * application never said. The deterministic worlds in `fixtures/shell/` are
 * where the rest of the architecture is proven, and they say so.
 */

/** The competition season the connected page is about. */
export type ShellSourceCompetition = {
  /** The season row id every season read is addressed by. */
  readonly tournamentId: string
  readonly name: string
  readonly seasonLabel: string
  /**
   * The competition's palette, as the page's own model resolved it. No
   * application read holds one, so this is the presentation lane's own value
   * arriving by the only honest route: from the model that already chose it.
   */
  readonly colours: { readonly primary: string; readonly accent: string } | null
}

/**
 * One competition the player is relevant to, as `PlayerCompetitions` states it.
 *
 * `tournamentId` IS THE IDENTITY AND `name` IS A LABEL. It is the same
 * discipline `LeaguePlayer` records for a person: two seasons of one
 * competition share a display name, and a shell that keyed a context on the
 * name would switch the player to the wrong one.
 */
type ShellSourceOtherCompetition = {
  readonly tournamentId: string
  readonly name: string
  readonly seasonLabel: string
}

/**
 * WHAT IS WAITING IN THE PLAYER'S OTHER COMPETITIONS.
 *
 * The two halves arrive together because neither is usable alone: the inbox
 * says what needs doing and names the competition by id, and `competitions`
 * is what turns that id into a context the shell can draw and switch to.
 * `attentionElsewhere` drops any item naming a competition the shell holds no
 * context for, so an inbox without its competition list renders nothing.
 */
export type ShellSourceElsewhere = {
  /** Every competition the player is relevant to, the player's own list. */
  readonly competitions: readonly ShellSourceOtherCompetition[]
  /**
   * The cross-competition action inbox, or `null` where it has not landed yet.
   * `null` is "still loading or failed", and it is not an empty inbox — an
   * empty one means "nothing is waiting", which is a claim.
   */
  readonly inbox: PlayInbox | null
}

export type ShellSource = {
  /**
   * The competition season the page is about, or `null` for a page that is not
   * inside one.
   *
   * `null` IS A REAL ANSWER AND NOT A MISSING VALUE. The route matrix keeps
   * platform identity deliberately outside the tournament boundary, so Account
   * is not in a competition and must not be given one — and `VNextShellModel`
   * has always been able to say so: `activeContextId` is nullable, documented
   * as "a REAL state ... the shell must answer it without inventing a
   * competition to be inside". Only this source type could not express it.
   *
   * A page passing `null` gets the shell's cross-competition chrome and no
   * competition mark. It does NOT get a fabricated context — inventing one to
   * make the switcher light up is the thing this module's header forbids.
   */
  readonly competition: ShellSourceCompetition | null
  /**
   * The signed-in player's display name, as the auth authority states it.
   * `null` where the profile read has no name — never a placeholder.
   */
  readonly playerName: string | null
  /**
   * HOW MANY OF THIS COMPETITION'S GAMES ARE ASKING THE PLAYER FOR SOMETHING.
   *
   * A COUNT OF GAMES, NOT OF FIXTURES — and the change of unit is the whole
   * point. This used to carry the number of scorelines still missing from the
   * Match Predictor card, which rode on a destination named `Games` and so read
   * as a count of games. Seven missing predictions in one game rendered as "7"
   * beside the word `Games`, which is a sentence the product never meant.
   *
   * THE THREE STATES ARE NOT COMMENSURABLE, WHICH IS WHY IT COUNTS GAMES.
   * "two fixtures left", "no pick made yet" and "a fixture riding on points you
   * are already earning" cannot be added up — `ShellGameSummary` is three
   * non-interchangeable variants precisely to prevent that. What CAN be counted
   * is how many games are asking, and 0, 1 or 2 is a number a player can act on.
   *
   * IT COMES FROM THE SAME AUTHORITY HOME USES, so the badge and Home's own
   * action list cannot disagree. The Championship is never counted, because
   * `championshipAction` is never `outstanding` — it is won by points the
   * player is already being told to earn, and counting it would count one task
   * twice.
   *
   * `null` IS "THIS PAGE CANNOT SAY", AND NEVER ZERO. Only the surfaces that
   * hold the week — Home and Games — can answer; every other page passes null
   * and the badge is absent rather than confidently empty. Making it universal
   * would mean the shell itself reading each game on every navigation, which is
   * a cost the shell deliberately does not pay.
   */
  readonly outstandingGames: number | null
  /**
   * Whether this host can act on a `discover` or `account` intent.
   *
   * A CONTROL THAT EXISTS AND REFUSES TEACHES A PLAYER THE PRODUCT IS BROKEN,
   * which is the same rule `PlayerReach` records for a name with no address. A
   * host with nowhere to send the player gets no Explore control rather than an
   * inert one.
   */
  readonly canNavigateAway: boolean
  /**
   * The player's OTHER competitions and what is waiting in them.
   *
   * `null` is the one-competition shape and is what a page-scoped host passes:
   * the shell then states one football context and says nothing else, exactly
   * as it did from Stage 8 to Stage 13. See this file's header for why that is
   * a cost decision rather than a capability gap.
   */
  readonly elsewhere: ShellSourceElsewhere | null
}
