import { resolve } from 'node:path'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fromRoot, reachableFrom } from '../../app/importGraph'
import { AccountPage } from '../../../src/features/account/AccountPage'

const mocks = vi.hoisted(() => ({
  signOut: vi.fn<() => Promise<void>>(),
  refreshProfile: vi.fn(),
  updateMyDisplayName: vi.fn<() => Promise<void>>(),
  updateReminderEmails: vi.fn<() => Promise<void>>(),
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({
    userId: 'user-1',
    displayName: 'Nicky',
    signOut: mocks.signOut,
    refreshProfile: mocks.refreshProfile,
  }),
}))

// No TournamentDataProvider, PredictionsProvider or entry-lock mock any more,
// and that absence is the point of this file's last test: /account reads
// nothing from a competition, so it can be rendered on its own.

vi.mock('../../../src/services/supabase/auth', () => ({
  getSessionEmailState: () =>
    Promise.resolve({ email: 'me@example.test', pendingEmail: null }),
  updateEmail: vi.fn(),
  updatePassword: vi.fn(),
}))

vi.mock('../../../src/services/supabase/profile', () => ({
  fetchMyAccount: () =>
    Promise.resolve({ displayName: 'Nicky', reminderEmails: true }),
  updateMyDisplayName: mocks.updateMyDisplayName,
  updateReminderEmails: mocks.updateReminderEmails,
}))

beforeEach(() => {
  mocks.updateReminderEmails.mockResolvedValue(undefined)
})

function renderPage() {
  render(
    <MemoryRouter>
      <AccountPage />
    </MemoryRouter>,
  )
}

describe('AccountPage sign out', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signOut.mockResolvedValue(undefined)
  })

  it('does not sign out when confirmation is cancelled', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    const dialog = screen.getByRole('dialog', { name: 'Sign out?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Sign out?' })).toBeNull()
  })

  it('signs out once only after explicit confirmation', async () => {
    let finishSignOut!: () => void
    mocks.signOut.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishSignOut = resolve
        }),
    )
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    const dialog = screen.getByRole('dialog', { name: 'Sign out?' })
    const confirm = within(dialog).getByRole('button', { name: 'Sign out' })

    fireEvent.click(confirm)
    fireEvent.click(confirm)

    expect(mocks.signOut).toHaveBeenCalledOnce()

    act(() => finishSignOut())

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Sign out?' })).toBeNull()
    })
  })

  it('keeps the dialog open with a safe retry message after failure', async () => {
    mocks.signOut.mockRejectedValueOnce(new Error('internal provider detail'))
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    const dialog = screen.getByRole('dialog', { name: 'Sign out?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('couldn’t sign you out')
    expect(alert.textContent).not.toContain('internal provider detail')
    expect(screen.getByRole('dialog', { name: 'Sign out?' })).toBeTruthy()
  })
})

describe('AccountPage danger zone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // "Clear all your predictions?" USED TO LIVE HERE and its test with it. It
  // cleared one tournament's predictions from a page that belongs to the
  // account, so a player in a competition season was offered a destructive
  // control over a tournament they had never entered — and, once the entry was
  // no longer created on sight, over an entry that did not exist. Clearing an
  // entry is a per-competition action and belongs on the surface that owns
  // that entry. It is recorded rather than silently dropped because the
  // capability was real and is not being replaced here.

  it('routes a rename through the moderation-gated service and refreshes the profile', async () => {
    mocks.updateMyDisplayName.mockResolvedValue(undefined)
    renderPage()

    fireEvent.click(screen.getAllByRole('button', { name: 'Change' })[0])
    const input = await screen.findByLabelText('New display name')
    fireEvent.change(input, { target: { value: 'New Nick' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mocks.updateMyDisplayName).toHaveBeenCalledWith('user-1', 'New Nick')
      expect(mocks.refreshProfile).toHaveBeenCalled()
    })
  })
})

describe('AccountPage reminder preference', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function findEnabledToggle(): Promise<HTMLInputElement> {
    const toggle = screen.getByRole<HTMLInputElement>('checkbox')
    await waitFor(() => expect(toggle.disabled).toBe(false))
    return toggle
  }

  it('saves a toggle and keeps the new value with no error shown', async () => {
    renderPage()
    const toggle = await findEnabledToggle()
    expect(toggle.checked).toBe(true)

    fireEvent.click(toggle)

    await waitFor(() => {
      expect(mocks.updateReminderEmails).toHaveBeenCalledWith('user-1', false)
    })
    expect(toggle.checked).toBe(false)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says a failed toggle did not save instead of silently reverting', async () => {
    mocks.updateReminderEmails.mockRejectedValueOnce(new Error('internal provider detail'))
    renderPage()
    const toggle = await findEnabledToggle()

    fireEvent.click(toggle)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('didn’t save')
    expect(alert.textContent).toContain('still on')
    expect(alert.textContent).not.toContain('internal provider detail')
    expect(toggle.checked).toBe(true)
  })

  it('clears the stale error once a retry saves', async () => {
    mocks.updateReminderEmails.mockRejectedValueOnce(new Error('offline'))
    renderPage()
    const toggle = await findEnabledToggle()

    fireEvent.click(toggle)
    await screen.findByRole('alert')

    fireEvent.click(toggle)

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(toggle.checked).toBe(false)
  })
})

describe('the account page belongs to the account, not to a competition', () => {
  // WHAT THIS REPLACED. Two tests asserted the standings headline — the
  // pre-results copy for an empty leaderboard, and the distinct copy for a
  // failed read. Both were correct about a page that no longer exists: the
  // headline printed a Euro 2028 points total and rank under every player's
  // name, including the ones whose only competition is a league season. The
  // distinction they protected was a good one and it still holds on /profile,
  // which ranks a player inside one competition and is where it belongs.
  //
  // What replaces them is the fact that made removing them possible, asserted
  // rather than described: /account can be rendered with no tournament around
  // it. Every test above already proves it dynamically by rendering the page
  // bare; this proves it statically, so an import added tomorrow fails here
  // instead of quietly putting /account back inside the boundary.
  //
  // NOT A DUPLICATE OF `tournamentDataBoundary.test.ts`. That file compares
  // each registered route against the two PROVIDERS, and would indeed catch
  // either of those coming back. It knows nothing about the two Euro service
  // reads — a leaderboard page or a prediction write added straight to this
  // page needs no provider, so it would pass there and fail here.

  it('reaches no tournament provider, entry lock or competition read', () => {
    const graph = reachableFrom(
      resolve(process.cwd(), 'src/features/account/AccountPage.tsx'),
    )
    const forbidden = [
      'src/app/providers/TournamentDataProvider',
      'src/app/providers/PredictionsProvider',
      'src/features/shared/useTournamentEntryLocked',
      'src/services/supabase/leaderboard',
      'src/services/supabase/predictions',
    ]
    const reached = forbidden.filter((module) =>
      [...graph].some((file) => fromRoot(file).startsWith(module)),
    )
    expect(
      reached,
      'AccountPage imports a competition-scoped module — /account is registered ' +
        'outside TournamentJourney in src/App.tsx and there is no provider above ' +
        'it, so this would be a crash rather than a stale number',
    ).toEqual([])
  })
})
