import { useRef, useState } from 'react'
import type { Scoreline } from '../models/football'
import type { PredictorFixture, PredictorPredictionState } from '../models/predictor'
import typography from '../foundations/typography.module.css'
import styles from './predictor.module.css'

/**
 * ENTERING A SCORELINE.
 *
 * This is the control the whole page exists for, and it is deliberately not a
 * novel one. The repository has already learned what a football score entry has
 * to be, from a player who told it: `src/design-system/ScoreInput.tsx` records
 * that the only way to set a score on a phone was "hit a 44px box, wait for the
 * numeric keyboard, type, and dismiss it — for ten fixtures, twenty times".
 * Four interaction decisions came out of that and every one of them is kept
 * here, because they were paid for:
 *
 *   1. IT STEPS AS WELL AS TYPES. Predicted scores are overwhelmingly 0, 1 and
 *      2, so a tap should reach them.
 *   2. AN EMPTY BOX STEPS TO ZERO, not to one. A nil is the single most
 *      predicted score and it should cost one tap rather than two.
 *   3. FOCUS SELECTS. Tapping a filled box selects its value, so a correction
 *      is retype-over rather than clear-first.
 *   4. A DIGIT INTO AN EMPTY BOX ADVANCES. Home to away, away to the next
 *      fixture that still needs a decision, so a whole matchweek is typeable
 *      with no manual focus moves. Editing a box that already held a value never
 *      advances, which is what protects two-digit scores and re-focus-to-edit.
 *
 * WHAT vNEXT CHANGES, AND WHY IT IS ALLOWED TO. Two things, and neither is a
 * rule.
 *
 * THE STEPPERS ARE HORIZONTAL. The legacy card stacks them vertically and says
 * why: its row is `club name | scores | club name`, so six tap targets between
 * two names crowd them off a 360px screen. The vNext mobile composition gives
 * each club its OWN ROW with the stepper at the inline end, which buys the width
 * back — `− [ 2 ] +` is 44 + 56 + 44, leaving a 375px row about 190px for the
 * club name. A layout constraint that no longer applies should not be inherited
 * as a style.
 *
 * A HALF-ENTERED PREDICTION IS HELD RATHER THAN COMPLETED WITH A ZERO. This is
 * the correction, and it is the reason this file holds any state at all.
 * `save_season_prediction` refuses one score without the other, so the legacy
 * page passes `{ home: value, away: prediction?.away ?? 0 }` — typing a 2 for
 * the home side silently saves 2–0. Auto-advance hides it most of the time and
 * does not remove it. Here the un-entered side stays visibly un-entered, the
 * fixture reads "Needs both scores", and NO command is issued until the player
 * has actually said both numbers. Nothing is saved that the player did not say.
 *
 * `partial` IS THE ONLY STATE THIS FILE OWNS. It is presentation between two
 * keystrokes; it reaches no server, survives no reload and is not a draft.
 * `buildPredictorModel` cannot produce it. Every other state on the fixture —
 * empty, entered, locked, settled — arrives from the application, and nothing
 * here can produce one of those.
 */

/**
 * The highest score a box can hold, from the schema rather than from taste:
 * `season_predictions.home_score smallint not null check (>= 0 and <= 99)`.
 */
const MAX_SCORE = 99

type ScoreDraft = {
  readonly home: number | null
  readonly away: number | null
}

function draftOf(prediction: Scoreline | null): ScoreDraft {
  return prediction === null
    ? { home: null, away: null }
    : { home: prediction.home, away: prediction.away }
}

function sameScore(a: Scoreline | null, b: Scoreline | null): boolean {
  if (a === null || b === null) return a === b
  return a.home === b.home && a.away === b.away
}

export type ScoreEntryState = {
  readonly draft: ScoreDraft
  /**
   * What the row should say it is. The application's state everywhere except
   * `partial`, which only this hook can see.
   */
  readonly state: PredictorPredictionState
  readonly change: (side: 'home' | 'away', value: number | null) => void
}

/**
 * The half-entered scoreline, owned above the boxes so the fixture's own status
 * can say "needs both scores" while the boxes are still being typed into.
 */
export function useScoreEntry(
  fixture: PredictorFixture,
  onCommit: (score: Scoreline) => void,
  onClear: () => void,
): ScoreEntryState {
  const [draft, setDraft] = useState<ScoreDraft>(() => draftOf(fixture.prediction))

  /**
   * RE-SEEDING WHEN THE APPLICATION'S ANSWER CHANGES, without an effect.
   *
   * The saved prediction can move underneath this component for reasons that
   * have nothing to do with typing: a reload, a discarded offline draft, a
   * matchweek step, a conflict recovery. React's own documented pattern for that
   * is to adjust state during render behind a guard rather than in an effect —
   * an effect would paint the stale value for one frame first, and this box is
   * the one thing on the page a player is looking directly at.
   *
   * `seen` is updated on commit as well, so the optimistic update this hook
   * causes does not come back around and re-seed what is already on screen.
   */
  const seen = useRef<Scoreline | null>(fixture.prediction)
  if (!sameScore(seen.current, fixture.prediction)) {
    seen.current = fixture.prediction
    setDraft(draftOf(fixture.prediction))
  }

  /**
   * One side changed. Commit only a complete scoreline; hold an incomplete one.
   *
   * Clearing BOTH sides clears the prediction for real, because that is a thing
   * the player can mean and the application supports — `p_home is null` deletes
   * the row. Clearing ONE side of a saved prediction does not delete it: the
   * player is mid-correction, and throwing their other number away would be the
   * mirror of the invented zero this hook exists to remove.
   */
  const change = (side: 'home' | 'away', value: number | null) => {
    const next: ScoreDraft = side === 'home' ? { ...draft, home: value } : { ...draft, away: value }
    setDraft(next)

    if (next.home !== null && next.away !== null) {
      const score = { home: next.home, away: next.away }
      seen.current = score
      onCommit(score)
      return
    }
    if (next.home === null && next.away === null && fixture.prediction !== null) {
      seen.current = null
      onClear()
    }
  }

  const halfEntered =
    (draft.home === null) !== (draft.away === null) ? ('partial' as const) : null

  return {
    draft,
    // The application's answer wins for every state it can express. `partial` is
    // only ever layered over an editable fixture, and only while one box is
    // filled and the other is not.
    state: fixture.editable && halfEntered !== null ? halfEntered : fixture.state,
    change,
  }
}

