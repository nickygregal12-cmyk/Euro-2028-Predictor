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
 * SO THE CONNECTED SHELL STATES ONE FOOTBALL CONTEXT AND SAYS NOTHING ELSE.
 * That is not a degraded mode: it is the ONE-COMPETITION SHAPE, which is the
 * shape the architecture is most confident about and the one the brief makes a
 * binding contract. No switcher, no shortcut group, no attention layer, no Jump
 * — because the application has not claimed there is anything to switch to,
 * anything waiting, or anything to jump past.
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
   * How many predictions are still outstanding in this competition's Match
   * Predictor, where the page happens to know. It rides on `Games`, which is
   * where the Match Predictor lives under the selected architecture.
   *
   * `null` is "this page cannot say" and is never zero.
   */
  readonly outstandingPredictions: number | null
  /**
   * Whether this host can act on a `discover` or `account` intent.
   *
   * A CONTROL THAT EXISTS AND REFUSES TEACHES A PLAYER THE PRODUCT IS BROKEN,
   * which is the same rule `PlayerReach` records for a name with no address. A
   * host with nowhere to send the player gets no Explore control rather than an
   * inert one.
   */
  readonly canNavigateAway: boolean
}
