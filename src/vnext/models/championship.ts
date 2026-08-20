/**
 * THE vNEXT PREDICTOR CHAMPIONSHIP PRESENTATION CONTRACT — STAGE 12.
 *
 * ============================ WHAT THIS ANSWERS ===========================
 *
 * > **Where am I in this Championship, what must I do next, and how can I win
 * > it?**
 *
 * Three questions, not one, and they have different answers in different
 * phases. That is why this file is a set of independent panels rather than one
 * page-shaped object.
 *
 * ============================ THE RULE THIS STAGE LIVES OR DIES BY =======
 *
 * The Stage 12 predicate requires that a launched Championship
 *
 *   > "can be understood from its canonical player-facing read WITHOUT
 *   >  RECONSTRUCTING ITS BRACKET IN REACT."
 *
 * It is the strongest anti-derivation clause in any stage contract so far, and
 * it is enforceable because contract 193 returns the bracket AS DATA: every
 * seat carries its own `window_sequence`, `bracket_slot` and `round_size`, and
 * the server orders them. `get_season_cup_bracket`'s own migration asserts
 * against its installed text that no bracket arithmetic is present:
 *
 *     if v_read ~ 'cup_bracket_order|log\(|power\(|ceil\(' then raise ...
 *
 * So nothing in this lane pairs opponents, counts rounds, computes a seat
 * position, or infers who plays next. A seat is a row.
 *
 * ============================ THREE VOCABULARIES, THREE TYPES ============
 *
 * Stage 11's `LmsClubResult` vs `LmsStanding` lesson, three times over. These
 * live in different tables, are written by different authorities and answer
 * different questions, and NOTHING HERE CONVERTS BETWEEN THEM:
 *
 *   • `TieDecision`   — `bonus_cup_fixtures.decided_by`. How a TIE was decided.
 *   • eligibility     — `game_memberships.status`. Whether a PERSON may play.
 *                       **Not in this read at all** (see below).
 *   • entrant outcome — `bonus_competition_entrants.outcome`. What the
 *                       COMPETITION says a player is. **Not in this read
 *                       either**, and not derived here (see below).
 *
 * ============================ A WALKOVER CANNOT BE ATTRIBUTED ============
 *
 * `decided_by` distinguishes `walkover` from `admin_walkover`, and that is the
 * whole of what the read supplies. WHY the opponent was not there —
 * withdrawal or disqualification — is `game_memberships.status`, which
 * contract 193 never returns. So this contract has NOWHERE TO PUT a reason,
 * deliberately: a surface holding a walkover has no field to guess into.
 *
 * ============================ AND NO SCORE, EVER, ON A WALKOVER ==========
 *
 * `TieOutcome`'s deterministic case carries no numbers at all. Contract 194
 * writes an audit row asserting `'invented_score', false, 'invented_points',
 * false`; this type makes the same promise structurally rather than by
 * discipline.
 *
 * ============================ ELIMINATION IS NOW STATED (CONTRACT 207) ====
 *
 * The predicate asks for eliminated/champion/no-action-required states to be
 * complete. For four stages `champion` was present and **`eliminated` was
 * returned by NO season Championship read** — not by contract 193, 133, 167 or
 * 120 — so this surface said nothing at all about survival and the gap was
 * carried as a backend debt rather than reinterpreted as completeness.
 *
 * **Contract 208 closed it.** `get_season_cup_bracket` now returns
 * `your_outcome`: `bonus_competition_entrants.outcome`, verbatim, for the
 * caller alone. `ChampionshipStanding` is that column and nothing else.
 *
 * NOTHING HERE INFERS IT, AND THAT HAS NOT CHANGED. Not from a lost tie, not
 * from an absent later fixture, not from a missing seed, and not from the
 * bracket naming somebody else as champion. Each looks conclusive and each is
 * wrong whenever a competition has not finished eliminating.
 *
 * `not-stated` SURVIVES AND STILL MEANS SOMETHING. It is now "this database
 * has not reached contract 208", which is a real state for as long as a hosted
 * environment sits behind the repository. It is NOT decoded as `active`:
 * "cannot say" and "you are fine" are different sentences.
 *
 * ============================ AND `qualified` IS NO LONGER THE DRAW =======
 *
 * The standing used to be filled from contract 193's `you_qualified`, which is
 * `exists(member.seed is not null)` — a fact about the DRAW that becomes true
 * when a seed is dealt and never becomes false when the player is knocked out.
 * It sat in the verdict slot and read as a current status.
 *
 * The two are now separate fields, because they are separate facts: the
 * competition's verdict is `standing`, and being seeded is
 * `seededIntoKnockout`. `qualified` in the standing is now the SETTLEMENT
 * vocabulary's own `qualified`, which is a different claim from the same word.
 */