export type ScoreEntryProps = {
  fixture: PredictorFixture
  entry: ScoreEntryState
  /**
   * Focus the next fixture that still needs a decision. Supplied by the list,
   * which is the only thing that knows what comes next.
   */
  onAdvanceOut?: (() => void) | undefined
  /** Lets the list focus this fixture's first box from its own controls. */
  registerHomeInput?: ((element: HTMLInputElement | null) => void) | undefined
}

export function ScoreEntry({
  fixture,
  entry,
  onAdvanceOut,
  registerHomeInput,
}: ScoreEntryProps) {
  const awayInput = useRef<HTMLInputElement | null>(null)

  return (
    // `edit` mode is laid out as three loose grid items at narrow widths — see
    // the stylesheet — so each club's stepper can sit on that club's own row.
    // `standing` mode is one block, which is why the mode is in the markup.
    <span className={styles.entry} data-mode="edit">
      <ScoreBox
        value={entry.draft.home}
        label={`${fixture.home.team.name} score`}
        side="home"
        inputRef={registerHomeInput}
        onChange={(value) => entry.change('home', value)}
        onAdvance={() => awayInput.current?.focus()}
      />
      <span className={`${styles.versus} ${typography.numeric}`} aria-hidden="true">
        v
      </span>
      <ScoreBox
        value={entry.draft.away}
        label={`${fixture.away.team.name} score`}
        side="away"
        inputRef={(element) => {
          awayInput.current = element
        }}
        onChange={(value) => entry.change('away', value)}
        onAdvance={onAdvanceOut}
      />
    </span>
  )
}

type ScoreBoxProps = {
  value: number | null
  /** "Glenmore Athletic score". Never "Home score": two boxes, two clubs. */
  label: string
  /** Which club's box this is, so the grid can put it on that club's row. */
  side: 'home' | 'away'
  onChange: (value: number | null) => void
  onAdvance?: (() => void) | undefined
  inputRef?: ((element: HTMLInputElement | null) => void) | undefined
}

/**
 * One club's goals.
 *
 * THE ACCESSIBLE NAME IS THE CLUB, which is the whole answer to "can a screen
 * reader user tell which score they are editing". "Home score" and "Away score"
 * would technically be distinct and would still make a player work out which
 * club is at home from somewhere else on the row.
 *
 * `−` IS DISABLED AT THE FLOOR, which is the one place this lane keeps a
 * disabled control, and it is kept because the legacy authority chose it after
 * the complaint that produced this control: an empty box has nothing to
 * decrease and zero cannot go lower, and "a control that looks alive and
 * refuses is the complaint this change came from". Everywhere else on this page
 * a refusal is a sentence rather than an opacity.
 */
function ScoreBox({ value, label, side, onChange, onAdvance, inputRef }: ScoreBoxProps) {
  const filled = value !== null
  // Zero on the first press, per the decision recorded above.
  const stepUp = value === null ? 0 : Math.min(MAX_SCORE, value + 1)
  const canStepDown = value !== null && value > 0

  return (
    <span className={styles.scoreBox} data-side={side} data-filled={filled ? '' : undefined}>
      <button
        type="button"
        className={styles.step}
        aria-label={`Subtract one from ${label}`}
        disabled={!canStepDown}
        onClick={() => onChange((value ?? 0) - 1)}
      >
        <span aria-hidden="true">−</span>
      </button>

      <input
        ref={inputRef}
        className={`${styles.scoreInput} ${typography.numeric}`}
        // `text` with a numeric mode rather than `type="number"`: a number input
        // brings spin buttons nobody wants beside a stepper, accepts `e` and
        // `-`, and reports an empty string for "1e" — so a typo would read as a
        // cleared prediction. The digits are filtered below instead.
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        autoComplete="off"
        aria-label={label}
        value={value === null ? '' : String(value)}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          const digits = event.target.value.replace(/[^0-9]/g, '').slice(0, 2)
          onChange(digits === '' ? null : Math.min(MAX_SCORE, Number(digits)))
          // Only out of an EMPTY box, and only on a single digit. Editing a box
          // that already held a value must not move focus away from a two-digit
          // score half typed.
          if (onAdvance && value === null && digits.length === 1) onAdvance()
        }}
      />

      <button
        type="button"
        className={styles.step}
        aria-label={`Add one to ${label}`}
        onClick={() => onChange(stepUp)}
      >
        <span aria-hidden="true">+</span>
      </button>
    </span>
  )
}
