import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextDiscovery } from '../discovery/VNextDiscovery'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import type { VNextMotionSetting } from '../foundations/VNextRoot'
import { discoveryScenarioPremises, discoveryScenarios, shellScenarios } from '../fixtures'
import type { DiscoveryScenarioName } from '../fixtures'

/**
 * vNEXT DISCOVERY — STAGE 13'S CATALOGUE SURFACE.
 *
 * ============================ WHAT A REVIEWER IS BEING ASKED =============
 *
 *   1. IS THE MISSING CONTROL EXPLAINED WELL ENOUGH? Open `FollowUnknown`. The
 *      preferences read failed, so no row offers Follow — because a Follow sent
 *      against an unknown state can land on a competition the player already
 *      follows, and that write CLEARS their favourite club. The alternatives
 *      are a control that may destroy data, or an unexplained absence.
 *   2. IS THERE A TOGGLE ANYWHERE? There must not be, on any row, in any world.
 *      A toggle is the shape that re-sends a follow.
 *   3. DOES ANY COPY SUGGEST FOLLOWING GETS YOU INTO A GAME? Contract 157's
 *      migration refuses to install if following ever creates a game entry, so
 *      the page must not imply the thing the server forbids.
 *   4. DOES ONE COMPETITION LOOK MORE WORTH JOINING THAN ANOTHER? It must not —
 *      no read here carries popularity, quality or a recommendation.
 *
 * ============================ NOTHING HERE READS A CLOCK =================
 */
const meta = {
  title: 'vNext/Discovery',
  component: WorkshopCanvas,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    motion: { control: 'inline-radio', options: ['system', 'full', 'reduced'] },
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

function DiscoveryHarness({ scenario }: { readonly scenario: DiscoveryScenarioName }) {
  const [lastIntent, setLastIntent] = useState('')
  return (
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <div data-vnext-discovery-host="" data-vnext-last-intent={lastIntent}>
        <VNextDiscovery
          model={discoveryScenarios[scenario]}
          onRetry={() => {}}
          onIntent={(intent) => setLastIntent(
            intent.kind === 'open-season'
              ? `open:${intent.competitionSlug}/${intent.seasonKey}`
              : `${intent.kind}:${intent.tournamentId}`,
          )}
        />
      </div>
    </VNextShellProvider>
  )
}

function board(
  scenario: DiscoveryScenarioName,
  widths: readonly string[],
  scale = 1,
  motion: VNextMotionSetting = 'system',
): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={widths} scale={scale} motion={motion}>
        <DiscoveryHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
    parameters: { docs: { description: { story: discoveryScenarioPremises[scenario] } } },
  }
}

function frame(scenario: DiscoveryScenarioName, viewport: string): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={[viewport]}>
        <DiscoveryHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
  }
}

/* ========================================================================== *
 * A. THE CATALOGUE
 * ========================================================================== */

export const Catalogue: Story = board('catalogue', ALL_WIDTHS, 0.42)
export const SomeFollowed: Story = board('someFollowed', ALL_WIDTHS, 0.42)
export const AllFollowed: Story = board('allFollowed', ['phone-375', 'laptop-1024'], 0.7)
export const WideCatalogue: Story = board('wideCatalogue', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * B. THE STATE THIS SURFACE IS CAREFUL ABOUT
 * ========================================================================== */

export const FollowUnknown: Story = board('followUnknown', ['phone-375', 'laptop-1024'], 0.7)

/* ========================================================================== *
 * C. WHAT THE CATALOGUE DID OR DID NOT SAY
 * ========================================================================== */

export const NoStatus: Story = board('noStatus', ['phone-375'], 0.9)
export const NothingPublished: Story = board('nothingPublished', ['phone-375'], 0.9)
export const Unavailable: Story = board('unavailable', ['phone-375'], 0.9)

/* ========================================================================== *
 * D. ADDRESSABLE FRAMES
 * ========================================================================== */

export const FrameCataloguePhone: Story = frame('catalogue', 'phone-375')
export const FrameCatalogueTablet: Story = frame('catalogue', 'tablet-768')
export const FrameCatalogueDesktop: Story = frame('catalogue', 'desktop-1920')
export const FrameSomeFollowedPhone: Story = frame('someFollowed', 'phone-375')
export const FrameFollowUnknownPhone: Story = frame('followUnknown', 'phone-375')
export const FrameWidePhone: Story = frame('wideCatalogue', 'phone-375')
export const FrameUnavailablePhone: Story = frame('unavailable', 'phone-375')
