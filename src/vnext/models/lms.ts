/**
 * THE vNEXT LAST MAN STANDING PRESENTATION CONTRACT — STAGE 11.
 *
 * ============================ WHAT THIS ANSWERS ===========================
 *
 * > **ONE CONSEQUENTIAL PICK → SURVIVE OR BE ELIMINATED.**
 *
 * Inside one football competition season, as a FIRST-CLASS GAME rather than a
 * Match Predictor reskin. Match Predictor asks for a score on every fixture and
 * rewards accuracy; this asks for ONE CLUB and takes the season away if it is
 * wrong. The two must not look alike, and the difference starts here: there is
 * no scoreline anywhere in this file.
 *
 * ============================ A CLUB WINNING IS NOT A PLAYER SURVIVING ====
 *
 * The single most important decision in this file, and it is not ours — it is
 * `src/features/season/lmsRoundModel.ts`'s, which states it in terms:
 *
 *   `pickOutcome` is what the picked club DID — won, lost, drew, or its fixture
 *   did not produce a standing result. `entryOutcome` is what the competition
 *   says the PLAYER now is — active, survived, eliminated, champion. ONLY THE
 *   SECOND IS A SURVIVAL VERDICT, AND ONLY THE SETTLEMENT JOB WRITES IT.
 *
 * So `LmsClubResult` and `LmsStanding` are DIFFERENT TYPES with no conversion
 * between them, and nothing in this lane derives one from the other. A drawn
 * fixture eliminates a player in some rules and not in others; a postponed one
 * may leave them alive with no result at all. A surface that read "won" and
 * printed "you survive" would be inventing the competition's rule — which is
 * the same class of mistake as Stage 9 computing a rank or Stage 10 deriving a
 * head-to-head record.
 *
 * ============================ AN INELIGIBLE CLUB HAS NOTHING TO PICK WITH =
 *
 * The Stage 11 predicate requires that "used/ineligible teams cannot be made
 * selectable by presentation shortcuts", and that is a type problem rather than
 * a discipline problem. `LmsPickAction` is a discriminated union whose ONLY
 * actionable case carries the team id, and **a team id appears nowhere else in
 * this file** — not on the option, not on the fixture, not on the round. A
 * component holding a used club literally has no id to submit.
 *
 * That is Stage 9's social identity rule in another costume: there, a row the
 * caller may not open has no id to open it with; here, a club the player may
 * not pick has no id to pick it with.
 *
 * ============================ THE DEADLINE IS THE SERVER'S ================
 *
 * `locksAt` is contract 116's `locks_at`, carried as the instant the server
 * stated. NOTHING IN THIS LANE COMPARES IT TO A CLOCK to decide whether the
 * round is open — `LmsRoundState` is the server's answer, and the instant is
 * carried beside it so a surface can say WHEN rather than infer WHETHER. It is
 * Stage 8's rule (never infer a live minute from `Date.now() - kickoff`)
 * applied to a deadline, and the predicate names it: "lock/deadline states come
 * from authority, not browser inference".
 *
 * ============================ WHAT IT IS NOT ==============================
 *
 * No score entry, no bracket, no invented eligibility, no client-derived lock,
 * no new scoring or progression rule, and no profile expansion. Nothing here
 * defines who survives; it carries what the settlement job decided.
 */

/* ==========================================================================
   WHERE THE PLAYER IS: competition → game → round
   ========================================================================== */

type LmsContext = {
  readonly competitionName: string
  readonly seasonLabel: string | null
  /** The game. Never merged with the competition — the Deck's rule since 7.6. */
  readonly gameName: string
}

/* ==========================================================================
   THE TWO VERDICTS, AND THEY ARE NOT ONE
   ========================================================================== */

/**
 * WHAT THE PICKED CLUB DID. A fact about a football match.
 *
 * `postponed` is not a result — the fixture produced no standing outcome — and
 * it is a real answer rather than a missing one.
 */
export type LmsClubResult = 'won' | 'lost' | 'drew' | 'postponed'

/**
 * WHAT THE COMPETITION SAYS THE PLAYER NOW IS. The only survival verdict, and
 * only the settlement job writes it.
 *
 * Never derived from `LmsClubResult`. See the header.
 */
export type LmsStanding = 'active' | 'qualified' | 'survived' | 'eliminated' | 'champion'

/* ==========================================================================
   THE PICK
   ========================================================================== */

/**
 * WHAT MAY BE DONE WITH ONE CLUB IN THE CURRENT ROUND.
 *
 * `pick` IS THE ONLY CASE CARRYING AN ID, and no team id exists anywhere else
 * in this contract. A used club, a locked round and an unentered player all
 * produce cases with nothing to submit — so a component cannot construct a pick
 * it has no permission for, because there is nothing to construct it from.
 *
 * `chosen` deliberately carries no id either: re-picking the club you already
 * hold is a press that changes nothing, and the option for every OTHER club
 * carries its own `pick`.
 */
export type LmsPickAction =
  | { readonly kind: 'pick'; readonly teamId: string }
  /** The player's current selection in this round. Marked, not re-submittable. */
  | { readonly kind: 'chosen' }
  /** Spent in an earlier round of this cycle. The server's list, not a guess. */
  | { readonly kind: 'used' }
  /**
   * Nothing may be picked at all right now, and the reason is the ROUND's
   * rather than this club's. Carried per option so a surface never has to
   * decide which sentence a row gets.
   */
  | {
      readonly kind: 'unavailable'
      readonly reason: 'locked' | 'not-open' | 'eliminated' | 'not-entered'
    }

