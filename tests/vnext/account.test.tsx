import { describe, expect, it, vi } from 'vitest'
import { expectNoAxeViolations } from './vnextAxe'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { VNextAccount } from '../../src/vnext/account/VNextAccount'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { accountScenarioNames, accountScenarios, shellScenarios } from '../../src/vnext/fixtures'
import type { AccountActions } from '../../src/vnext/account/VNextAccount'
import type { AccountPageModel } from '../../src/vnext/models/account'

/** A host that can do everything, so a case can be about the page. */
function allActions(over: Partial<AccountActions> = {}): AccountActions {
  const ok = async () => ({ ok: true }) as const
  return {
    setDisplayName: ok,
    setPassword: ok,
    setEmail: ok,
    setReminderEmails: ok,
    ...over,
  }
}

function renderAccount(
  model: AccountPageModel,
  props: {
    onRetry?: () => void
    refreshing?: boolean
    onIntent?: (intent: { kind: string }) => void
    actions?: AccountActions
  } = {},
) {
  return render(
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <VNextAccount model={model} {...props} />
    </VNextShellProvider>,
  )
}

const zone = (name: string) =>
  document.querySelector(`[data-vnext-zone="${name}"]`) as HTMLElement | null

describe('every world is a page', () => {
  it.each(accountScenarioNames)('%s has one main and one h1', (name) => {
    renderAccount(accountScenarios[name])
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  /**
   * EVERY WORLD MUST BE A STATE `buildAccountModel` CAN PRODUCE.
   *
   * These are the pairing rules the mapper enforces, asserted over all the
   * worlds at once so a new one cannot be added in an impossible state.
   */
  it.each(accountScenarioNames)('%s pairs its panels lawfully', (name) => {
    const world = accountScenarios[name]

    if (world.follows.kind === 'follows') {
      // `empty` is the mapper's answer to no follows, so a `follows` panel is
      // never empty.
      expect(world.follows.competitions.length).toBeGreaterThan(0)
      for (const competition of world.follows.competitions) {
        // A NAMED FOLLOW CARRIES BOTH NAMES. The mapper has no path that
        // produces one without the other.
        if (competition.identity.kind === 'named') {
          expect(competition.identity.competitionName).toBeTruthy()
          expect(competition.identity.seasonName).toBeTruthy()
        }
        // AN UNNAMED FOLLOW CARRIES NO ROUTE, because a route comes from a read
        // that would also have supplied a name.
        if (competition.identity.kind === 'unnamed') {
          expect(Object.keys(competition.identity)).toEqual(['kind'])
        }
      }
    }

    if (world.history.kind === 'seasons') {
      expect(world.history.seasons.length).toBeGreaterThan(0)
      // THE SERVER'S PAGING IS CONSISTENT WITH ITSELF: it never sends more rows
      // than it counts, and `hasMore` and the total agree.
      expect(world.history.seasons.length).toBeLessThanOrEqual(world.history.total)
      if (world.history.hasMore) {
        expect(world.history.total).toBeGreaterThan(world.history.seasons.length)
      }
      for (const season of world.history.seasons) {
        // BOTH HALVES OF AN ADDRESS OR NEITHER.
        if (season.route !== null) {
          expect(season.route.competitionSlug).toBeTruthy()
          expect(season.route.seasonKey).toBeTruthy()
        }
      }
    }
  })
})

describe('a follow the page cannot name', () => {
  it('says so in a sentence rather than showing an id', () => {
    const { container } = renderAccount(accountScenarios.unnameableFollow)
    expect(screen.getByText('A competition you follow')).toBeInTheDocument()
    expect(container.textContent).toMatch(/cannot show its name/i)
    // The tournament id must not have reached the page.
    expect(container.textContent).not.toContain('t-gone')
  })

  it('offers no way to open a competition it cannot name', () => {
    const { container } = renderAccount(accountScenarios.unnameableFollow)
    const row = container.querySelector('[data-vnext-follow="unnamed"]') as HTMLElement
    expect(within(row).queryByRole('button')).toBeNull()
  })

  it('never renders a uuid on any world', () => {
    for (const name of accountScenarioNames) {
      const { container, unmount } = renderAccount(accountScenarios[name])
      // The fixture ids are `t-…`; none of them is a thing to show a player.
      expect(container.textContent, name).not.toMatch(/\bt-[a-z0-9]+\b/)
      unmount()
    }
  })
})

describe('the favourite club is a fact, never a club', () => {
  it('says a favourite is picked without naming one', () => {
    renderAccount(accountScenarios.favouriteSet)
    expect(zone('favourite')?.textContent).toMatch(/picked a favourite club/i)
  })

  it('says nothing at all where no favourite is set', () => {
    renderAccount(accountScenarios.ordinary)
    expect(zone('favourite')).toBeNull()
  })
})

describe('a season is openable only where the server supplied an address', () => {
  it('offers a button for a routable season', () => {
    const onIntent = vi.fn()
    renderAccount(accountScenarios.ordinary, { onIntent })
    const buttons = screen.getAllByRole('button', { name: /open/i })
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement)
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'open-season',
      competitionSlug: 'caledonian',
      seasonKey: '2027-28',
    })
  })

  it('offers no button for an archived season, and says archived', () => {
    const { container } = renderAccount(accountScenarios.archivedSeason)
    const row = container.querySelector('[data-vnext-season="t-arch"]') as HTMLElement
    expect(within(row).queryByRole('button')).toBeNull()
    expect(zone('archived')?.textContent).toMatch(/archived/i)
  })
})

