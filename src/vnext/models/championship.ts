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
 * ============================ ELIMINATION IS ABSENT, AND SAYS SO =========
 *
 * The predicate asks for eliminated/champion/no-action-required states to be
 * complete. `champion` is present. **`eliminated` is returned by NO season
 * Championship read** — not by contract 193, 133, 167 or 120; the
 * authoritative fact lives in `bonus_competition_entrants.outcome` and reaches
 * a player only through the private-container workspace read.
 *
 * The tempting inference — "a settled tie you did not win, with no later tie"
 * — is exactly the derivation the headline predicate forbids, and it is wrong
 * in the cases that matter: a player can lose a tie in a competition that has
 * not finished eliminating.
 *
 * So `ChampionshipStanding` has a `not-stated` case, and it is an ORDINARY
 * ANSWER rather than a failure. Where an authority supplies elimination the
 * surface says it; where none does, the surface stays silent. **That asymmetry
 * is recorded as a backend capability gap and does NOT satisfy the predicate**
 * — closing it needs the smallest appropriate read delta before Stage 12 can
 * be called complete.
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
 * `not-stated` IS THE COMMON CASE TODAY and is not a failure — see the header.
 * It means no read on this page carried the fact, and the surface must
 * therefore say nothing about elimination rather than working it out.
 */
export type ChampionshipStanding =
  | { readonly kind: 'stated'; readonly outcome: 'active' | 'qualified' | 'eliminated' | 'champion' }
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

export type ChampionshipPageModel = {
  /** The instant the model describes, supplied rather than read. */
  readonly generatedAt: string
  readonly context: ChampionshipContext
  readonly standing: ChampionshipStanding
  readonly bracket: BracketPanel
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
