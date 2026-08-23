import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextShell } from '../app/VNextShell'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import { actionsScenarioPremises, actionsScenarios, shellScenarios } from '../fixtures'
import type { ActionsScenarioName } from '../fixtures'
import type { VNextShellActions } from '../app/VNextActionsProvider'

/**
 * vNEXT ACTION CENTRE — THE DURABLE FEED THE HUB CUTOVER LEFT BEHIND.
 *
 * ============================ WHY THIS SURFACE EXISTS AT ALL =============
 *
 * `player_action_items` is written by five server drivers and has had a
 * `pg_cron` caller since contract 172. Its only consumer was the legacy
 * `AppShell` AppBar — and Stage 14 made `vNextOwnsFrame` true for every Football
 * Hub destination, which is the branch of `AppShell` that renders no AppBar. So
 * `get_my_actions`, `mark_actions_seen` and `dismiss_action` were generated,
 * scheduled, granted and unreachable. This is the vNext consumer.
 *
 * ============================ IT IS NOT THE ATTENTION LAYER ==============
 *
 * `vNext/Shell` has worlds for the cross-competition attention control, and the
 * two are deliberately separate rather than a duplication anybody forgot to
 * remove. The attention layer answers *"what needs doing in a competition you
 * are not looking at"*, live, and excludes completed work on the stated ground
 * that a settled matchweek is news rather than a thing that needs you. This
 * answers *"what has the server recorded for you, and have you seen it"* —
 * which includes that news, and is the only one of the two with read state that
 * survives a change of device.
 *
 * ============================ WHAT A REVIEWER IS BEING ASKED =============
 *
 * Not "does it render". Four questions, and every world below exists to settle
 * one of them:
 *
 *   1. CAN IT TELL "WE HAVE NOT ASKED" FROM "THERE IS NOTHING"? Compare
 *      `Not loaded` against `Up to date`. They are one state apart and mean
 *      opposite things, and only the second may say a player is up to date.
 *   2. DOES IT EVER SAY MORE THAN THE SERVER DID? `Sparse context` is a whole
 *      panel of rows whose payloads carried less than the happy path. Every one
 *      must say LESS rather than render a zero — a settled matchweek reading
 *      "0 points banked" when the server sent no points is the defect this
 *      surface is most likely to have.
 *   3. IS EVERY STATE READABLE IN GREYSCALE AND ALOUD? Unread is a left edge, a
 *      mark AND the word "Unread"; a dismiss control names what it dismisses;
 *      the badge count is in the control's accessible name rather than only on
 *      screen.
 *   4. DOES A GROUP WITH NOTHING IN IT DRAW NOTHING? `Only work` and
 *      `Only news` are the pair — a heading over blank space has to be read
 *      every time to learn it has nothing to say.
 *
 * ============================ THE PANEL OPENS ITSELF HERE ================
 *
 * These worlds are about the PANEL, so the harness opens it on mount rather
 * than asking a reviewer to find and press a control in a scaled frame. The
 * control itself is still on screen behind the sheet, and `Many unread` is the
 * world to look at for the badge.
 *
 * Deterministic: fixtures only, no Supabase, no clock. `onOpen` is recorded on
 * the wrapper rather than performed, because marking seen is a server write.
 */

const meta = {
  title: 'vNext/Action Centre',
  component: WorkshopCanvas,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    viewports: {
      control: 'check',
      options: ['phone-375', 'phone-430', 'tablet-768', 'laptop-1024', 'laptop-1440'],
    },
  },
} satisfies Meta<typeof WorkshopCanvas>

export default meta

type Story = StoryObj

const ALL_WIDTHS = ['phone-375', 'phone-430', 'tablet-768', 'laptop-1024', 'laptop-1440']

/**
 * THE SHELL IN A WORLD, WITH THE PANEL OPEN.
 *
 * `openOnMount` presses the real control rather than setting overlay state from
 * outside, so the story exercises the same path a player does — including
 * `onOpen`, which is what records seen state in the connected product.
 */
function ActionCentreHarness({ scenario }: { readonly scenario: ActionsScenarioName }) {
  const [opened, setOpened] = useState(0)
  const [dismissed, setDismissed] = useState<string>('')

  const world = actionsScenarios[scenario]
  const actions: VNextShellActions = {
    ...world,
    // RECORDED, NOT PERFORMED. Marking seen is a server write and there is no
    // server here; a browser test reads the count off the wrapper instead.
    onOpen: () => setOpened((value) => value + 1),
    onDismiss: async (actionKey: string) => {
      setDismissed(actionKey)
    },
    onOpenItem: () => {},
    onRetry: () => {},
  }

  useEffect(() => {
    // The control exists twice — a bar copy and a rail copy, with CSS showing
    // exactly one. Pressing the visible one is what a player does.
    const control = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-vnext-shell-control="actions"]'),
    ).find((candidate) => candidate.offsetParent !== null)
    control?.click()
  }, [scenario])

  return (
    <div
      data-vnext-actions-host=""
      data-vnext-actions-opened={opened}
      data-vnext-actions-dismissed={dismissed}
    >
      <VNextShellProvider model={shellScenarios.fourCompetitions}>
        <VNextShell
          destination="home"
          actions={actions}
          header={<VNextPageHeader title="Home" />}
        >
          <p>Page content sits behind the sheet.</p>
        </VNextShell>
      </VNextShellProvider>
    </div>
  )
}

