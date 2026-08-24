import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextAccount } from '../account/VNextAccount'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import type { VNextMotionSetting } from '../foundations/VNextRoot'
import {
  accountPushNotificationStates,
  accountScenarioPremises,
  accountScenarios,
  shellScenarios,
} from '../fixtures'
import type { AccountPushNotificationScenario, AccountScenarioName } from '../fixtures'

/**
 * vNEXT ACCOUNT / YOU — STAGE 13'S FIRST REVIEW SURFACE.
 *
 * ============================ WHAT A REVIEWER IS BEING ASKED =============
 *
 *   1. IS "A COMPETITION YOU FOLLOW" ACCEPTABLE? Open `UnnameableFollow`. That
 *      player really does follow that competition, and no read this page makes
 *      can name it. The alternatives are a uuid, a guess, or dropping the row —
 *      and this is the stage's binding decision, so disagreeing with it is the
 *      conversation to have.
 *   2. IS "YOU HAVE PICKED A FAVOURITE CLUB" ENOUGH? Open `FavouriteSet`.
 *      Naming the club is one competition-scoped read plus a fixture sweep per
 *      follow. If a reviewer wants the name, that is a cost decision, not an
 *      oversight.
 *   3. DOES ARCHIVED READ AS A FACT RATHER THAN A FAILURE? Open
 *      `ArchivedSeason`. It has no Open button because the server withheld the
 *      slug, not because anything went wrong.
 *   4. DO THE TWO PANELS FAIL SEPARATELY AND VISIBLY? `FollowsUnavailable`,
 *      `HistoryUnavailable` and `BothUnavailable`.
 *
 * ============================ NOTHING HERE IS IN A COMPETITION ===========
 *
 * The shell renders with `destination="none"`: Account is not one of the four
 * destinations, so none of them lights up. The harness supplies a one-
 * competition shell so the chrome is realistic; the PAGE is platform-scoped
 * either way.
 *
 * ============================ NOTHING HERE READS A CLOCK =================
 *
 * Every world carries a fixed `generatedAt`.
 */
const meta = {
  title: 'vNext/Account',
  component: WorkshopCanvas,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    motion: { control: 'inline-radio', options: ['system', 'full', 'reduced'] },
    viewports: {
      control: 'check',
      options: ['phone-375', 'phone-430', 'tablet-768', 'laptop-1024', 'laptop-1440', 'desktop-1920'],
    },
    scale: { control: { type: 'range', min: 0.2, max: 1, step: 0.02 } },
    theme: { control: 'inline-radio', options: ['dark', 'light', 'system'] },
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
 * Opening a season records the intent on the wrapper so a browser test can
 * observe the EMISSION rather than following a link — the shape Stage 9
 * settled. Nothing navigates: these worlds have no router behind them.
 */
function AccountHarness({
  scenario,
  push = 'promptable',
}: {
  readonly scenario: AccountScenarioName
  readonly push?: AccountPushNotificationScenario
}) {
  const [lastIntent, setLastIntent] = useState('')
  return (
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <div data-vnext-account-host="" data-vnext-last-intent={lastIntent}>
        <VNextAccount
          model={accountScenarios[scenario]}
          pushNotifications={accountPushNotificationStates[push]}
          onRetry={() => {}}
          // EVERY WRITE ACCEPTS AND NOTHING HAPPENS. A story must stay
          // deterministic, so these resolve `ok` without touching an account —
          // which is enough for the sheets, the switch and the disabled states
          // to be reviewable, and is why the REFUSAL paths are asserted in the
          // render tests where a refusing action can be handed in.
          actions={{
            setDisplayName: async () => ({ ok: true }),
            setPassword: async () => ({ ok: true }),
            setEmail: async () => ({ ok: true }),
            setReminderEmails: async () => ({ ok: true }),
            setPushNotifications: async () => ({ ok: true }),
          }}
          onIntent={(intent) =>
            setLastIntent(
              intent.kind === 'open-season'
                ? `open:${intent.competitionSlug}/${intent.seasonKey}`
                : intent.kind,
            )
          }
        />
      </div>
    </VNextShellProvider>
  )
}

function board(
  scenario: AccountScenarioName,
  widths: readonly string[],
  scale = 1,
  motion: VNextMotionSetting = 'system',
): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={widths} scale={scale} motion={motion}>
        <AccountHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
    parameters: { docs: { description: { story: accountScenarioPremises[scenario] } } },
  }
}

/** One world at one width — the addressable frames the browser suite reads. */
function frame(scenario: AccountScenarioName, viewport: string): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={[viewport]}>
        <AccountHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
  }
}

/* ========================================================================== *
 * A. THE ORDINARY ACCOUNT
 * ========================================================================== */