/**
 * ONE CLUB IN THE PICK LIST.
 *
 * `key` IS A FACT ABOUT THE ROW, NOT AN ADDRESS. It is built from the fixture
 * and the side, so it is stable across renders and useless as a submission —
 * which is the point. The only address is inside `action`.
 */
export type LmsTeamOption = {
  readonly key: string
  /** Already shortened by the club-name authority. Never clipped by a surface. */
  readonly name: string
  readonly action: LmsPickAction
}

/**
 * ONE FIXTURE, AS TWO CHOICES.
 *
 * A fixture appears in this game only as the two clubs a player may pick from,
 * which is why there is no scoreline here and no prediction of any kind. The
 * result, once there is one, belongs to the PICK rather than to the fixture.
 */
export type LmsFixtureChoice = {
  readonly key: string
  /** The instant, as the server stated it. Never compared to a clock here. */
  readonly kickoffAt: string | null
  readonly home: LmsTeamOption
  readonly away: LmsTeamOption
}

/* ==========================================================================
   THE ROUND
   ========================================================================== */

/**
 * WHETHER THIS ROUND CAN BE PICKED IN, AS THE SERVER SEES IT.
 *
 * A state rather than a computed comparison. `locksAt` travels beside it so a
 * surface can print the deadline; it must never be used to decide the state.
 */
export type LmsRoundState = 'open' | 'not-open' | 'locked' | 'settled'

export type LmsRound = {
  readonly windowId: string
  readonly sequence: number
  readonly label: string
  readonly state: LmsRoundState
  /** The server's instants. Present for a surface to SAY, never to DECIDE. */
  readonly opensAt: string | null
  readonly locksAt: string | null
  readonly choices: readonly LmsFixtureChoice[]
}

/**
 * WHAT THE PLAYER'S PICK IN THIS ROUND DID.
 *
 * `result` is null until the fixture produces one, and that is not the same as
 * the player being safe — `LmsPage.standing` is the only thing that says so.
 */
export type LmsPick = {
  readonly clubName: string
  readonly result: LmsClubResult | null
}

/* ==========================================================================
   THE PAGE
   ========================================================================== */

/**
 * WHAT THE PAGE IS SHOWING, AS ONE UNION.
 *
 * `not-entered` is about the PLAYER and is an ordinary answer — this game is
 * opt-in. `no-round` is about the COMPETITION: entered, but nothing is running
 * right now, which is the state between rounds and is not a failure.
 */
export type LmsBody =
  | { readonly kind: 'round'; readonly round: LmsRound; readonly pick: LmsPick | null }
  | { readonly kind: 'no-round' }
  | { readonly kind: 'not-entered' }
  | { readonly kind: 'unavailable' }

export type LmsPageModel = {
  /** The instant the model describes, supplied rather than read. */
  readonly generatedAt: string
  readonly context: LmsContext
  /**
   * The competition's verdict on this player. Null before they have entered.
   *
   * NOT DERIVED FROM ANY RESULT ON THIS PAGE. See the header.
   */
  readonly standing: LmsStanding | null
  /**
   * Clubs spent in the current cycle, for a surface that wants to list them.
   * The same names the options carry `used` for — one authority, two readings.
   */
  readonly usedClubNames: readonly string[]
  readonly body: LmsBody
}

/* ==========================================================================
   SELECTORS — reading the model, never re-deriving it
   ========================================================================== */

/**
 * Whether this round can be picked in at all.
 *
 * ONE PREDICATE, so no component decides for itself and none reaches for a
 * clock. The whole answer is the server's `state`.
 */
export function lmsRoundIsOpen(round: LmsRound): boolean {
  return round.state === 'open'
}

/**
 * Whether the player is out of the competition.
 *
 * `eliminated` ONLY. A lost club is not an elimination — some rules give a
 * second life, a postponed fixture may resolve later, and only the settlement
 * job decides. This is the one place that question is answered.
 */
export function lmsEliminated(standing: LmsStanding | null): boolean {
  return standing === 'eliminated'
}

/** Whether the player has won the whole thing. */
export function lmsChampion(standing: LmsStanding | null): boolean {
  return standing === 'champion'
}

/**
 * The one club the player holds in this round, if any.
 *
 * Reads the OPTIONS rather than the pick, because the options are what the
 * server marked — and a surface asking "which row is mine" must get the same
 * answer as the row itself gives.
 */
export function lmsChosenOption(round: LmsRound): LmsTeamOption | null {
  for (const choice of round.choices) {
    if (choice.home.action.kind === 'chosen') return choice.home
    if (choice.away.action.kind === 'chosen') return choice.away
  }
  return null
}

/** How many clubs remain pickable in this round. Never an eligibility rule. */
export function lmsPickableCount(round: LmsRound): number {
  return round.choices.reduce(
    (total, choice) =>
      total +
      (choice.home.action.kind === 'pick' ? 1 : 0) +
      (choice.away.action.kind === 'pick' ? 1 : 0),
    0,
  )
}
