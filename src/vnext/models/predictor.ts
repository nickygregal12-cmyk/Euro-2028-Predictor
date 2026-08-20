/**
 * vNext MATCH PREDICTOR presentation model.
 *
 * The same rules as `football.ts` and `home.ts`: this describes what the
 * interface wants to DISPLAY, it mirrors no table, and it is not a rule
 * authority. Nothing here decides whether a prediction may be edited, when a
 * matchweek locks, what a prediction is worth, whether a Joker may be played or
 * when a consensus may be revealed. Every one of those arrives as a stated fact
 * from the existing season Match Predictor authority, and the surface's job is
 * to draw it beautifully and never to recompute it.
 *
 * THE TWO FIELDS THAT CARRY THE MOST WEIGHT are `editable` and `lock`. They are
 * `presentCard(page, hasConflict).editable` and `explainLock(page.lock)` — the
 * application's own answers — copied across rather than derived. A vNext
 * component may branch on them; it may never produce them. In particular there
 * is no kickoff instant compared to a clock anywhere in the predictor lane, and
 * `tests/vnext/predictor.test.tsx` feeds the surface a matchweek that locked in
 * 1999 with `editable: true` to prove the surface obeys the flag rather than
 * the calendar.
 *
 * OPTIONALITY IS HONEST, and this model has more of it than Home's did, because
 * the predictor's supporting football is genuinely enrichment: a club with no
 * settled fixture has no form, a competition that is not a league has no table,
 * and a matchweek before its reveal boundary has no consensus. Each of those is
 * `null` and draws LESS information rather than a zero.
 */

import type {
  ConsensusGroup,
  FormResult,
  PredictionOutcome,
  Scoreline,
  Team,
} from './football'

/* ------------------------------------------------------------------ *
 * The matchweek, its deadline and its phase
 * ------------------------------------------------------------------ */

/**
 * The three states the application's own `LockPresentationKind` distinguishes,
 * carried through unchanged.
 *
 * `unavailable` is NOT a deadline. `lockExplanation.ts` exists to keep that
 * distinction, because three of the domain's eight lock reasons mean "the lock
 * arithmetic could not be trusted, so it failed closed" — and telling a player
 * "predictions are closed" in that case is a lie of omission.
 */
export type PredictorLockKind = 'open' | 'closed' | 'unavailable'

/**
 * How hard the surface should shout about the deadline.
 *
 * DECIDED BY THE MODEL, NEVER BY A COMPONENT, and the precedent is Home's
 * `PrimaryActionUrgency`, which exists for exactly this reason. A component that
 * compared `lock.at` to `generatedAt` would be presentation reasoning about a
 * deadline, which is the one thing `src/vnext/AGENTS.md` names in terms: "read
 * `urgency`, not a deadline against a clock".
 *
 * Null where the matchweek is not open. A passed deadline has no urgency — it
 * has an outcome — and toning a locked card as "urgent" would be shouting about
 * something the player can no longer do anything about.
 */
export type PredictorUrgency = 'calm' | 'soon' | 'urgent'

export type PredictorLock = {
  readonly kind: PredictorLockKind
  readonly urgency: PredictorUrgency | null
  /** Short badge word. The application's copy, not the surface's. */
  readonly label: string
  /** One sentence a player can act on. Also the application's. */
  readonly detail: string
  /** Whether a retry could plausibly change the answer. */
  readonly retryable: boolean
  /**
   * The deadline instant the domain resolved, where it resolved one.
   *
   * ISO 8601, and it is `ResolvedLockState.lockAt` — the earliest kickoff in the
   * matchweek under the main predictor's zero-minute buffer. Null where the lock
   * could not be resolved at all, which is exactly when a countdown would be a
   * confident number about nothing.
   *
   * A COUNTDOWN OVER THIS IS PRESENTATION, A PERMISSION FROM IT IS NOT. The
   * surface may format "locks in 2 hr 15 min" from this and a display instant; it
   * may never conclude from the pair that the matchweek is open or closed. That
   * is `kind`'s job, and `kind` came from the server's resolved state.
   *
   * REACHING IT IS ALLOWED TO DO EXACTLY ONE THING: ask again. `useDeadlineClock`
   * requests `actions.refreshAfterDeadline` once per distinct instant on an `open`
   * card, and whatever the application then says is the new answer — including
   * "still open". It is deliberately NOT `actions.reload`: that one is a recovery
   * command that abandons unsettled writes, which a timer may not do.
   */
  readonly at: string | null
}

