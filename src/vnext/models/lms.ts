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
 * ============================ THE DEADLINE, AND WHAT IS ACTUALLY
 * AUTHORITATIVE ABOUT IT ===================================================
 *
 * BE PRECISE HERE, BECAUSE THE PREDICATE IS. Contract 116 returns `opens_at`
 * and `locks_at` and **no state field and no server clock** — I checked the
 * migration rather than assuming, and an earlier draft of this header claimed
 * `LmsRoundState` was "the server's answer", which was simply untrue.
 *
 * What IS the server's:
 *
 *   • the INSTANTS. `opensAt` and `locksAt` are stored values, not guesses;
 *   • WHICH round is current. `season_lms_current_window` picks the first
 *     window whose `locks_at` is still in the future, falling back to the last
 *     window when every one has locked — so a finished competition still
 *     renders its ending rather than nothing;
 *   • **THE WRITE.** `save_lms_selection` refuses a pick after the lock. That
 *     is the authority that decides whether a pick counts, and it is not this
 *     lane's to duplicate or to pre-empt.
 *
 * What is a PRESENTATION JUDGEMENT: turning those instants into `LmsRoundState`
 * requires comparing them to an instant, and `buildLmsModel` takes that instant
 * as an argument rather than reading a clock — the same shape
 * `presentLmsRound(page, now)` already uses in production.
 *
 * THAT IS NOT THE THING STAGE 8 FORBADE. Stage 8's rule bans INVENTING A VALUE
 * the server never stated — a live minute computed from `Date.now() - kickoff`.
 * Reading a stated boundary to decide which control to offer is a different
 * act: no figure is fabricated, and the server still adjudicates the write.
 *
 * The consequence this lane must therefore honour: **a pick offered near the
 * boundary can still be refused**, and that refusal is a state a surface has to
 * show rather than a failure to swallow. A clock that is slightly wrong must
 * cost a player an explanation, never a silent no-op.
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
 * WHETHER THIS ROUND CAN BE PICKED IN.
 *
 * DERIVED ONCE, IN THE MAPPER, from the server's instants against a supplied
 * instant — never in a component, and never from a clock a component read
 * itself. `locksAt` travels beside it so a surface prints the deadline from the
 * same value the state was decided by, rather than from a second reading.
 *
 * `settled` is not a time at all: it is the round having produced a result.
 */
export type LmsRoundState = 'open' | 'not-open' | 'locked' | 'settled'

