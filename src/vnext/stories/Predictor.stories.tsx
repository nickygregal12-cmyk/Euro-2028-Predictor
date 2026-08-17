import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextMatchPredictor } from '../predictor/VNextMatchPredictor'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import type { VNextMotionSetting } from '../foundations/VNextRoot'
import type { PredictorActions, PredictorModel } from '../models/predictor'
import { predictorScenarios, rehearsePredictor } from '../fixtures'
import type { PredictorScenarioName } from '../fixtures'

/**
 * vNEXT MATCH PREDICTOR — THE STAGE 7 REVIEW SURFACE.
 *
 * EVERY STORY IS INTERACTIVE, and that is deliberate rather than incidental. The
 * question Stage 7 has to answer is whether working through ten fixtures is fast
 * and satisfying, and a still frame cannot answer it: press `+`, type a digit,
 * watch the focus advance to the next club and the progress track fill. Stories
 * that handed the page no-op actions would show every state and prove nothing
 * about the one thing under review.
 *
 * THE REHEARSAL IS A HARNESS AND NOT A SECOND TRUTH. `rehearsePredictor` is a pure
 * reducer under `fixtures/` that cannot change `editable`, `lock`, `phase` or the
 * Joker's playability — so typing into the locked story does nothing, exactly as
 * it must. The real page's real actions go to the real application.
 *
 * NO DATABASE, ANYWHERE BENEATH THIS FILE. `VNextMatchPredictor({ model, actions })`
 * takes a model and nothing else, and a boundary test holds that.
 *
 * EVERY FRAME IS AN HONEST REVIEW. Because the page responds to its CONTAINERS —
 * the page region, the working column and each fixture row — a 430px frame
 * composes as a phone even when the browser showing it is 1920 wide. The `scale`
 * on the wider stories is a CSS transform: it shrinks the picture and not the
 * layout, so a 1920 frame at 62% still answers container queries as 1920.
 *
 * THE MATRIX IS NOT COMPLETE ON PURPOSE. Ten scenarios times six widths is sixty
 * stories nobody reads. What is exported is the set the brief asks to be
 * reviewed — the working states at every width that composes differently, each
 * lifecycle state at the two widths that decide a design, the degraded states, and
 * reduced motion — plus one `Responsive` story with controls for anything else.
 */

const meta = {
  title: 'vNext/Match Predictor',
  component: WorkshopCanvas,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    motion: { control: 'inline-radio', options: ['system', 'full', 'reduced'] },
    viewports: {
      control: 'check',
      options: [
        'phone-375',
        'phone-430',
        'tablet-768',
        'laptop-1024',
        'laptop-1440',
        'desktop-1920',
      ],
    },
    scale: { control: { type: 'range', min: 0.2, max: 1, step: 0.02 } },
  },
} satisfies Meta<typeof WorkshopCanvas>

export default meta

/**
 * The page, wired to the rehearsal.
 *
 * State lives here rather than in the page, because the page holds none: every
 * command goes out through `actions` and comes back as a new model, which is the
 * same shape the real integration has.
 */
function Rehearsed({ scenario }: { scenario: PredictorScenarioName }) {
  const [model, setModel] = useState<PredictorModel>(predictorScenarios[scenario])

  const actions: PredictorActions = {
    setPrediction: (fixtureId, score) =>
      setModel((current) => rehearsePredictor(current, { kind: 'setPrediction', fixtureId, score })),
    clearPrediction: (fixtureId) =>
      setModel((current) => rehearsePredictor(current, { kind: 'clearPrediction', fixtureId })),
    setJoker: (played) =>
      setModel((current) => rehearsePredictor(current, { kind: 'setJoker', played })),
    confirmCard: () => setModel((current) => rehearsePredictor(current, { kind: 'confirmCard' })),
    // A rehearsal has no failing save to retry and no server to re-read, so both
    // recovery controls reset the scenario. That is honest about the harness: it
    // shows what the control looks like and claims nothing about what it does.
    retrySave: () => setModel(predictorScenarios[scenario]),
    reload: () => setModel(predictorScenarios[scenario]),
  }

  return <VNextMatchPredictor model={model} actions={actions} />
}

function predictor(
  scenario: PredictorScenarioName,
  viewports: readonly string[],
  scale = 1,
  motion: VNextMotionSetting = 'system',
): StoryObj {
  return {
    parameters: { layout: 'fullscreen' },
    render: () => (
      <WorkshopCanvas viewports={viewports} scale={scale} motion={motion}>
        <Rehearsed scenario={scenario} />
      </WorkshopCanvas>
    ),
  }
}

/* ---- A. OPEN, WORK TO DO — the state the page exists for ---------------- */

/** The smallest screen the product has to survive. */
export const Open375: StoryObj = predictor('open', ['phone-375'])

/** The primary mobile design review width. */
export const Open430: StoryObj = predictor('open', ['phone-430'])

/** The in-between width, where the row first becomes a scoreboard. */
export const Open768: StoryObj = predictor('open', ['tablet-768'], 0.9)

/**
 * THE BAND WHERE THE PAGE COMPOSITION CHANGES. Below it the brief is a band above
 * the list; at and above it the brief becomes a sticky rail beside the work. This
 * is the width that decision was made at, so it has a frame of its own.
 */
export const Open1024: StoryObj = predictor('open', ['laptop-1024'], 0.86)

export const Open1440: StoryObj = predictor('open', ['laptop-1440'], 0.8)

/** The widest band, where the working column takes two fixtures across. */
export const Open1920: StoryObj = predictor('open', ['desktop-1920'], 0.62)