/**
 * What phase of its life this matchweek is in, for the surface's composition.
 *
 * Derived by the ADAPTER from the application's `CardState`, never here and
 * never by a component. The five values are the five genuinely different
 * compositions the page has: a working surface, a waiting surface, a results
 * surface, a fail-closed notice and a stale-data notice.
 */
export type PredictorPhase =
  | 'open'
  | 'locked'
  | 'settled'
  | 'unavailable'
  | 'conflict'

/* ------------------------------------------------------------------ *
 * One fixture as a decision surface
 * ------------------------------------------------------------------ */

/**
 * Where a single prediction stands, said as one word.
 *
 * The surface pairs every one of these with a shape as well as a colour, so the
 * state survives greyscale, a colour-vision difference and a screenshot.
 *
 * `partial` IS PRESENTATION AND ONLY PRESENTATION. It never arrives from the
 * application, because the application cannot hold half a prediction —
 * `save_season_prediction` refuses one score without the other. It is what the
 * surface shows between a player's first keystroke and their second, and
 * `buildPredictorModel` can never produce it. See `VNextScoreEntry`.
 */
export type PredictorPredictionState =
  | 'empty'
  | 'partial'
  | 'entered'
  | 'locked'
  | 'settled'

/**
 * The save state of one fixture, as the existing save coordinator reports it.
 *
 * These are `SaveStatus`'s own values. `conflict` is terminal and means the row
 * moved underneath us; the surface offers a reload rather than a retry, because
 * guessing which side wins is exactly what a conflict means we cannot do.
 */
export type PredictorSaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

/** A club's recent record over the window the server was asked for. */
export type PredictorFormRecord = {
  /** "Won 4, drawn 1, lost 1 of the last 6" — the application's sentence. */
  readonly record: string
  /** "+7" / "-3" / "0" over the window. */
  readonly goalDifference: string
  readonly played: number
}

export type PredictorSide = {
  readonly team: Team
  /** Most recent first. Empty where the club has no settled fixture behind it. */
  readonly form: readonly FormResult[]
  /** Null where the club has played nothing, or the form read did not answer. */
  readonly formRecord: PredictorFormRecord | null
  /**
   * The competition table's own position. Null where the competition publishes
   * no table, or the club is not in the one it publishes.
   */
  readonly leaguePosition: number | null
}

export type PredictorFixture = {
  readonly id: string
  /**
   * ISO 8601, or null where the fixture carries no kickoff yet.
   *
   * The surface formats a label from this. It never compares it to anything.
   */
  readonly kickoff: string | null
  readonly home: PredictorSide
  readonly away: PredictorSide
  /** The player's saved prediction, or null where they have entered none. */
  readonly prediction: Scoreline | null
  /** The official result. Present only once the platform has settled it. */
  readonly result: Scoreline | null
  /**
   * What this fixture was awarded, where the application states a per-fixture
   * figure. Null means "no per-fixture value was supplied" — never zero points.
   *
   * IT IS NULL ON THE REAL PATH TODAY, and that is a capability gap rather than
   * a modelling choice: contract 113's `get_season_matchweek_card` returns a
   * `settled_points` for the MATCHWEEK and no figure per fixture, so
   * `seasonMatchPredictor.ts` maps `points: null` for every row. The surface
   * therefore prints the matchweek's banked total once and says nothing about
   * what any single fixture was worth. Filling this in from `explainFixtureScore`
   * would be the browser stating an awarded value, which is the one thing
   * `matchweekPointsModel` refuses to do: "where the two differ the player's
   * standing follows the server, so the breakdown does too".
   */
  readonly points: number | null
  /**
   * Whether the prediction was exact, the right result, or missed.
   *
   * THE RULE'S ANSWER, NOT A COMPARISON WRITTEN AGAIN. It is
   * `explainFixtureScore(prediction, result)`'s reason — the shared domain
   * authority with a parity test against the database behind it, and the same
   * one `matchCentreModel` and `matchweekPointsModel` consume. Deriving it in the
   * adapter is consuming a rule; re-deriving it in a component would be a second
   * opinion about who won.
   *
   * Null for anything not settled, and null for a settled fixture the player
   * left blank — `unscored` means the rule neither awarded nor withheld
   * anything, and calling that "missed" would tell a player they predicted badly
   * when they did not predict.
   */
  readonly verdict: PredictionOutcome | null
  /** One word for where this prediction stands. Never `partial` from a mapper. */
  readonly state: PredictorPredictionState
  /**
   * Whether THIS fixture's controls may be shown.
   *
   * It is the card's `editable` today, because the main predictor's lock scope
   * is the whole matchweek, and it is carried per fixture anyway so a future
   * per-match lock policy needs no new field and no new component.
   */
  readonly editable: boolean
  /** The last save outcome for this fixture. */
  readonly save: PredictorSaveState
  /**
   * The community consensus for this fixture, or null.
   *
   * NULL IS THE DEFAULT AND THE REVEAL BOUNDARY IS NOT THIS MODEL'S. The server
   * refuses consensus before the matchweek locks and suppresses it below its own
   * minimum; both arrive here as null, and the surface simply has nothing to
   * draw. No component may infer that a lock has passed from anything.
   */
  readonly consensus: ConsensusGroup | null
}

