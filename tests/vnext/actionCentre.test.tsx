import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { describe, expect, it, vi } from 'vitest'
import { VNextShell } from '../../src/vnext/app/VNextShell'
import type { VNextShellActions } from '../../src/vnext/app/VNextActionsProvider'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import {
  actionsScenarioNames,
  actionsScenarioPremises,
  actionsScenarios,
  shellScenarios,
} from '../../src/vnext/fixtures'
import type { VNextActionItem, VNextActionsModel } from '../../src/vnext/models/actions'

/**
 * THE ACTION CENTRE AS THE PLAYER MEETS IT.
 *
 * The Football Hub cutover made `vNextOwnsFrame` true for every Hub
 * destination, and that branch of `AppShell` renders no AppBar — so the legacy
 * Action Centre stopped mounting and `get_my_actions` had no reachable consumer
 * in the production frame. These cases hold the promises the replacement must
 * keep:
 *
 *   1. A FEED THAT HAS NOT LANDED NEVER READS AS AN EMPTY ONE.
 *   2. Seen state is recorded when the panel is OPENED.
 *   3. Work and news are separate, and an empty group draws no heading.
 *   4. Nothing is claimed that the payload did not carry.
 *   5. Every state is in words as well as in colour.
 *   6. No host, no control at all — a story is not a degraded product.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const FAIL_IMPACTS = new Set(['critical', 'serious'])
const JSDOM_CANNOT_EVALUATE = new Set(['color-contrast'])

function item(over: Partial<VNextActionItem> = {}): VNextActionItem {
  return {
    key: 'a',
    kind: 'lms-pick-due',
    actionClass: 'needs-you',
    game: 'last-man-standing',
    contextId: 'tournament-1',
    competitionId: 'comp-1',
    competitionName: 'Caledonian Premiership',
    headline: 'Pick your club for Round 9',
    detail: null,
    deadlineAt: null,
    seen: false,
    ...over,
  }
}

function model(items: readonly VNextActionItem[], unseen?: number): VNextActionsModel {
  return {
    unseen: unseen ?? items.filter((entry) => !entry.seen).length,
    items,
  }
}

function actions(over: Partial<VNextShellActions> = {}): VNextShellActions {
  return { model: model([item()]), status: 'ready', ...over }
}

function renderShell(supplied: VNextShellActions | undefined) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextShell destination="home" actions={supplied}>
          <p>Page content</p>
        </VNextShell>
      </VNextShellProvider>
    </VNextRoot>,
  )
}

/** The control exists twice — a bar copy and a rail copy, with CSS showing one. */
function controls(): HTMLElement[] {
  return screen.getAllByRole('button', { name: /^Updates/ })
}

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(controls()[0]!)
  return screen.getByRole('dialog')
}

