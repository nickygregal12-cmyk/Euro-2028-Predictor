import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import { VNextSeasonWrapped } from '../wrapped/VNextSeasonWrapped'
import { shellScenarios, wrappedScenarios } from '../fixtures'
import type { WrappedScenarioName } from '../fixtures'

/**
 * SEASON WRAPPED — the archive contract 156 has been writing since `MIG-UI-08`,
 * finally read.
 *
 * ============================ WHAT A REVIEWER IS BEING ASKED ============
 *
 *   1. DOES A FINISHED SEASON FEEL FINISHED? Open `Played`. This is the only
 *      surface in the product whose numbers cannot move, and it should read
 *      that way — one accent, spent on the total, and a sentence at the foot
 *      saying the record does not change. If it reads like the standings, it
 *      has failed.
 *   2. WHAT HAPPENS WHERE THE ARCHIVE SAID NOTHING? Open `Unranked`. The rank
 *      tile is GONE. It is not "unranked", it is not a dash, and it is
 *      certainly not zero — the page loses the claim and keeps its shape.
 *   3. IS A SEASON NOBODY PLAYED A SENTENCE OR A GRID OF ZEROS? Open
 *      `NeverPlayed`. A player who entered and never predicted has no
 *      achievement to celebrate and no rates to divide; a wall of noughts would
 *      read as a season played badly rather than a season not played.
 *   4. ARE "STILL GOING" AND "COULD NOT READ" DIFFERENT PAGES? Open `Pending`
 *      and `Unavailable`. The first is a fair answer to a fair question and
 *      offers no retry, because there is nothing to retry about a season that
 *      has not ended. The second is an apology and offers one.
 *
 * ============================ EVERY FIGURE IS THE ARCHIVE'S =============
 *
 * Nothing on this page is derived from anything else on it, and there is no
 * percentile — a percentile worked out in a browser from a rank and a field
 * size is a number the archive never agreed to, and it would be the one figure
 * on a "this does not change" page that changed.
 */

const meta = {
  title: 'vNext/Season Wrapped',
  component: WorkshopCanvas,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof WorkshopCanvas>

export default meta

type Story = StoryObj

function board(
  scenario: WrappedScenarioName,
  widths: readonly string[],
  scale = 1,
): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={widths} scale={scale}>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextSeasonWrapped model={wrappedScenarios[scenario]} onRetry={() => {}} />
        </VNextShellProvider>
      </WorkshopCanvas>
    ),
  }
}

const PHONE_AND_DESKTOP = ['phone-375', 'laptop-1440'] as const

export const Played: Story = board('played', PHONE_AND_DESKTOP, 0.8)
export const Unranked: Story = board('unranked', PHONE_AND_DESKTOP, 0.8)
export const NeverPlayed: Story = board('neverPlayed', PHONE_AND_DESKTOP, 0.8)
export const Pending: Story = board('pending', PHONE_AND_DESKTOP, 0.8)
export const Unavailable: Story = board('unavailable', PHONE_AND_DESKTOP, 0.8)

/** Every world at once, for a reviewer comparing the five. */
export const EveryWorld: Story = {
  render: (args) => (
    <WorkshopCanvas {...args} viewports={['laptop-1440']} scale={0.55}>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextSeasonWrapped model={wrappedScenarios.played} onRetry={() => {}} />
      </VNextShellProvider>
    </WorkshopCanvas>
  ),
}