/* ==========================================================================
   WHERE THE PLAYER IS
   ========================================================================== */

type ChampionshipContext = {
  readonly competitionName: string
  readonly seasonLabel: string | null
  /** The game. Never merged with the competition — the Deck's rule since 7.6. */
  readonly gameName: string
}

/* ==========================================================================
   THE THREE VOCABULARIES
   ========================================================================== */

/**
 * HOW A TIE WAS DECIDED. `bonus_cup_fixtures.decided_by`, read rather than
 * re-derived from any score.
 *
 * `walkover` and `admin_walkover` are kept apart because the server keeps them
 * apart: one is the competition's own rule firing, the other an administrator
 * acting. Neither carries a reason, and neither may grow a scoreline.
 */
export type TieDecision =
  | 'points'
  | 'extra_time'
  | 'penalty_number'
  | 'walkover'
  | 'admin_walkover'

/**
 * WHAT THE COMPETITION SAYS THE PLAYER IS.
 *
 * The five values are `bonus_competition_entrants.outcome`'s own check
 * constraint, carried whole. `survived` belongs to it too — it is the
 * vocabulary a Last Man Standing competition writes into the same column — and
 * it is listed here because the type mirrors the constraint rather than the
 * subset one game happens to use. A surface that met it and had no copy for it
 * would render nothing at all.
 *
 * `not-stated` means the read carried no outcome: a database behind contract
 * 208. It is not a failure and it is not `active`.
 */
export type ChampionshipOutcome =
  | 'active'
  | 'qualified'
  | 'survived'
  | 'eliminated'
  | 'champion'

export type ChampionshipStanding =
  | { readonly kind: 'stated'; readonly outcome: ChampionshipOutcome }
  | { readonly kind: 'not-stated' }

/* ==========================================================================
   A SEAT IN THE BRACKET
   ========================================================================== */

/**
 * ONE SIDE OF ONE TIE.
 *
 * IDENTIFIED BY ID, NEVER BY NAME. Contract 193 renders every side as
 * `jsonb_build_object('user_id', ..., 'display_name', coalesce(profile.display_name, 'Player'))`,
 * so an UNFILLED seat and a real player with no profile row both arrive
 * carrying the display name `'Player'`. Only `user_id` tells them apart, which
 * is why `empty` is a case of its own and why the name is not load-bearing.
 */
export type BracketSide =
  | { readonly kind: 'player'; readonly displayName: string; readonly isYou: boolean }
  /** No player in this seat yet. NOT a person called "Player". */
  | { readonly kind: 'empty' }

/**
 * ONE TIE IN THE BRACKET, AS THE SERVER ORDERED IT.
 *
 * `windowSequence` and `bracketSlot` are the server's own ordering keys and are
 * carried, never recomputed. `bracketSlot` is null for a `playoff` fixture,
 * whose slot means something different from a knockout seat — so a surface
 * that groups by round must group by what the server stated, not by arithmetic
 * over the count of seats.
 */
export type BracketSeat = {
  readonly key: string
  readonly windowSequence: number
  readonly windowLabel: string | null
  readonly roundSize: number | null
  readonly bracketSlot: number | null
  readonly home: BracketSide
  readonly away: BracketSide
  readonly isYours: boolean
  readonly outcome: TieOutcome
}

/**
 * WHAT HAPPENED TO A TIE.
 *
 * A DETERMINISTIC OUTCOME IS A DIFFERENT CASE, NOT A PLAYED ONE WITH ODD
 * NUMBERS IN IT. There is no score field anywhere in this union, so a walkover
 * cannot grow one.
 */