describe('the Action Centre', () => {
  it('gives the shell a way in', () => {
    renderShell(actions())
    expect(controls().length).toBeGreaterThan(0)
  })

  it('draws no control at all where no host supplied a feed', () => {
    // A story, a render test or a /dev harness. Not a degraded product: a
    // control opening an empty panel would be worse than no control.
    renderShell(undefined)
    expect(screen.queryAllByRole('button', { name: /^Updates/ })).toHaveLength(0)
  })

  it('puts the unread count in the accessible name, not only on screen', () => {
    renderShell(actions({ model: model([item({ seen: false })], 3) }))
    expect(controls()[0]).toHaveAccessibleName('Updates, 3 unread')
  })

  it('shows no count while the feed has not landed', () => {
    // Zero is the claim "nothing is unread" and the read has not made it.
    renderShell(actions({ model: null, status: 'loading' }))
    expect(controls()[0]).toHaveAccessibleName('Updates')
  })

  it('shows no count when the server says everything is read', () => {
    renderShell(actions({ model: model([item({ seen: true })], 0) }))
    expect(controls()[0]).toHaveAccessibleName('Updates')
  })

  it('caps the visible badge but keeps the exact figure in the name', () => {
    renderShell(actions({ model: model([item()], 250) }))
    expect(controls()[0]).toHaveAccessibleName('Updates, 250 unread')
    expect(screen.getAllByText('99+').length).toBeGreaterThan(0)
  })

  it('records seen state when the panel is opened', async () => {
    const onOpen = vi.fn()
    const user = userEvent.setup()
    renderShell(actions({ onOpen }))

    await openPanel(user)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('does not record seen state merely by rendering the control', () => {
    const onOpen = vi.fn()
    renderShell(actions({ onOpen }))
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('never says the inbox is empty before the read has answered', async () => {
    const user = userEvent.setup()
    renderShell(actions({ model: null, status: 'loading' }))

    const panel = await openPanel(user)
    expect(within(panel).queryByText(/up to date/i)).not.toBeInTheDocument()
    expect(panel.querySelector('[data-vnext-actions-state="loading"]')).not.toBeNull()
  })

  it('says the inbox is empty once the server has said so', async () => {
    const user = userEvent.setup()
    renderShell(actions({ model: model([]), status: 'ready' }))

    const panel = await openPanel(user)
    expect(within(panel).getByText(/up to date/i)).toBeInTheDocument()
  })

  it('offers a retry when the read failed and nothing had loaded', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    renderShell(actions({ model: null, status: 'failed', onRetry }))

    const panel = await openPanel(user)
    await user.click(within(panel).getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('keeps a stale list and says it is stale', async () => {
    const user = userEvent.setup()
    renderShell(actions({ model: model([item()]), status: 'failed' }))

    const panel = await openPanel(user)
    expect(within(panel).getByText('Pick your club for Round 9')).toBeInTheDocument()
    expect(within(panel).getByText(/out of date/i)).toBeInTheDocument()
  })

  it('separates what needs the player from what merely happened', async () => {
    const user = userEvent.setup()
    renderShell(
      actions({
        model: model([
          item({ key: 'w', actionClass: 'needs-you', headline: 'Pick your club' }),
          item({
            key: 'n',
            actionClass: 'news',
            kind: 'matchweek-settled',
            headline: 'Matchweek 3 is settled',
            detail: '47 points banked',
          }),
        ]),
      }),
    )

    const panel = await openPanel(user)
    expect(within(panel).getByRole('heading', { name: 'Needs you' })).toBeInTheDocument()
    expect(
      within(panel).getByRole('heading', { name: /Since you were last here/i }),
    ).toBeInTheDocument()
  })

  it('draws no heading over a group with nothing in it', async () => {
    const user = userEvent.setup()
    renderShell(actions({ model: model([item({ actionClass: 'needs-you' })]) }))

    const panel = await openPanel(user)
    expect(within(panel).getByRole('heading', { name: 'Needs you' })).toBeInTheDocument()
    expect(
      within(panel).queryByRole('heading', { name: /Since you were last here/i }),
    ).not.toBeInTheDocument()
  })

  it('marks an unread row in words and not only with a colour', async () => {
    const user = userEvent.setup()
    renderShell(actions({ model: model([item({ seen: false })]) }))

    const panel = await openPanel(user)
    expect(within(panel).getByText(/Unread\./)).toBeInTheDocument()
  })

  it('names the competition an item belongs to', async () => {
    const user = userEvent.setup()
    renderShell(actions())

    const panel = await openPanel(user)
    expect(within(panel).getByText('Caledonian Premiership')).toBeInTheDocument()
  })

  it('says a competition is unknown rather than showing its id', async () => {
    const user = userEvent.setup()
    renderShell(actions({ model: model([item({ competitionName: null })]) }))

    const panel = await openPanel(user)
    expect(within(panel).queryByText('tournament-1')).not.toBeInTheDocument()
    expect(within(panel).getByText(/A competition you play in/i)).toBeInTheDocument()
  })

  it('draws no detail where the payload carried none', async () => {
    const user = userEvent.setup()
    renderShell(actions({ model: model([item({ detail: null })]) }))

    const panel = await openPanel(user)
    const row = panel.querySelector('[data-vnext-action-kind="lms-pick-due"]')!
    // The headline and the competition, and nothing invented between them.
    expect(within(row as HTMLElement).getByText('Pick your club for Round 9')).toBeInTheDocument()
  })

  it('renders a row as plain information where nothing can be opened', async () => {
    const user = userEvent.setup()
    renderShell(actions({ onOpenItem: undefined }))

    const panel = await openPanel(user)
    // NOT A DISABLED BUTTON. A greyed control promises a destination that does
    // not exist.
    expect(within(panel).queryAllByRole('button', { name: /Pick your club/ })).toHaveLength(0)
    expect(within(panel).getByText('Pick your club for Round 9')).toBeInTheDocument()
  })

  it('takes the player to an item where a destination exists', async () => {
    const onOpenItem = vi.fn()
    const user = userEvent.setup()
    renderShell(actions({ onOpenItem }))

    const panel = await openPanel(user)
    await user.click(within(panel).getByRole('button', { name: /Pick your club/ }))
    expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ key: 'a' }))
  })

  it('draws a row with no destination as information even when a host offers to open', async () => {
    // THE DEFECT THIS GUARDS. A host supplies one `onOpenItem` for the whole
    // panel, but not every row has somewhere to go — a `game_key` with no vNext
    // surface, or a kind this build cannot read. Drawing those as buttons gives
    // the player a control that does nothing when pressed.
    const onOpenItem = vi.fn()
    const user = userEvent.setup()
    renderShell(
      actions({
        onOpenItem,
        model: model([
          item({ key: 'routable', headline: 'Pick your club' }),
          item({
            key: 'unroutable',
            kind: 'game-consequence',
            actionClass: 'news',
            game: null,
            headline: 'Your game moved on',
          }),
        ]),
      }),
    )

    const panel = await openPanel(user)
    expect(within(panel).getByRole('button', { name: /Pick your club/ })).toBeInTheDocument()
    expect(
      within(panel).queryAllByRole('button', { name: /Your game moved on/ }),
    ).toHaveLength(0)
    // Still shown — the server recorded it for this player.
    expect(within(panel).getByText('Your game moved on')).toBeInTheDocument()
  })

  it('draws a row for an unnamed competition as information, because it has no address', async () => {
    // `competitionName` is null exactly when the membership read did not return
    // that tournament id — and that list is the only thing that turns the id
    // into a URL. So a null name and an unresolvable route are one fact.
    const user = userEvent.setup()
    renderShell(
      actions({
        onOpenItem: vi.fn(),
        model: model([item({ competitionName: null, headline: 'Pick your club' })]),
      }),
    )

    const panel = await openPanel(user)
    expect(within(panel).queryAllByRole('button', { name: /Pick your club/ })).toHaveLength(0)
  })

  it('opens a settled matchweek, which is addressable even with no game route', async () => {
    const onOpenItem = vi.fn()
    const user = userEvent.setup()
    renderShell(
      actions({
        onOpenItem,
        model: model([
          item({
            key: 's',
            kind: 'matchweek-settled',
            actionClass: 'news',
            game: 'match-predictor',
            headline: 'Matchweek 11 is settled',
          }),
        ]),
      }),
    )

    const panel = await openPanel(user)
    await user.click(within(panel).getByRole('button', { name: /Matchweek 11 is settled/ }))
    expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ key: 's' }))
  })

  it('closes the panel when a row is opened', async () => {
    // WITHOUT THIS THE SHEET SITS OVER THE DESTINATION. `navigate` is a no-op
    // for the route the player is already on, so opening a Match Predictor
    // action from the Match Predictor did nothing visible at all — the panel
    // stayed exactly where it was and the press looked broken.
    const onOpenItem = vi.fn()
    const user = userEvent.setup()
    renderShell(actions({ onOpenItem }))

    const panel = await openPanel(user)
    await user.click(within(panel).getByRole('button', { name: /Pick your club/ }))

    expect(onOpenItem).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('leaves the panel open when a row is dismissed', async () => {
    // THE OPPOSITE RULE, AND BOTH MATTER. Dismissing is housekeeping done
    // inside the panel; closing it would throw the player out of the list they
    // are still working through.
    const user = userEvent.setup()
    renderShell(actions({ onDismiss: vi.fn(async () => {}) }))

    const panel = await openPanel(user)
    await user.click(within(panel).getByRole('button', { name: /^Dismiss:/ }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('names what a dismiss control dismisses', async () => {
    const user = userEvent.setup()
    renderShell(actions({ onDismiss: vi.fn(async () => {}) }))

    const panel = await openPanel(user)
    expect(
      within(panel).getByRole('button', { name: 'Dismiss: Pick your club for Round 9' }),
    ).toBeInTheDocument()
  })

  it('says so when a dismissal fails, and keeps the row', async () => {
    const onDismiss = vi.fn(async () => Promise.reject(new Error('refused')))
    const user = userEvent.setup()
    renderShell(actions({ onDismiss }))

    const panel = await openPanel(user)
    await user.click(within(panel).getByRole('button', { name: /^Dismiss:/ }))

    expect(await within(panel).findByText(/could not be dismissed/i)).toBeInTheDocument()
    expect(within(panel).getByText('Pick your club for Round 9')).toBeInTheDocument()
  })

  describe('every deterministic world', () => {
    // ITERATED RATHER THAN LISTED, so a world added to the registry is covered
    // the moment it exists. A fixture nothing renders is a fixture that drifts.
    it.each(actionsScenarioNames)('opens and renders: %s', async (name) => {
      const user = userEvent.setup()
      const { unmount } = renderShell(actionsScenarios[name])

      try {
        const panel = await openPanel(user)
        expect(panel).toBeInTheDocument()

        // NO WORLD MAY RENDER A BARE ZERO WHERE THE SERVER SENT NOTHING. This
        // is the sparse-context defect stated as a rule over every world rather
        // than checked in the one place it was expected: "0 points banked" and
        // "0 fixtures" are sentences no payload here supports.
        expect(panel.textContent ?? '').not.toMatch(/\b0 (points banked|fixtures? to predict)\b/)

        // Every world has a stated premise, so a reviewer reading the story and
        // a developer reading the test see the same reason it exists.
        expect(actionsScenarioPremises[name]).toBeTruthy()
      } finally {
        unmount()
      }
    })

    it('never claims an empty inbox before the read has answered', async () => {
      // The pair, asserted against the registry rather than against a literal:
      // exactly the worlds whose model is null must withhold the claim, and the
      // one that has a model and no items must make it.
      for (const name of actionsScenarioNames) {
        const world = actionsScenarios[name]
        const user = userEvent.setup()
        const { unmount } = renderShell(world)

        try {
          const panel = await openPanel(user)
          const claimsEmpty = /up to date/i.test(panel.textContent ?? '')
          expect(claimsEmpty, `${name} made the wrong claim`).toBe(
            world.model !== null && world.model.items.length === 0,
          )
        } finally {
          unmount()
        }
      }
    })
  })

  it('meets the accessibility floor with the panel open', async () => {
    const user = userEvent.setup()
    const { unmount } = renderShell(
      actions({
        onDismiss: vi.fn(async () => {}),
        onOpenItem: vi.fn(),
        model: model([
          item({ key: 'w' }),
          item({
            key: 'n',
            actionClass: 'news',
            kind: 'matchweek-settled',
            headline: 'Matchweek 3 is settled',
            detail: '47 points banked',
            seen: true,
          }),
        ]),
      }),
    )

    try {
      await openPanel(user)
      const results = await axe.run(document.body, {
        runOnly: { type: 'tag', values: TAGS },
      })
      const failing = [
        ...results.violations,
        ...results.incomplete.filter((result) => !JSDOM_CANNOT_EVALUATE.has(result.id)),
      ].filter((result) => result.impact && FAIL_IMPACTS.has(result.impact))

      expect(
        failing,
        failing.map((violation) => `${violation.id}: ${violation.help}`).join('\n'),
      ).toEqual([])
    } finally {
      unmount()
    }
  })
})