describe('a result is the stored snapshot, printed as sent', () => {
  it('prints points, rank and field size where all three exist', () => {
    renderAccount(accountScenarios.finishedSeason)
    const result = zone('result')?.textContent ?? ''
    expect(result).toContain('412')
    expect(result).toContain('3')
    expect(result).toContain('28')
    expect(result).toContain('38 matchweeks')
  })

  it('prints no rank at all where the snapshot has none', () => {
    renderAccount(accountScenarios.resultWithoutRank)
    const result = zone('result')?.textContent ?? ''
    expect(result).toContain('88')
    expect(result).not.toMatch(/finished/i)
  })

  it('shows no result for a season still in progress', () => {
    renderAccount(accountScenarios.ordinary)
    expect(zone('result')).toBeNull()
  })
})

describe('the two panels are independent', () => {
  it('keeps the history when the follows read failed', () => {
    renderAccount(accountScenarios.followsUnavailable)
    expect(screen.getByText(/could not load what you follow/i)).toBeInTheDocument()
    expect(zone('history')).not.toBeNull()
    expect(screen.queryByText(/could not load your seasons/i)).toBeNull()
  })

  it('keeps the follows when the history read failed', () => {
    renderAccount(accountScenarios.historyUnavailable)
    expect(screen.getByText(/could not load your seasons/i)).toBeInTheDocument()
    expect(screen.queryByText(/could not load what you follow/i)).toBeNull()
  })

  it('distinguishes an empty account from a failed read, in words', () => {
    renderAccount(accountScenarios.newAccount)
    expect(screen.getByText(/not following any competitions yet/i)).toBeInTheDocument()
    expect(screen.getByText(/have not played a season yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/could not load/i)).toBeNull()
  })

  it('offers a retry on each failed panel, and only where one was given', () => {
    const onRetry = vi.fn()
    renderAccount(accountScenarios.bothUnavailable, { onRetry })
    const retries = screen.getAllByRole('button', { name: /try again/i })
    expect(retries).toHaveLength(2)
    fireEvent.click(retries[0] as HTMLElement)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('offers no retry when the host supplied none', () => {
    renderAccount(accountScenarios.bothUnavailable)
    expect(screen.queryAllByRole('button', { name: /try again/i })).toHaveLength(0)
  })
})

describe('order, grouping and paging are the server’s', () => {
  it('groups by whether a season finished, keeping each group’s order', () => {
    renderAccount(accountScenarios.mixedHistory)
    const ongoing = zone('ongoing')?.textContent ?? ''
    const finished = zone('finished')?.textContent ?? ''
    expect(ongoing.indexOf('Season A')).toBeLessThan(ongoing.indexOf('Season C'))
    expect(finished).toContain('Season B')
    expect(ongoing).not.toContain('Season B')
  })

  it('says how many seasons exist rather than truncating quietly', () => {
    renderAccount(accountScenarios.pagedHistory)
    expect(zone('has-more')?.textContent).toMatch(/1 of 9/)
  })

  it('says nothing about paging when there is no more', () => {
    renderAccount(accountScenarios.ordinary)
    expect(zone('has-more')).toBeNull()
  })
})

describe('the page never invents an identity', () => {
  it('renders without a display name rather than inventing one', () => {
    const { container } = renderAccount(accountScenarios.noDisplayName)
    expect(container.textContent).not.toMatch(/Ada Lovelace/)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})


describe('every world passes the accessibility scan', () => {
  it.each(accountScenarioNames)('%s has no critical or serious violation', async (name) => {
    await expectNoAxeViolations(
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        {/* `onIntent` is supplied so the sign-out section is IN the scan. It
            renders only for a host that can perform the intent, so scanning
            without one silently excluded the stage's only new account
            control. */}
        <VNextAccount
          model={accountScenarios[name]}
          onRetry={() => {}}
          onIntent={() => {}}
        />
      </VNextShellProvider>,
    )
  })
})

describe('signing out', () => {
  it('offers the control, and asks the host to perform it', () => {
    const onIntent = vi.fn()
    renderAccount(accountScenarios.ordinary, { onIntent })
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onIntent).toHaveBeenCalledWith({ kind: 'sign-out' })
  })

  it('offers nothing where no host can perform it', () => {
    // A story or a preview with no `onIntent` gets a page with no sign-out,
    // rather than a button that silently does nothing. The lane's rule about
    // controls the server would refuse, applied to a control the HOST would
    // refuse.
    renderAccount(accountScenarios.ordinary)
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
  })

  it('heads no details section a host supplied no writes for', () => {
    // Stage 13's rule, kept now that the section can be filled: a host that
    // cannot perform a write gets no control for it and no heading over the
    // space where one would be. An empty "Your details" is worse than none.
    renderAccount(accountScenarios.ordinary, { onIntent: vi.fn() })
    expect(document.querySelector('[data-vnext-zone="settings"]')).toBeNull()
    const page = screen.getByRole('main').textContent ?? ''
    expect(page).not.toMatch(/reminder emails|display name|change your/i)
  })
})

/* ==========================================================================
   YOUR DETAILS — capability parity without the legacy layout
   ========================================================================== */

describe('the details a player can change', () => {
  it('states what each one holds now, rather than opening a form for it', () => {
    // WHY THIS IS THE ASSERTION. The legacy page opens four forms at once, and
    // a player who came to check which address their emails go to has to read
    // past three empty inputs to find out. A row STATES the value.
    renderAccount(accountScenarios.ordinary, { actions: allActions() })
    const panel = zone('settings')!
    expect(within(panel).getByText('ada@example.test')).toBeInTheDocument()
    expect(within(panel).getByText('Ada Lovelace')).toBeInTheDocument()
    // And no form is open until one is asked for.
    expect(document.querySelector('[data-vnext-zone="settings-sheet"]')).toBeNull()
    expect(within(panel).queryByRole('textbox')).toBeNull()
  })

  it('opens ONE sheet about ONE thing', () => {
    renderAccount(accountScenarios.ordinary, { actions: allActions() })
    fireEvent.click(document.querySelector('[data-vnext-setting="email"]') as HTMLElement)

    const sheet = zone('settings-sheet')!
    expect(sheet.dataset.job).toBe('email')
    // ONE field. Three behind one backdrop would be the legacy page with a
    // scrim in front of it.
    expect(within(sheet).getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'Change your email address' })).toBeInTheDocument()
  })

  it('names the button after the job, never just "Save"', () => {
    renderAccount(accountScenarios.ordinary, { actions: allActions() })
    fireEvent.click(document.querySelector('[data-vnext-setting="password"]') as HTMLElement)
    const sheet = zone('settings-sheet')!
    expect(within(sheet).getByRole('button', { name: 'Change password' })).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('states the constraints it was given before the server refuses them', () => {
    // A constraint learnt from an error is a constraint the page could have
    // told you — the Penalty Number lane's rule, applied to a form.
    renderAccount(accountScenarios.ordinary, { actions: allActions() })
    fireEvent.click(document.querySelector('[data-vnext-setting="password"]') as HTMLElement)
    const sheet = zone('settings-sheet')!
    expect(sheet.textContent).toContain('At least 6 characters')

    const [password, repeat] = within(sheet).getAllByLabelText(/password/i)
    fireEvent.change(password!, { target: { value: 'abc' } })
    expect(sheet.textContent).toContain('Use at least 6 characters')
    expect(within(sheet).getByRole('button', { name: 'Change password' })).toBeDisabled()

    fireEvent.change(password!, { target: { value: 'abcdefg' } })
    fireEvent.change(repeat!, { target: { value: 'abcdefh' } })
    expect(sheet.textContent).toContain('do not match')
    expect(within(sheet).getByRole('button', { name: 'Change password' })).toBeDisabled()

    fireEvent.change(repeat!, { target: { value: 'abcdefg' } })
    expect(within(sheet).getByRole('button', { name: 'Change password' })).toBeEnabled()
  })

  it('caps the display name at the length the model stated', () => {
    renderAccount(accountScenarios.ordinary, { actions: allActions() })
    fireEvent.click(document.querySelector('[data-vnext-setting="display-name"]') as HTMLElement)
    const field = within(zone('settings-sheet')!).getByRole('textbox') as HTMLInputElement
    expect(field.maxLength).toBe(40)
  })

  it('repeats the write’s own refusal rather than inventing a reason', async () => {
    // The display-name moderation policy is a list mirrored by a database
    // trigger. A copy here would be the copy that went stale, so the page has
    // none and prints what the write said.
    renderAccount(accountScenarios.ordinary, {
      actions: allActions({
        setDisplayName: async () => ({ ok: false, message: 'That display name isn’t available.' }),
      }),
    })
    fireEvent.click(document.querySelector('[data-vnext-setting="display-name"]') as HTMLElement)
    const sheet = zone('settings-sheet')!
    fireEvent.change(within(sheet).getByRole('textbox'), { target: { value: 'admin' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Change display name' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That display name isn’t available.')
  })

  it('says an email change is not finished until the link is opened', async () => {
    renderAccount(accountScenarios.ordinary, { actions: allActions() })
    fireEvent.click(document.querySelector('[data-vnext-setting="email"]') as HTMLElement)
    const sheet = zone('settings-sheet')!
    fireEvent.change(within(sheet).getByRole('textbox'), { target: { value: 'new@example.test' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Change email address' }))

    const done = await screen.findByRole('status')
    expect(done).toHaveTextContent('Nothing changes until you open it')
  })

  it('names BOTH addresses while one is waiting to be confirmed', () => {
    // Saying only the old one tells the player their change did not happen;
    // saying only the new one tells them it has.
    renderAccount(accountScenarios.emailPending, { actions: allActions() })
    expect(zone('settings')!.textContent).toContain('ada@example.test')
    expect(zone('email-pending')!.textContent).toContain('ada.lovelace@example.test')
  })

  it('offers only the writes the host can perform', () => {
    renderAccount(accountScenarios.ordinary, {
      actions: { setEmail: async () => ({ ok: true }) },
    })
    expect(document.querySelector('[data-vnext-setting="email"]')).not.toBeNull()
    expect(document.querySelector('[data-vnext-setting="password"]')).toBeNull()
    expect(document.querySelector('[data-vnext-setting="display-name"]')).toBeNull()
    expect(zone('reminder-emails')).toBeNull()
  })

  it('draws no details at all when the read behind them failed', () => {
    // AND ABOVE ALL NO SWITCH. `false` would be a stored decision shown to a
    // player who never made it.
    renderAccount(accountScenarios.settingsUnavailable, { actions: allActions() })
    expect(zone('reminder-emails')).toBeNull()
    expect(document.querySelector('[data-vnext-setting="email"]')).toBeNull()
    expect(zone('settings')!.textContent).toContain('could not load your account details')
    // The other panels are untouched: three reads, three outcomes.
    expect(zone('follows')).not.toBeNull()
    expect(zone('history')).not.toBeNull()
  })

  it('draws no email row when the session could not say what the address is', () => {
    renderAccount(accountScenarios.emailUnknown, { actions: allActions() })
    expect(document.querySelector('[data-vnext-setting="email"]')).toBeNull()
    expect(zone('email-unknown')).not.toBeNull()
    // The rest of the panel is real, because the profile read answered.
    expect(document.querySelector('[data-vnext-setting="display-name"]')).not.toBeNull()
    expect(zone('reminder-emails')).not.toBeNull()
  })
})

describe('the reminder preference is a switch', () => {
  it('is a switch in the position the server stored', () => {
    renderAccount(accountScenarios.ordinary, { actions: allActions() })
    expect(screen.getByRole('switch', { name: /Reminder emails/ })).toBeChecked()
    render(<></>)
  })

  it('draws the other stored position too', () => {
    renderAccount(accountScenarios.remindersOff, { actions: allActions() })
    expect(screen.getByRole('switch', { name: /Reminder emails/ })).not.toBeChecked()
  })

  it('saves on one press, with no sheet and no Save button', async () => {
    const setReminderEmails = vi.fn(async () => ({ ok: true }) as const)
    renderAccount(accountScenarios.ordinary, { actions: allActions({ setReminderEmails }) })

    fireEvent.click(screen.getByRole('switch', { name: /Reminder emails/ }))
    expect(setReminderEmails).toHaveBeenCalledWith(false)
    expect(document.querySelector('[data-vnext-zone="settings-sheet"]')).toBeNull()
  })

  it('MOVES BACK when the write refuses, because its position is a claim', async () => {
    // THE ASSERTION THIS BLOCK EXISTS FOR. A switch left where the player put
    // it after the server declined is a switch lying about a stored preference,
    // and the player has no way to find out.
    renderAccount(accountScenarios.ordinary, {
      actions: allActions({
        setReminderEmails: async () => ({ ok: false, message: 'We could not save that.' }),
      }),
    })
    const control = screen.getByRole('switch', { name: /Reminder emails/ })
    expect(control).toBeChecked()

    fireEvent.click(control)
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not save that.')
    expect(screen.getByRole('switch', { name: /Reminder emails/ })).toBeChecked()
  })
})

describe('privacy and help', () => {
  it('says what other players can see, on the page about you', () => {
    renderAccount(accountScenarios.ordinary)
    const panel = zone('privacy')!
    expect(panel.textContent).toContain('only you can see your predictions')
    expect(panel.textContent).toContain('After lock')
    expect(panel.textContent).toContain('never shown on a profile')
  })

  it('offers a real way to reach an administrator where one is configured', () => {
    renderAccount(accountScenarios.ordinary)
    const link = zone('support') as HTMLAnchorElement
    expect(link.getAttribute('href')).toContain('mailto:')
  })

  it('states the absence rather than drawing a control that does nothing', () => {
    renderAccount(accountScenarios.noSupportAddress)
    expect(zone('support')).toBeNull()
    expect(zone('support-absent')!.textContent).toContain('No administrator address')
  })
})