export type TieOutcome =
  | { readonly kind: 'unsettled' }
  | {
      readonly kind: 'settled'
      readonly decision: TieDecision
      /** Null where the winner is not one of the two named sides. */
      readonly winnerIsHome: boolean | null
      readonly settledAt: string | null
    }

/* ==========================================================================
   THE PANELS — one per read, per Stages 10 and 11
   ========================================================================== */

/**
 * THE BRACKET.
 *
 * `not-drawn` is an ordinary answer: the competition exists and its knockout
 * has not been drawn. `unavailable` is about the READ.
 */
export type BracketPanel =
  | {
      readonly kind: 'bracket'
      readonly seats: readonly BracketSeat[]
      readonly champion: { readonly displayName: string; readonly isYou: boolean } | null
    }
  | { readonly kind: 'not-drawn' }
  | { readonly kind: 'not-entered' }
  | { readonly kind: 'unavailable' }

/* ==========================================================================
   THE PENALTY NUMBER — the one secret, and the one thing to do
   ========================================================================== */

/**
 * WHICH NUMBERS THIS PLAYER MAY SUBMIT.
 *
 * The lane is fixed at round creation and is the SERVER'S: the home side (the
 * better seed) holds ODD, the away side EVEN. `submit_cup_penalty_number`
 * refuses the wrong parity with `check_violation`, so the page states the rule
 * rather than discovering it — a refusal after the fact is a worse way to learn
 * a constraint that was knowable before.
 */
export type PenaltyLane = 'odd' | 'even'

/**
 * WHAT MAY BE DONE ABOUT THE PENALTY NUMBER RIGHT NOW.
 *
 * ONLY THE ACTIONABLE CASES CARRY A LANE, which is what a submission needs.
 * A locked or unscheduled round has nothing to submit with — Stage 11's rule
 * that an id exists only where an action is permitted, applied to a constraint
 * rather than to an address.
 *
 * `unscheduled` IS ITS OWN CASE BECAUSE THE SERVER SAYS SO, and not by
 * inference: contract 193 returns `locked` and `open` as two INDEPENDENT
 * booleans, and when the round's real fixtures have no kickoff BOTH are false.
 * A surface reading one as the negation of the other would call an unscheduled
 * round open, and offer a control the write refuses with `55000`.
 */
export type PenaltyNumberPanel =
  /** Open, and nothing submitted yet. */
  | { readonly kind: 'open'; readonly lane: PenaltyLane; readonly locksAt: string | null }
  /** Open, and a value already stored. Re-submittable until the lock. */
  | {
      readonly kind: 'submitted'
      readonly lane: PenaltyLane
      readonly value: number
      readonly locksAt: string | null
    }
  /** The lock passed. The value, where the caller has one, is still theirs. */
  | { readonly kind: 'locked'; readonly value: number | null }
  /** The round has no scheduled kickoff, so it cannot take a submission. */
  | { readonly kind: 'unscheduled' }
  /** No tie needing one. */
  | { readonly kind: 'not-required' }

/**
 * THE OPPONENT'S NUMBER HAS NO REPRESENTATION HERE, AND THAT IS DELIBERATE.
 *
 * Contract 193 never returns it under any condition — no post-settlement
 * reveal, no administrator path — and its migration asserts against its own
 * installed text that `bonus_cup_penalty_numbers` is reached exactly once and
 * scoped to `pn.user_id = v_uid`. Whether the opponent has SUBMITTED is
 * withheld too, for the same reason: a sealed bid whose existence is disclosed
 * is a bid with information in it.
 *
 * So there is no field for either. A page cannot leak what it has nowhere to
 * put.
 */

/* ==========================================================================
   THE GROUP PHASE — contract 167, read beside contract 193
   ========================================================================== */

/**
 * ONE ROW OF A GROUP TABLE, carried as the standings authority sent it.
 *
 * NOTHING HERE IS COMPUTED. `rank` is printed as sent; the points, the goals
 * either way and the tie-break inputs are all the standings authority's, and
 * this lane neither orders nor totals. Contract 167's own header states the
 * rule and this is the surface honouring it.
 *
 * `scorelineError` is nullable because a player with no settled prediction has
 * no error yet — which is a different fact from an error of zero, and is why it
 * is not defaulted.
 */