export const Ordinary: Story = board('ordinary', ALL_WIDTHS, 0.42)
export const EmailPending: Story = board('emailPending', ALL_WIDTHS, 0.42)
export const RemindersOff: Story = board('remindersOff', ALL_WIDTHS, 0.42)
export const SettingsUnavailable: Story = board('settingsUnavailable', ALL_WIDTHS, 0.42)
export const NoSupportAddress: Story = board('noSupportAddress', ALL_WIDTHS, 0.42)
export const EmailUnknown: Story = board('emailUnknown', ALL_WIDTHS, 0.42)
export const NewAccount: Story = board('newAccount', ALL_WIDTHS, 0.42)
export const ManyFollows: Story = board('manyFollows', ALL_WIDTHS, 0.42)

function pushState(state: AccountPushNotificationScenario): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={['phone-375', 'laptop-1024']} scale={0.7}>
        <AccountHarness scenario="ordinary" push={state} />
      </WorkshopCanvas>
    ),
  }
}

export const PushUnconfigured: Story = pushState('unconfigured')
export const PushUnsupported: Story = pushState('unsupported')
export const PushIosTab: Story = pushState('iosTab')
export const PushDenied: Story = pushState('denied')
export const PushPromptable: Story = pushState('promptable')
export const PushSubscribed: Story = pushState('subscribed')
export const PushUnavailable: Story = pushState('unavailable')

/* ========================================================================== *
 * B. THE THINGS THE PAGE WILL NOT SAY
 * ========================================================================== */

export const UnnameableFollow: Story = board('unnameableFollow', ['phone-375', 'laptop-1024'], 0.7)
export const FavouriteSet: Story = board('favouriteSet', ['phone-375', 'laptop-1024'], 0.7)
export const FollowWithoutRoute: Story = board('followWithoutRoute', ['phone-375'], 0.9)
export const ArchivedSeason: Story = board('archivedSeason', ['phone-375', 'laptop-1024'], 0.7)

/* ========================================================================== *
 * C. SEASONS AND RESULTS
 * ========================================================================== */

export const FinishedSeason: Story = board('finishedSeason', ['phone-375', 'laptop-1024'], 0.7)
export const ResultWithoutRank: Story = board('resultWithoutRank', ['phone-375'], 0.9)
export const MixedHistory: Story = board('mixedHistory', ['phone-375', 'laptop-1024'], 0.7)
export const PagedHistory: Story = board('pagedHistory', ['phone-375'], 0.9)

/* ========================================================================== *
 * D. WHEN A READ DOES NOT ANSWER
 * ========================================================================== */

export const FollowsUnavailable: Story = board('followsUnavailable', ['phone-375', 'laptop-1024'], 0.7)
export const HistoryUnavailable: Story = board('historyUnavailable', ['phone-375'], 0.9)
export const BothUnavailable: Story = board('bothUnavailable', ['phone-375'], 0.9)
export const NoDisplayName: Story = board('noDisplayName', ['phone-375'], 0.9)

/* ========================================================================== *
 * E. ADDRESSABLE FRAMES — one world, one width, for the browser suite
 * ========================================================================== */

export const FrameOrdinaryPhone: Story = frame('ordinary', 'phone-375')
export const FrameOrdinaryTablet: Story = frame('ordinary', 'tablet-768')
export const FrameOrdinaryDesktop: Story = frame('ordinary', 'desktop-1920')
export const FrameManyFollowsPhone: Story = frame('manyFollows', 'phone-375')
export const FrameUnnameablePhone: Story = frame('unnameableFollow', 'phone-375')
export const FrameArchivedPhone: Story = frame('archivedSeason', 'phone-375')
export const FrameNewAccountPhone: Story = frame('newAccount', 'phone-375')
export const FrameBothUnavailablePhone: Story = frame('bothUnavailable', 'phone-375')
export const FrameFinishedPhone: Story = frame('finishedSeason', 'phone-375')
export const FrameEmailPendingPhone: Story = frame('emailPending', 'phone-375')
export const FrameEmailPendingDesktop: Story = frame('emailPending', 'desktop-1920')
export const FrameSettingsUnavailablePhone: Story = frame('settingsUnavailable', 'phone-375')
export const FrameNoSupportPhone: Story = frame('noSupportAddress', 'phone-375')

/* ========================================================================== *
 * F. THE LIGHT THEME
 *
 * The board pins DARK by default so a screenshot does not depend on the
 * reviewer's operating system. This is how the other theme is seen: on purpose,
 * side by side with the same worlds above.
 * ========================================================================== */

export const LightOrdinary: Story = {
  render: (args) => (
    <WorkshopCanvas {...args} viewports={['phone-375', 'laptop-1024']} scale={0.7} theme="light">
      <AccountHarness scenario="ordinary" />
    </WorkshopCanvas>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The ordinary account in the light theme. The ramp is designed rather than inverted: the page is tinted and a card is white, which is the opposite move to dark, where a card is lighter than a near-black page.',
      },
    },
  },
}

export const LightBothUnavailable: Story = {
  render: (args) => (
    <WorkshopCanvas {...args} viewports={['phone-375']} scale={0.9} theme="light">
      <AccountHarness scenario="bothUnavailable" />
    </WorkshopCanvas>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Both reads failed, in light. Failure states are where a second theme usually breaks first, because they are the states nobody opens while choosing colours.',
      },
    },
  },
}
