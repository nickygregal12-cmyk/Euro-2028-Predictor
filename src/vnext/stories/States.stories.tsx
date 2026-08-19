import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  VNextAccessRefused,
  VNextLoadingRows,
  VNextNotFound,
  VNextNotice,
} from '../integration/states/VNextStates'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import { shellScenarios } from '../fixtures'

/**
 * vNEXT GENERIC STATES — STAGE 13'S SHARED SURFACE.
 *
 * ============================ WHAT A REVIEWER IS BEING ASKED =============
 *
 *   1. DOES THE NAVIGATION TELL THE TRUTH? Open `ChampionshipFailed` and
 *      `AccountFailed`. Until this stage both of these lit up LEAGUES, because
 *      the shared notice hard-coded `destination="leagues"` and no caller could
 *      change it. A page that cannot show its content is exactly when a player
 *      reads the navigation to work out where they are.
 *   2. IS NOT-FOUND A PARENT RATHER THAN AN APOLOGY? Open `NotFound`. The route
 *      matrix asks for "a deterministic parent from a not-found", so the full
 *      navigation is there and no destination is lit — the player is nowhere in
 *      particular, which is true.
 *   3. IS ACCESS-REFUSED DISTINCT FROM BOTH? Open `AccessRefused`. A signed-in
 *      player told "sign in" or "not found" for a thing that exists and is not
 *      theirs learns the app is broken.
 *   4. DOES THE SKELETON SHOW A NUMBER ANYWHERE? It must not. A skeleton with
 *      "1, 2, 3" down the left is a placeholder somebody reads as a rank.
 */
const meta = {
  title: 'vNext/States',
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

const WIDTHS = ['phone-375', 'laptop-1024'] as const

function board(children: React.ReactNode, premise: string, widths: readonly string[] = WIDTHS): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={widths} scale={0.7}>
        <VNextShellProvider model={shellScenarios.oneCompetition}>{children}</VNextShellProvider>
      </WorkshopCanvas>
    ),
    parameters: { docs: { description: { story: premise } } },
  }
}

/* ========================================================================== *
 * A. THE NAVIGATION TELLS THE TRUTH
 * ========================================================================== */

export const ChampionshipFailed: Story = board(
  <VNextNotice
    destination="games"
    heading="Predictor Championship"
    title="We could not load this Championship"
    body="The draw is there — we just could not read it just now. Trying again usually works."
    onRetry={() => {}}
  />,
  'A Championship that would not load. It lights GAMES, which is where the Championship lives. Until this stage it lit Leagues.',
)

export const AccountFailed: Story = board(
  <VNextNotice
    destination="none"
    heading="You"
    title="Sign in to see your account"
    body="Your competitions, your seasons and your settings live with your account."
  />,
  'Account, which is not one of the four destinations. Nothing lights up, which is true — the player is not inside a competition.',
)

export const LeaguesFailed: Story = board(
  <VNextNotice
    destination="leagues"
    heading="Leagues"
    title="We could not load these standings"
    body="The league is there — we just could not read it just now."
    onRetry={() => {}}
  />,
  'The one surface for which the old hard-coded destination happened to be right.',
)

/* ========================================================================== *
 * B. THE STATES STAGE 13 ADDED
 * ========================================================================== */

export const NotFound: Story = board(
  <VNextNotFound onHome={() => {}} />,
  'The matrix’s `*` row. A parent rather than an apology: the full navigation, no destination lit, and no guess at what the player meant.',
)

export const AccessRefused: Story = board(
  <VNextAccessRefused onBack={() => {}} />,
  'Signed in, and this one is not theirs. Not a not-found and not a sign-in prompt — and it names nothing about what it is refusing, because a refusal that describes what it protects is a disclosure.',
)

export const AccessRefusedInAGame: Story = board(
  <VNextAccessRefused heading="Last Man Standing" destination="games" onBack={() => {}} />,
  'The same refusal reached from inside a game, so the navigation still says where the player is.',
)

/* ========================================================================== *
 * C. LOADING
 * ========================================================================== */

export const LoadingRows: Story = board(
  <VNextLoadingRows heading="Leagues" destination="leagues" label="Loading standings" />,
  'Bars only. Not one digit anywhere, and no bar wide enough to look like a person’s name.',
)

export const LoadingShort: Story = board(
  <VNextLoadingRows heading="Games" destination="games" label="Loading games" rows={3} />,
  'The same skeleton, shorter. The row count is the caller’s, because a five-row skeleton over a three-row page is its own small lie.',
)

/* ========================================================================== *
 * D. ADDRESSABLE FRAMES
 * ========================================================================== */

export const FrameNotFoundPhone: Story = board(<VNextNotFound onHome={() => {}} />, '', ['phone-375'])
export const FrameAccessRefusedPhone: Story = board(<VNextAccessRefused onBack={() => {}} />, '', ['phone-375'])
export const FrameLoadingPhone: Story = board(
  <VNextLoadingRows heading="Leagues" destination="leagues" />,
  '',
  ['phone-375'],
)