/**
 * The first visit: nothing entered at all.
 *
 * The card says it will bank NOTHING rather than "the 0 you have entered", and
 * confirming is refused in the application's own words rather than greyed out.
 */
export const Untouched430: StoryObj = predictor('untouched', ['phone-430'])

export const Untouched1440: StoryObj = predictor('untouched', ['laptop-1440'], 0.8)

/* ---- B. NEARLY DONE, DEADLINE CLOSE ------------------------------------- */

/**
 * Nine of ten, eighty-five minutes out, Joker played.
 *
 * The urgency is `urgent` — stated by the model, never computed by a component —
 * so the brief and the masthead chip both shout, the jump control says "go to the
 * last fixture", and two rows are mid-save so the saving and failed states are
 * reviewable where they actually happen.
 */
export const Closing430: StoryObj = predictor('closing', ['phone-430'])

export const Closing1440: StoryObj = predictor('closing', ['laptop-1440'], 0.8)

export const Closing1920: StoryObj = predictor('closing', ['desktop-1920'], 0.62)

/* ---- C. COMPLETE AND CONFIRMED, STILL EDITABLE ------------------------- */

/**
 * The state most easily got wrong. Confirmed is NOT locked: every control is
 * still there and the copy says so. A page that calmed into a read-only receipt
 * here would tell a player they cannot change their mind when they can.
 */
export const Complete430: StoryObj = predictor('complete', ['phone-430'])

export const Complete1440: StoryObj = predictor('complete', ['laptop-1440'], 0.8)

/* ---- D. LOCKED --------------------------------------------------------- */

/**
 * Not one disabled control on the page: the boxes, steppers and clear buttons are
 * ABSENT and the scorelines are text. Two fixtures were never entered and say so.
 * The crowd split appears here for the first time, because the server offers
 * consensus once the matchweek locks.
 */
export const Locked430: StoryObj = predictor('locked', ['phone-430'])

export const Locked1440: StoryObj = predictor('locked', ['laptop-1440'], 0.8)

export const Locked1920: StoryObj = predictor('locked', ['desktop-1920'], 0.62)

/* ---- E. SETTLED -------------------------------------------------------- */

/**
 * Results in, matchweek scored, Joker doubled it.
 *
 * ONE TOTAL AND IT IS THE SERVER'S. No fixture shows a points figure, because the
 * application supplies none per fixture; each row shows the result, what the
 * player said and the rule's verdict, and the banked total appears once. Nothing
 * on this page claims a provisional point.
 */
export const Settled430: StoryObj = predictor('settled', ['phone-430'])

export const Settled1440: StoryObj = predictor('settled', ['laptop-1440'], 0.8)

export const Settled1920: StoryObj = predictor('settled', ['desktop-1920'], 0.62)

/* ---- F. REDUCED DATA --------------------------------------------------- */

/**
 * No form, no league table, no consensus — every optional enrichment absent at
 * once.
 *
 * WHAT TO LOOK FOR. Not "does it render". Whether the row keeps its shape and
 * loses its claims: no empty run of five pills, no zero where a position is
 * unknown, no blank consensus panel, and two different sentences for "this club
 * has not played" and "we could not read the form".
 */
export const Reduced430: StoryObj = predictor('reduced', ['phone-430'])

export const Reduced1440: StoryObj = predictor('reduced', ['laptop-1440'], 0.8)

export const Reduced1920: StoryObj = predictor('reduced', ['desktop-1920'], 0.62)

/* ---- DEGRADED STATES --------------------------------------------------- */

/**
 * The lock could not be resolved, so the matchweek fails closed — and this is
 * NOT a deadline. No countdown appears, the notice offers a reload because this
 * reason is retryable, and the copy says the deadline is unconfirmed rather than
 * claiming predictions closed.
 */
export const Unavailable430: StoryObj = predictor('unavailable', ['phone-430'])

export const Unavailable1440: StoryObj = predictor('unavailable', ['laptop-1440'], 0.8)

/** Edited on another device. Terminal: a reload, never a retry. */
export const Conflict430: StoryObj = predictor('conflict', ['phone-430'])

export const Conflict1440: StoryObj = predictor('conflict', ['laptop-1440'], 0.8)

/** A matchweek with no football in it yet — ordinary, and not a failure. */
export const NoFixtures430: StoryObj = predictor('empty', ['phone-430'])

export const NoFixtures1440: StoryObj = predictor('empty', ['laptop-1440'], 0.8)

/* ---- CROSS-CUTTING ----------------------------------------------------- */

/** The two review widths side by side, which is how hierarchy is judged. */
export const MobileAndDesktop: StoryObj = predictor(
  'open',
  ['phone-430', 'laptop-1440'],
  0.7,
)

/** All six widths at once. Scaled visually only — containers see real widths. */
export const AllWidths: StoryObj = predictor(
  'open',
  ['phone-375', 'phone-430', 'tablet-768', 'laptop-1024', 'laptop-1440', 'desktop-1920'],
  0.3,
)

/**
 * THE REDUCED-MOTION PATH: the same page with no travel.
 *
 * What to check is that it is a coherent still surface rather than the same
 * animation at 1ms. The rows do not rise in, the disclosure simply appears, the
 * Joker's activation beat is gone — and every state change is still visible,
 * because each one is carried by a colour, a word and a shape rather than by the
 * movement.
 */
export const ReducedMotion: StoryObj = predictor(
  'closing',
  ['phone-430', 'laptop-1440'],
  0.7,
  'reduced',
)

/** Everything else, with controls. */
export const Responsive: StoryObj<typeof meta> = {
  args: {
    viewports: ['phone-430', 'laptop-1440'],
    scale: 0.7,
    motion: 'system',
    children: <Rehearsed scenario="open" />,
  },
}