export type LmsRound = {
  /** Contract 116's window id. Addresses the write; never shown. */
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
type LmsPick = {
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
  /** Entered, but nothing is running. The state between rounds; not a failure. */
  | { readonly kind: 'no-round' }
  /** The player has not joined. This game is opt-in — an ordinary answer. */
  | { readonly kind: 'not-entered' }
  /**
   * The competition season does not run Last Man Standing at all.
   *
   * Contract 116's `available: false`, and a different sentence from every
   * other case here: it is about the COMPETITION rather than the player or the
   * read. Folding it into "no round" would tell somebody the game is between
   * rounds when it was never offered.
   */
  | { readonly kind: 'not-offered' }
  /** The read did not answer. About the READ — the only case with a retry. */
  | { readonly kind: 'unavailable' }

/* ==========================================================================
   THE FIELD — how many are left, and the rules they are left under
   ========================================================================== */

/**
 * THE POOL, AS THE SERVER COUNTED IT.
 *
 * THE THREE COUNTS ARE THREE SEPARATE `count(*)`s AND MUST NEVER BE DERIVED
 * FROM EACH OTHER. Contract 164 counts `remaining` as `outcome <> 'eliminated'`
 * and `eliminated` as `outcome = 'eliminated'`, and in SQL a NULL outcome
 * satisfies NEITHER. So `remaining + eliminated` can be less than `entrants`,
 * and a surface computing any one of them from the other two would print a
 * number the database never agreed to. I read the migration to establish this
 * rather than assuming the obvious arithmetic.
 *
 * `picked` IS NULL BEFORE THE ROUND LOCKS, and null is the answer rather than a
 * missing one: how many rivals have already committed is live strategic
 * information when the clubs are a depleting resource. Never rendered as 0.
 */
type LmsFieldCounts = {
  readonly entrants: number
  readonly remaining: number
  readonly eliminated: number
  /** Withheld until the round locks. NEVER shown as zero. */
  readonly picked: number | null
}

/**
 * THE ORGANISER'S SETUP, WHERE THEY WROTE ONE.
 *
 * `drawsRule` is the field this lane most wanted and could not previously see:
 * `lmsRoundModel.ts` refuses to say whether a draw eliminates precisely because
 * "whether a draw eliminates is a stored rule this surface cannot see". Through
 * contract 164 it CAN see it — so it may STATE the rule, and still never apply
 * it. Saying "a draw counts as a loss" is reporting the organiser's setup;
 * turning a drawn pick into an elimination would be running the settlement, and
 * that remains the settlement job's alone.
 */
export type LmsRules = {
  readonly lives: number
  readonly saves: number
  /** The organiser's stored wording. STATED, never applied to an outcome. */
  readonly drawsRule: string | null
}

/**
 * WHAT THE FIELD READ ANSWERED, AS ITS OWN UNION.
 *
 * SEPARATE FROM `LmsBody` ON PURPOSE, and it is Stage 10's lesson carried
 * forward: two reads with two outcomes get two unions, so a field read that
 * fails cannot take the round — the thing a player came to act on — down with
 * it. There is no page-level "loaded" in this lane.
 *
 * `not-counted` is the field read answering that the caller is not entered or
 * the game is not offered: contract 164 returns `field: null` in both cases,
 * because entrancy is its disclosure boundary. The ROUND's own body already
 * says which, so this case carries no reason of its own.
 */
export type LmsFieldPanel =
  | {
      readonly kind: 'field'
      readonly counts: LmsFieldCounts
      /** Null when the organiser has written no setup. Absent, not zeroed. */
      readonly rules: LmsRules | null
    }
  /** Contract 164 answered, and had no field to give. Not a failure. */
  | { readonly kind: 'not-counted' }
  /** The field read did not answer. The round may still be perfectly readable. */
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
   * Clubs the player has spent that ARE PLAYING IN THIS ROUND — the same names
   * the options above carry `used` for, gathered in one place.
   *
   * **REAL BUT PARTIAL, AND THE NAME SAYS SO.** Contract 116's `used_team_ids`
   * is the caller's complete cycle list, but it is IDS ONLY, and the read
   * supplies club NAMES exclusively for clubs in this round's fixtures. A club
   * spent three rounds ago that is not playing this week therefore has no name
   * to print, and is absent from this list.
   *
   * An earlier draft called this `usedClubNames` and a surface headed it
   * "Clubs you have already used" — a completeness claim the read cannot
   * support, and one that would quietly under-report exactly the clubs a player
   * is most likely to have forgotten. Naming the bound in the field is the fix,
   * because the surface then cannot forget it.
   */
  readonly usedClubNamesInRound: readonly string[]
  readonly body: LmsBody
  /**
   * The pool this player is competing against, from contract 164.
   *
   * ITS OWN OUTCOME, INDEPENDENT OF `body`. A round that reads fine beside a
   * field that does not is an ordinary combination, and the page shows both.
   */
  readonly field: LmsFieldPanel
}

/* ==========================================================================
   SELECTORS — reading the model, never re-deriving it
   ========================================================================== */

/**
 * Whether this round can be picked in at all.
 *
 * ONE PREDICATE, so no component decides for itself and none reaches for a
 * clock. The state was settled once in the mapper; this only reads it.
 */
export function lmsRoundIsOpen(round: LmsRound): boolean {
  return round.state === 'open'
}

/** Whether the player has won the whole thing. */
export function lmsChampion(standing: LmsStanding | null): boolean {
  return standing === 'champion'
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
