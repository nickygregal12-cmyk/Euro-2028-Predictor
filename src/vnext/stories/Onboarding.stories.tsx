import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextOnboarding } from '../onboarding/VNextOnboarding'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import type { VNextMotionSetting } from '../foundations/VNextRoot'
import { onboardingScenarioPremises, onboardingScenarios, shellScenarios } from '../fixtures'
import type { OnboardingScenarioName } from '../fixtures'

/**
 * vNEXT ONBOARDING — THE FIRST SCREEN, AND STAGE 13'S COHERENCE CLAIM.
 *
 * ============================ WHAT A REVIEWER IS BEING ASKED =============
 *
 *   1. DOES THE FIRST STEP PROMISE NOTHING IT DOES NOT DO? Open `FirstStep`.
 *      Following is not entering, and the sentence saying so is on the step
 *      where people assume otherwise. Nothing is pre-ticked.
 *   2. ARE JOINED AND CHOOSABLE GAMES UNMISTAKABLE? Open `Games`. The joined
 *      one has NO control at all — not a ticked box, not a disabled one.
 *   3. IS SKIPPING OFFERED AT THE SAME WEIGHT AS CONTINUING? Every world after
 *      the first. Three of the four steps are skippable and a skip hidden as a
 *      small grey link is a skip the product does not mean.
 *   4. DOES A PARTIAL SAVE LET THE PLAYER LEAVE? Open `PartiallyRefused`. It
 *      names what did not happen and offers a way onward — stranding somebody
 *      on a setup screen because a game filled up is the worst reading of
 *      "optional steps do not block entry".
 *   5. IS THERE ANYTHING THAT LOOKS LIKE A SCORE? There should not be: no
 *      progress meter, no percentage, no encouragement. "Step 2 of 4."
 *
 * ============================ NOTHING HERE COMMITS =======================
 *
 * The worlds are views. The commit belongs to the host — `commitOnboarding`
 * owns the only copy of it — so `Saving`, `PartiallyRefused` and `Failed`
 * depict states the host reports back, not states this component can enter on
 * its own.
 *
 * ============================ NOTHING HERE READS A CLOCK =================
 */
const meta = {
  title: 'vNext/Onboarding',
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

/**
 * The page inside a world.
 *
 * The intent is recorded on the wrapper so a browser test can observe the
 * EMISSION rather than a state change — these worlds are fixed views and
 * nothing behind them advances a step.
 */
function OnboardingHarness({ scenario }: { readonly scenario: OnboardingScenarioName }) {
  const [lastIntent, setLastIntent] = useState('')
  return (
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <div data-vnext-onboarding-host="" data-vnext-last-intent={lastIntent}>
        <VNextOnboarding
          view={onboardingScenarios[scenario]}
          onIntent={(intent) =>
            setLastIntent(
              intent.kind === 'toggle-follow'
                ? `follow:${intent.key}`
                : intent.kind === 'toggle-game'
                  ? `game:${intent.gameKey}`
                  : intent.kind === 'choose-club'
                    ? `club:${intent.teamId ?? 'none'}`
                    : intent.kind,
            )
          }
        />
      </div>
    </VNextShellProvider>
  )
}

function board(
  scenario: OnboardingScenarioName,
  widths: readonly string[],
  scale = 1,
  motion: VNextMotionSetting = 'system',
): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={widths} scale={scale} motion={motion}>
        <OnboardingHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
    parameters: { docs: { description: { story: onboardingScenarioPremises[scenario] } } },
  }
}

/** One world at one width — the addressable frames the browser suite reads. */
function frame(scenario: OnboardingScenarioName, viewport: string): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={[viewport]}>
        <OnboardingHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
  }
}

/* ========================================================================== *
 * A. THE FOUR STEPS
 * ========================================================================== */

export const FirstStep: Story = board('firstStep', ALL_WIDTHS, 0.42)
export const Clubs: Story = board('clubs', ALL_WIDTHS, 0.42)
export const Games: Story = board('games', ALL_WIDTHS, 0.42)
export const Review: Story = board('review', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * B. THE OUTCOMES THAT ARE STILL COMPLETE
 * ========================================================================== */

export const Resumed: Story = board('resumed', ['phone-375', 'laptop-1024'], 0.7)
export const NothingPublished: Story = board('nothingPublished', ['phone-375'], 0.9)
export const NoClubs: Story = board('noClubs', ['phone-375'], 0.9)
export const NoGames: Story = board('noGames', ['phone-375'], 0.9)
export const ChoseNothing: Story = board('reviewEmpty', ['phone-375', 'laptop-1024'], 0.7)

/* ========================================================================== *
 * C. WHAT THE HOST'S COMMIT REPORTS BACK
 * ========================================================================== */

export const Saving: Story = board('saving', ['phone-375'], 0.9)
export const PartiallyRefused: Story = board('partial', ['phone-375', 'laptop-1024'], 0.7)
export const Failed: Story = board('failed', ['phone-375'], 0.9)

/* ========================================================================== *
 * D. BEFORE AND INSTEAD OF THE STEPS
 * ========================================================================== */

export const Loading: Story = board('loading', ['phone-375'], 0.9)
export const Unavailable: Story = board('unavailable', ['phone-375'], 0.9)

/* ========================================================================== *
 * E. ADDRESSABLE FRAMES — one world, one width, for the browser suite
 * ========================================================================== */

export const FrameFirstStepPhone: Story = frame('firstStep', 'phone-375')
export const FrameFirstStepTablet: Story = frame('firstStep', 'tablet-768')
export const FrameFirstStepDesktop: Story = frame('firstStep', 'desktop-1920')
export const FrameClubsPhone: Story = frame('clubs', 'phone-375')
export const FrameGamesPhone: Story = frame('games', 'phone-375')
export const FrameGamesDesktop: Story = frame('games', 'desktop-1920')
export const FrameReviewPhone: Story = frame('review', 'phone-375')
export const FramePartialPhone: Story = frame('partial', 'phone-375')