/* ------------------------------------------------------------------ *
 * The game mechanics around the fixtures
 * ------------------------------------------------------------------ */

export type PredictorJoker = {
  readonly playedHere: boolean
  readonly remainingThisHalf: number
  /** The application's allowance answer. Presentation never computes it. */
  readonly playable: boolean
  /**
   * Why the Joker command would be refused, in the application's own words, or
   * null where it would be accepted.
   *
   * It is `commandRefusal(...)`'s return value. A non-null value is why the
   * surface renders a SENTENCE rather than a control — this repository removed
   * its last disabled buttons on the grounds that a greyed control is the
   * sentence "you have none left" spelled in opacity.
   */
  readonly refusal: string | null
}

/**
 * The card-level confirm action, which is a separate command from saving a
 * prediction and means something different: a record of intent.
 *
 * - `available` — the command would be accepted; render the control.
 * - `confirmed` — the card is already confirmed.
 * - `refused` — it would be refused, and `refusal` says why in words.
 * - `absent` — the matchweek is not open, so there is nothing to confirm.
 */
export type PredictorConfirm = {
  readonly state: 'available' | 'confirmed' | 'refused' | 'absent'
  readonly refusal: string | null
}

/**
 * A page-level notice, where the application has one to make.
 *
 * The copy is the application's — a conflict message, a fail-closed lock
 * explanation, a refused command's reason — so the surface is never the second
 * place a rule is explained.
 */
export type PredictorNotice = {
  readonly tone: 'error' | 'warn'
  readonly title: string
  readonly body: string
  /** Whether a reload could plausibly help. */
  readonly retryable: boolean
}

/**
 * Which optional enrichments answered, so the surface can be honest rather than
 * drawing an empty shell where a mock used to have data.
 *
 * FALSE MEANS "NOT READ", WHICH IS NOT "NOTHING HAPPENED". A club that has
 * genuinely played nothing has an empty `form` with `form: true` here; a failed
 * form read has an empty `form` with `form: false`. The first is football, the
 * second is this build, and the surface says different things about them.
 */
export type PredictorEnrichment = {
  readonly form: boolean
  readonly table: boolean
  readonly consensus: boolean
}