export type GroupTableRow = {
  readonly rank: number
  readonly userId: string
  readonly displayName: string
  readonly isYou: boolean
  readonly tablePoints: number
  readonly pointsFor: number
  readonly pointsAgainst: number
  readonly exacts: number
  readonly corrects: number
  readonly scorelineError: number | null
}

/** One group. `isYours` is the server's, never matched by name. */
export type GroupTable = {
  readonly groupId: string
  readonly ordinal: number
  readonly isYours: boolean
  readonly rows: readonly GroupTableRow[]
}

/**
 * THE GROUP PHASE PANEL — its own union, resolved from its own read.
 *
 * Separate from `BracketPanel` because it comes from a DIFFERENT CONTRACT that
 * can fail on its own. A Championship in its group phase has a real table and a
 * bracket that does not exist yet; merging the two behind one "loaded" would
 * make one read's failure silence the other's answer.
 *
 * `no-groups` is a real state and not an error: a Championship drawn as a
 * single group, or one whose draw has not been made, has no group tables to
 * show and says so.
 */
export type GroupPanel =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'not-entered' }
  | { readonly kind: 'no-groups' }
  | {
      readonly kind: 'groups'
      /** Null when the caller holds no group — not the same as there being none. */
      readonly yourOrdinal: number | null
      readonly groups: readonly GroupTable[]
    }

export type ChampionshipPageModel = {
  /** The instant the model describes, supplied rather than read. */
  readonly generatedAt: string
  readonly context: ChampionshipContext
  readonly standing: ChampionshipStanding
  /**
   * Contract 193's `you_qualified` — `exists(member.seed is not null)`. A fact
   * about the DRAW, kept out of `standing` because it never retracts: a player
   * knocked out in round one is still, truthfully, someone who was seeded.
   */
  readonly seededIntoKnockout: boolean
  readonly bracket: BracketPanel
  /** Contract 167's answer, which resolves independently of the bracket's. */
  readonly groups: GroupPanel
  /** Its own outcome, independent of the bracket. */
  readonly penaltyNumber: PenaltyNumberPanel
}

/**
 * The numbers this lane permits, as a sentence.
 *
 * ONE PLACE, so the rule the page states and the rule a test asserts cannot
 * drift. Derived from the lane the SERVER assigned, never from the caller.
 */
export function penaltyLaneRule(lane: PenaltyLane): string {
  return lane === 'odd'
    ? 'Your lane is odd — pick an odd number from 1 to 99.'
    : 'Your lane is even — pick an even number from 0 to 98.'
}

/** Whether a value is submittable in this lane. States the rule, never applies a server one. */
export function penaltyValueAllowed(lane: PenaltyLane, value: number): boolean {
  if (!Number.isInteger(value)) return false
  if (lane === 'odd') return value >= 1 && value <= 99 && value % 2 === 1
  return value >= 0 && value <= 98 && value % 2 === 0
}

/* ==========================================================================
   SELECTORS — reading the model, never re-deriving it
   ========================================================================== */

/**
 * The seats grouped by the round the SERVER put them in.
 *
 * Grouped on `windowSequence`, which is the server's own key, and emitted in
 * the order the seats arrived — contract 193 already ordered them by
 * `window_sequence, bracket_slot`. Nothing here sorts, counts rounds or infers
 * a round from how many seats it holds.
 */
export function bracketRounds(
  seats: readonly BracketSeat[],
): readonly { readonly windowSequence: number; readonly label: string | null; readonly seats: readonly BracketSeat[] }[] {
  const rounds: { windowSequence: number; label: string | null; seats: BracketSeat[] }[] = []
  for (const seat of seats) {
    const current = rounds[rounds.length - 1]
    if (current !== undefined && current.windowSequence === seat.windowSequence) {
      current.seats.push(seat)
      continue
    }
    rounds.push({ windowSequence: seat.windowSequence, label: seat.windowLabel, seats: [seat] })
  }
  return rounds
}
