import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextInvite } from '../invite/VNextInvite'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import { inviteScenarioPremises, inviteScenarios, shellScenarios } from '../fixtures'
import type { InviteScenarioName } from '../fixtures'

/**
 * vNEXT INVITE — STAGE 13'S LANDING SURFACE.
 *
 * ============================ WHAT A REVIEWER IS BEING ASKED =============
 *
 *   1. IS THERE A DISABLED BUTTON ANYWHERE? There must not be. Where the server
 *      would refuse — `AlreadyIn`, `Owner`, `Closed`, `NeedsGameFirst` — the
 *      control is ABSENT and a sentence says why. A greyed-out button teaches a
 *      player to press it again.
 *   2. DOES `NeedsGameFirst` READ AS A NEXT STEP OR AS A REFUSAL? It should be
 *      the first: the server requires the game, and the page offers the way to
 *      it. This is the stage's binding decision here.
 *   3. DOES `NotFound` EXPLAIN ANYTHING? It must not. Unknown, malformed and
 *      rotated codes were made indistinguishable by the server, and a page that
 *      told them apart would turn a code into an oracle for which codes exist.
 *   4. CAN A LONG NAME BE READ IN FULL? Open `LongName`. A player deciding
 *      whether to accept has to be able to read the whole thing.
 *
 * ============================ IT IS ONE CARD ON PURPOSE =================
 *
 * A player arrives from a link somebody sent them, usually on a phone, usually
 * without context. The page answers one question and offers at most one action.
 */
const meta = {
  title: 'vNext/Invite',
  component: WorkshopCanvas,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    viewports: {
      control: 'check',
      options: ['phone-375', 'phone-430', 'tablet-768', 'laptop-1024', 'laptop-1440', 'desktop-1920'],
    },
    scale: { control: { type: 'range', min: 0.2, max: 1, step: 0.02 } },
  },
} satisfies Meta<typeof WorkshopCanvas>

export default meta

type Story = StoryObj

const ALL_WIDTHS = [
  'phone-375',
  'phone-430',
  'tablet-768',
  'laptop-1024',
  'laptop-1440',
  'desktop-1920',
] as const

function InviteHarness({ scenario }: { readonly scenario: InviteScenarioName }) {
  const [lastIntent, setLastIntent] = useState('')
  return (
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <div data-vnext-invite-host="" data-vnext-last-intent={lastIntent}>
        <VNextInvite
          model={inviteScenarios[scenario]}
          onIntent={(intent) => setLastIntent(intent.kind)}
        />
      </div>
    </VNextShellProvider>
  )
}

function board(scenario: InviteScenarioName, widths: readonly string[], scale = 1): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={widths} scale={scale}>
        <InviteHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
    parameters: { docs: { description: { story: inviteScenarioPremises[scenario] } } },
  }
}

function frame(scenario: InviteScenarioName, viewport: string): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={[viewport]}>
        <InviteHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
  }
}

/* ========================================================================== *
 * A. AN INVITATION THAT CAN BE ACCEPTED
 * ========================================================================== */

export const LeagueOpen: Story = board('leagueOpen', ALL_WIDTHS, 0.42)
export const CompetitionOpen: Story = board('competitionOpen', ['phone-375', 'laptop-1024'], 0.7)
export const Accepting: Story = board('accepting', ['phone-375'], 0.9)
export const BareInvite: Story = board('bareInvite', ['phone-375'], 0.9)
export const LongName: Story = board('longName', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * B. EVERY REFUSAL THE SERVER CAN MAKE
 * ========================================================================== */

export const NeedsGameFirst: Story = board('needsGameFirst', ['phone-375', 'laptop-1024'], 0.7)
export const NeedsUnnamedGame: Story = board('needsUnnamedGame', ['phone-375'], 0.9)
export const AlreadyIn: Story = board('alreadyIn', ['phone-375'], 0.9)
export const Owner: Story = board('owner', ['phone-375'], 0.9)
export const Closed: Story = board('closed', ['phone-375'], 0.9)

/* ========================================================================== *
 * C. WHEN THE CODE DOES NOT RESOLVE
 * ========================================================================== */

export const Looking: Story = board('looking', ['phone-375'], 0.9)
export const NotFound: Story = board('notFound', ['phone-375', 'laptop-1024'], 0.7)
export const Failed: Story = board('failed', ['phone-375'], 0.9)

/* ========================================================================== *
 * D. ADDRESSABLE FRAMES
 * ========================================================================== */

export const FrameLeagueOpenPhone: Story = frame('leagueOpen', 'phone-375')
export const FrameNeedsGameFirstPhone: Story = frame('needsGameFirst', 'phone-375')
export const FrameNotFoundPhone: Story = frame('notFound', 'phone-375')
export const FrameLongNameDesktop: Story = frame('longName', 'desktop-1920')