export type PredictorModel = {
  /**
   * The instant the model describes, supplied rather than read.
   *
   * IT IS THE AUTHORITATIVE INSTANT AND IT DOES NOT TICK. It moves when the
   * application rebuilds the model and at no other time, which is what makes it
   * safe for the mapper to derive `lock.urgency` from it.
   *
   * The page does not draw its countdown directly against it. `useDeadlineClock`
   * takes it as an ANCHOR and advances a separate presentation instant by observed
   * elapsed time, so a card left open keeps a current countdown without anything
   * pretending the server answered again. Nothing in either direction touches
   * `editable`, `lock.kind`, the phase or the Joker.
   */
  readonly generatedAt: string

  readonly competition: {
    readonly name: string
    readonly seasonLabel: string
    /** Null everywhere the application holds no competition palette. */
    readonly colours: { readonly primary: string; readonly accent: string } | null
  }

  readonly matchweek: {
    readonly number: number
    readonly of: number
    /** "Matchweek 3" — the words, so the surface never assembles an ordinal. */
    readonly label: string
  }

  readonly lock: PredictorLock
  readonly phase: PredictorPhase

  /**
   * THE AUTHORITY ON WHETHER ANY CONTROL IS SHOWN. `presentCard(...).editable`,
   * carried across. A component may read it; nothing in vNext may produce it.
   */
  readonly editable: boolean

  /** How many of the matchweek's fixtures the player has filled in. */
  readonly progress: { readonly entered: number; readonly total: number }

  /**
   * What happens to this card at the lock instant, as the application states it.
   *
   * IT IS A FACT AND NOT A SENTENCE. `CardPresentation.atLock` is the
   * application's own two-valued answer — an untouched matchweek banks nothing,
   * an engaged one banks whatever was entered — and the WORDS are vNext's,
   * composed in `MatchweekBrief` from this plus `progress`. Carrying a finished
   * sentence would have meant either a second copy of the legacy page's private
   * copy, or a fixture whose sentence disagreed with its own counts the moment a
   * score was entered in Storybook.
   *
   * Null once the lock has passed, because it is no longer a prediction about the
   * future.
   */
  readonly atLock: 'unbanked' | 'banksEntered' | null

  readonly joker: PredictorJoker
  readonly confirm: PredictorConfirm

  /** The matchweek's banked total once settled, else null. Never zero for unknown. */
  readonly settledPoints: number | null

  /**
   * How the settled matchweek broke down, or null until it settles.
   *
   * Four counts over the fixtures' own `verdict` values, which is the same
   * arithmetic `presentMatchweekPoints` does and the same class the Home mapper
   * was allowed: an accuracy split over one denominator. It is done in the
   * ADAPTER rather than in a component, because a component that counted the
   * fixtures would be presentation re-deriving a partition of the model instead
   * of reading one.
   *
   * `blank` is fixtures the player left empty, which is a different thing from
   * `missed` — the rule awards and withholds nothing for a prediction that was
   * never made, and counting those as misses would tell a player they predicted
   * badly when they did not predict.
   */
  readonly tally: {
    readonly exact: number
    readonly result: number
    readonly missed: number
    readonly blank: number
  } | null

  readonly fixtures: readonly PredictorFixture[]

  readonly notice: PredictorNotice | null
  readonly enrichment: PredictorEnrichment
}

/**
 * What the surface may ask the application to do.
 *
 * EVERY ONE OF THESE IS AN EXISTING COMMAND. `setPrediction`, `setJoker` and
 * `confirmCard` are `MatchPredictorCommand`'s three cases; `retrySave` and
 * `reload` are `useSeasonMatchPredictor`'s recovery controls. There is no
 * autosave, no batch submit and no draft command invented here, because the
 * application does not have one and a surface is not the place to add it.
 *
 * `setPrediction` TAKES A WHOLE SCORELINE, never one side. The RPC refuses one
 * score without the other, so a command carrying half a prediction could only
 * ever be completed by the surface guessing a zero — which is what the legacy
 * page does and what this lane deliberately does not.
 *
 * REQUIRED, NOT OPTIONAL. An absent action would make a control's behaviour
 * depend on its caller rather than on the model, and the model is the thing
 * that decides what renders. Stories pass a deterministic rehearsal.
 */
export type PredictorActions = {
  setPrediction: (fixtureId: string, score: Scoreline) => void
  clearPrediction: (fixtureId: string) => void
  setJoker: (played: boolean) => void
  confirmCard: () => void
  retrySave: (fixtureId: string) => void
  reload: () => void
  /**
   * THE BOUNDARY REFRESH, AND WHY IT IS NOT `reload`.
   *
   * `reload` is a RECOVERY command a player chose: it abandons what this device
   * was still trying to write, because that is what "show me what the server
   * holds" means. `refreshAfterDeadline` is requested by a clock nobody pressed,
   * and a timer that abandoned an in-flight save, a coalesced newer scoreline or
   * a scheduled retry would silently lose a prediction at the exact moment a
   * prediction is worth most.
   *
   * The application supplies both. `useSeasonMatchPredictor.refreshAfterDeadline`
   * defers to the existing save authority and re-reads the card only once every
   * key is terminal and clean; the surface knows nothing about that, and only
   * that these are two different questions.
   */
  refreshAfterDeadline: () => void
  /**
   * The player asked to share this settled matchweek.
   *
   * OPTIONAL, AND ABSENT IS THE DEFAULT. The presentation lane may render no
   * control at all where the application did not supply one — a workshop story
   * has no canvas, no share sheet and nothing to share to, and a button that
   * did nothing there would be a lie about the surface rather than a fixture of
   * it.
   *
   * IT TAKES NO ARGUMENT ON PURPOSE. What goes on the card is decided by the
   * application from the same model this surface drew, so a surface cannot
   * choose to put something else on it.
   */
  shareMatchweek?: (() => void) | undefined
}
