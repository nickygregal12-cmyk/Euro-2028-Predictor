/**
 * The words around the scripted product preview.
 *
 * ============================ WHAT LIVES HERE, AND WHAT DOES NOT ==========
 *
 * The PRODUCT half of the preview — the shell, the four destinations and the
 * models behind them — is `src/vnext/fixtures/marketing/story.ts`, because it is
 * the product's own worlds rather than marketing's. What lives here is the copy
 * a visitor reads AROUND the device: the step caption, the sentence saying what
 * changed, and the description assistive technology is given for the frame.
 *
 * The split is deliberate. Marketing copy is edited often and by a different
 * kind of judgement than a product fixture, and the file that decides what the
 * product looks like should not be the file somebody opens to reword a caption.
 *
 * ============================ THE STEPS ARE THE PHASES ====================
 *
 * `id` is the same id `MARKETING_PHASES` uses, one for one and in the same
 * order, and `landingContent.test.ts` holds that. A caption that had drifted off
 * its phase would describe the wrong picture, which is the specific failure this
 * whole rebuild exists to end.
 *
 * ============================ WHAT THE SEQUENCE MAY NOT CONTAIN ===========
 *
 * No frame shows another player's unrevealed prediction, because that is a
 * reveal rule and a marketing page must not teach a visitor to expect the
 * product to break one. The league phase is a SETTLED matchweek, which is when
 * the real product reveals.
 *
 * AND NO FRAME STATES A FOOTBALL RESULT. The clubs are real now, so a scoreline,
 * a minute, a form run or a league position in one of these pictures would be a
 * claim about football that did not happen, attached to a club that exists.
 * `src/vnext/fixtures/marketing/realFootball.ts` removes all of it from every
 * model, and it is why the third step is a locked matchweek rather than the live
 * scores it used to be — the beat survives, the invented result does not.
 *
 * Nothing here is an authority. No number below is a standing, nothing computes
 * one, and the surfaces that render them are exposed to assistive technology as
 * one described picture rather than as a table of results.
 */

export type PreviewStep = {
  /** The phase this describes. Same id, same order as `MARKETING_PHASES`. */
  readonly id: string
  /** The short caption under the device. Doubles as the step control's name. */
  readonly step: string
  /**
   * One sentence saying what the product just did.
   *
   * IT NAMES THE CHANGE RATHER THAN THE SCREEN. "Saturday: the football starts"
   * tells a visitor why the picture moved; "the Home screen" tells them what
   * they can already see.
   */
  readonly headline: string
  /** What assistive technology is told this frame shows. */
  readonly description: string
}

/**
 * Five steps, in the order the week happens.
 *
 * The first four are the weekly loop — an action arrives, the fixtures are
 * there, the deadline passes, the table moves — and the fifth is the one thing
 * a week cannot show: that the season holds more than one game.
 *
 * THE CAPTIONS ARE WRITTEN FOR A VISITOR, not for a reviewer. They describe
 * what a person would DO or SEE at that point in the week — "Make your picks",
 * "Matchday" — rather than naming the implementation state the frame is in. The
 * accessible descriptions below are the exception and stay literal, because
 * their job is to tell somebody who cannot see the device that it is a picture
 * of a product rather than their own account.
 */
export const PREVIEW_STEPS: readonly PreviewStep[] = [
  {
    id: 'deadline',
    step: 'Make your picks',
    headline: 'Thursday. Two predictions still to make before Saturday.',
    description:
      'Preview of the signed-in product on Home, with one outstanding action: two ' +
      'predictions still to make before Saturday, the matchweek beneath it, and the ' +
      'competition’s own navigation down the side.',
  },
  {
    id: 'matchweek',
    step: 'The whole matchweek',
    headline: 'Friday. Every fixture in your competition, in one list.',
    description:
      'Preview of the signed-in product on Matches: the competition’s fixtures grouped ' +
      'by day, each with its kick-off time, and no other competition in sight.',
  },
  {
    id: 'locked',
    step: 'Deadline day',
    headline: 'Saturday. Everything is in — now you just watch.',
    description:
      'Preview of the signed-in product on Home once the matchweek has locked: all five ' +
      'predictions entered, nothing left to do, and the competition’s own navigation ' +
      'down the side.',
  },
  {
    id: 'table',
    step: 'The table moves',
    headline: 'Monday. See where the weekend left you and your rivals.',
    description:
      'Preview of the signed-in product on Leagues: an invented private league table of ' +
      'five made-up players ranked by points, with rank movement, and the reader’s own ' +
      'row marked.',
  },
  {
    id: 'games',
    step: 'Play your way',
    headline: 'Three games in one season. Play the ones you fancy.',
    description:
      'Preview of the signed-in product on Games: the Match Predictor, Last Man Standing ' +
      'and the Predictor Championship offered side by side, each joined separately.',
  },
]

/**
 * The step a given index shows.
 *
 * TOTAL BY CONSTRUCTION. An index outside the script wraps rather than returning
 * undefined, so no caller can render an empty caption — and the wrapping is what
 * makes the sequence a loop rather than something that ends on a still.
 * `((n % c) + c) % c` rather than `n % c`, because a negative step from a
 * "previous" control is a real input and `-1 % 5` is `-1` in JavaScript.
 */
export function previewStepAt(index: number): PreviewStep {
  const count = PREVIEW_STEPS.length
  const wrapped = ((index % count) + count) % count
  return PREVIEW_STEPS[wrapped] as PreviewStep
}

/**
 * How long each phase holds, in milliseconds.
 *
 * LONGER THAN THE OLD SCRIPT'S 4.2 SECONDS, because the frames now carry a real
 * product screen rather than a six-row abstraction of one. A visitor has to find
 * the change, read it and place it in the week; four seconds was enough for a
 * caption and is not enough for a page.
 */
export const PREVIEW_FRAME_MS = 5200
