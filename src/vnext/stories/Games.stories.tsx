import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextGames } from '../games/VNextGames'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import type { VNextMotionSetting } from '../foundations/VNextRoot'
import { gamesScenarioPremises, gamesScenarios, shellScenarios } from '../fixtures'
import type { GamesScenarioName } from '../fixtures'

/**
 * vNEXT GAMES — STAGE 13'S PEER SURFACE.
 *
 * ============================ WHAT A REVIEWER IS BEING ASKED =============
 *
 *   1. DO THE THREE GAMES READ AS PEERS? Open `AllOpen`. If the Main Predictor
 *      looks like the main one, this surface has failed at the thing it exists
 *      for — Last Man Standing was under-scoped for a whole programme because
 *      nothing put it beside its peers.
 *   2. IS "IT ONLY TAKES YOU BACK IF IT HAS NOT STARTED" ACCEPTABLE? Open
 *      `LeftAndUncertain`. Whether a rejoin would succeed depends on whether
 *      the competition is RUNNING, and `competition_is_running` is revoked from
 *      `authenticated`. The alternatives are a button that may fail, or
 *      silence. This is the stage's binding decision here.
 *   3. IS THERE ANY REJOIN CONTROL? There should not be, anywhere, in any
 *      world — including `LeftAndAllowed`, where a rejoin WOULD succeed.
 *      Rejoining belongs beside the game.
 *   4. DO THE FOUR REGISTRATION SENTENCES SAY DIFFERENT THINGS? Open
 *      `EveryRegistrationState`. "Not open" and "closed" must not read alike.
 *
 * ============================ NOTHING HERE READS A CLOCK =================
 *
 * Every world carries a fixed `generatedAt` and a pre-resolved registration
 * state. The window arithmetic is the mapper's, against the SERVER's instant.
 */
const meta = {
  title: 'vNext/Games',
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

function GamesHarness({ scenario }: { readonly scenario: GamesScenarioName }) {
  const [lastIntent, setLastIntent] = useState('')
  return (
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <div data-vnext-games-host="" data-vnext-last-intent={lastIntent}>
        <VNextGames
          model={gamesScenarios[scenario]}
          onRetry={() => {}}
          onIntent={(intent) =>
            setLastIntent(
              intent.kind === 'create-private-play'
                ? intent.kind
                : `${intent.kind}:${intent.gameId}`,
            )
          }
        />
      </div>
    </VNextShellProvider>
  )
}

function board(
  scenario: GamesScenarioName,
  widths: readonly string[],
  scale = 1,
  motion: VNextMotionSetting = 'system',
): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={widths} scale={scale} motion={motion}>
        <GamesHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
    parameters: { docs: { description: { story: gamesScenarioPremises[scenario] } } },
  }
}

function frame(scenario: GamesScenarioName, viewport: string): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={[viewport]}>
        <GamesHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
  }
}

/* ========================================================================== *
 * A. THE PEER TEST
 * ========================================================================== */

export const AllOpen: Story = board('allOpen', ALL_WIDTHS, 0.42)
export const PlayingOne: Story = board('playingOne', ALL_WIDTHS, 0.42)
export const PlayingAll: Story = board('playingAll', ['phone-375', 'laptop-1024'], 0.7)
export const WideCatalogue: Story = board('wideCatalogue', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * B. WHERE A PLAYER STANDS
 * ========================================================================== */

export const LeftAndUncertain: Story = board('leftAndUncertain', ['phone-375', 'laptop-1024'], 0.7)
export const LeftAndAllowed: Story = board('leftAndAllowed', ['phone-375'], 0.9)
export const Disqualified: Story = board('disqualified', ['phone-375'], 0.9)
export const EveryRegistrationState: Story = board('everyRegistrationState', ['phone-375', 'laptop-1024'], 0.7)

/* ========================================================================== *
 * C. WHAT THE CATALOGUE DID OR DID NOT SAY
 * ========================================================================== */

export const InactiveGame: Story = board('inactiveGame', ['phone-375'], 0.9)
export const UnnamedGame: Story = board('unnamedGame', ['phone-375'], 0.9)

/* ========================================================================== *
 * D. THE STATES THAT ARE NOT A CATALOGUE
 * ========================================================================== */

export const NoGames: Story = board('noGames', ['phone-375'], 0.9)
export const Unavailable: Story = board('unavailable', ['phone-375'], 0.9)

/* ========================================================================== *
 * E. ADDRESSABLE FRAMES — one world, one width, for the browser suite
 * ========================================================================== */

export const FrameAllOpenPhone: Story = frame('allOpen', 'phone-375')
export const FrameAllOpenTablet: Story = frame('allOpen', 'tablet-768')
export const FrameAllOpenDesktop: Story = frame('allOpen', 'desktop-1920')
export const FramePlayingOnePhone: Story = frame('playingOne', 'phone-375')
export const FrameLeftUncertainPhone: Story = frame('leftAndUncertain', 'phone-375')
export const FrameWidePhone: Story = frame('wideCatalogue', 'phone-375')
export const FrameWideDesktop: Story = frame('wideCatalogue', 'desktop-1920')
export const FrameUnavailablePhone: Story = frame('unavailable', 'phone-375')

/* ========================================================================== *
 * E. THE WEEK REACHES THE CATALOGUE
 * ========================================================================== */

/**
 * Two games asking and one reporting. The review question is whether the
 * difference is visible without reading the copy: the two jobs lead with their
 * own verb, the report keeps a destination.
 */
export const AskingThisWeek: Story = board('askingThisWeek', ['phone-375', 'laptop-1024'], 0.7)

/** The same three with nothing outstanding. No row may carry an action verb. */
export const SettledThisWeek: Story = board('settledThisWeek', ['phone-375', 'laptop-1024'], 0.7)

export const FrameAskingPhone: Story = frame('askingThisWeek', 'phone-375')
export const FrameAskingDesktop: Story = frame('askingThisWeek', 'desktop-1920')
export const FrameSettledPhone: Story = frame('settledThisWeek', 'phone-375')
