import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextRoot } from '../foundations/VNextRoot'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { VNextMatchPredictor } from '../predictor/VNextMatchPredictor'
import { openPredictorModel, shellScenarios } from '../fixtures'
import type { PredictorActions } from '../models/predictor'

/**
 * WCAG 2.2 AA 2.4.11 — FOCUS NOT OBSCURED (MINIMUM), ON A REAL PAGE SCROLLER.
 *
 * ============================ WHY THIS IS NOT A WORKSHOP STORY ==========
 *
 * Every other vNext story renders inside `WorkshopCanvas`, which puts the
 * surface in a device frame so six widths can be reviewed side by side. That is
 * the right harness for composition and the WRONG one for this criterion,
 * because a framed surface scrolls INSIDE the frame: the scroll container is
 * the frame element, and `scroll-padding` on the document does nothing to it.
 *
 * Production is the opposite shape, deliberately. `VNextRoot` uses
 * `overflow-x: clip` rather than `hidden` — its own comment explains that
 * `hidden` would make the root a scroll container and the sticky masthead would
 * then never stick — so in the running application the DOCUMENT scrolls and the
 * masthead sticks to the viewport.
 *
 * This story reproduces that shape and nothing else: one `VNextRoot`, one real
 * page, no frame, `layout: 'fullscreen'`. The iframe's own document is the
 * scroller, exactly as the window is in production. `UX-007` records that the
 * finding was "suspected from the CSS … and deliberately NOT asserted" because
 * "the browser probe written for it was unreliable"; a probe against a framed
 * story is unreliable for a reason, and this is that reason removed.
 *
 * ============================ WHY THE MATCH PREDICTOR ===================
 *
 * It is the surface where the criterion actually bites. It is long, it is a
 * column of focusable score inputs, and working down it with a keyboard is the
 * single most common keyboard journey in the product — so a masthead that
 * covers the row you just tabbed to costs a player their place on every fixture
 * rather than once.
 *
 * `e2e/vnext-shell.spec.ts` tabs through it and measures.
 */

const meta = {
  title: 'vNext/Focus Not Obscured',
  parameters: { layout: 'fullscreen' },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

/** Inert. The criterion is about geometry, and a save would only add noise. */
const INERT: PredictorActions = {
  setPrediction: () => {},
  clearPrediction: () => {},
  setJoker: () => {},
  confirmCard: () => {},
  retrySave: () => {},
  reload: () => {},
  refreshAfterDeadline: () => {},
}

export const Predictor: Story = {
  render: () => (
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.fourCompetitions}>
        <VNextMatchPredictor model={openPredictorModel} actions={INERT} />
      </VNextShellProvider>
    </VNextRoot>
  ),
}