function board(scenario: ActionsScenarioName, scale = 0.42): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={ALL_WIDTHS} scale={scale}>
        <ActionCentreHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
    parameters: { docs: { description: { story: actionsScenarioPremises[scenario] } } },
  }
}

/* ========================================================================== *
 * A. THE ORDINARY SHAPES
 * ========================================================================== */

/**
 * THE ORDINARY MONDAY, AND THE ORDER IS THE SERVER'S.
 *
 * The LMS pick leads because a pick that is never made ELIMINATES the entrant,
 * where a missed matchweek only costs points. That ranking lives in the
 * migration as `priority`, and the surface consumes it rather than re-deciding
 * it — which is the whole reason the panel does not sort.
 */
export const BusyWeek: Story = board('busyWeek')

/** Nothing settled. The news heading must be absent, not empty. */
export const OnlyWork: Story = board('onlyWork')

/** Everything done, the weekend happened. The mirror, and the commoner one. */
export const OnlyNews: Story = board('onlyNews')

/* ========================================================================== *
 * B. THE PAIR THAT LOOK ALIKE AND MEAN OPPOSITE THINGS
 * ========================================================================== */

/**
 * THE SERVER HAS SAID THERE IS NOTHING.
 *
 * The only empty-looking world that may say "you are up to date".
 */
export const UpToDate: Story = board('upToDate')

/**
 * THE READ HAS NOT ANSWERED — AND MUST NOT CLAIM AN EMPTY INBOX.
 *
 * Put this beside `Up to date`. "Nothing is waiting for you" is a CLAIM, and
 * nobody has made it yet; a panel that said it here would be telling a player
 * their matchweek is fine before anything was asked.
 */
export const NotLoaded: Story = board('notLoaded')

/** The read failed with nothing loaded. A retry, never an empty inbox. */
export const Failed: Story = board('failed')

/**
 * AN EARLIER READ LANDED AND A LATER ONE FAILED.
 *
 * The rows stay, because the last thing the server actually said beats a blank
 * panel — and the panel says they may be stale rather than presenting them as
 * current. A blank panel here would read as "you are up to date", which is the
 * one thing a failure must never look like.
 */
export const StaleAfterFailure: Story = board('staleAfterFailure')

/* ========================================================================== *
 * C. THE WORLDS WHERE COPY INVENTS THINGS
 * ========================================================================== */

/**
 * EVERY ROW'S CONTEXT CARRIED LESS THAN THE HAPPY PATH.
 *
 * THE MOST IMPORTANT WORLD IN THIS FILE. A settled matchweek with no `points`
 * must say nothing rather than "0 points banked"; a card with no `fixtures`
 * must not say "0 to predict"; an outcome word this build does not know must
 * claim nothing. Read every line here and check it is backed by a field.
 */
export const SparseContext: Story = board('sparseContext')

/**
 * AN ACTION FOR A COMPETITION THE MEMBERSHIP READ DID NOT RETURN.
 *
 * Real and not an error. The row is SHOWN — a deadline the player cannot be
 * told the name of is still a deadline — and it must not be labelled with the
 * tournament id, because an id is not a name.
 */
export const UnknownCompetition: Story = board('unknownCompetition')

/**
 * A SIXTH GENERATOR THIS BUILD PREDATES.
 *
 * Filed as NEWS rather than as work: telling a player they owe something and
 * being unable to say what is worse than reporting it quietly. Shown rather
 * than hidden, because the server recorded something for this player.
 */
export const UnknownKind: Story = board('unknownKind')

/* ========================================================================== *
 * D. THE BADGE
 * ========================================================================== */

/**
 * MORE UNREAD THAN THE READ RETURNS.
 *
 * `get_my_actions` caps at fifty rows and counts `unseen` over the whole table,
 * so a badge derived from the rendered rows would quietly under-report — and
 * the migration's own comment says a badge that disagrees with the inbox it
 * opens is worse than no badge. The visible figure is capped so the data cannot
 * stretch the chrome; the accessible name carries the exact count, where there
 * is no layout to break.
 */
export const ManyUnread: Story = board('manyUnread')
