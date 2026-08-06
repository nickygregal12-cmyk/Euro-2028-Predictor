import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountPage } from '../../../src/features/account/AccountPage'

const mocks = vi.hoisted(() => ({
  signOut: vi.fn<() => Promise<void>>(),
  refreshProfile: vi.fn(),
  clearMyPredictions: vi.fn<() => Promise<void>>(),
  retryInitialLoad: vi.fn(),
  updateMyDisplayName: vi.fn<() => Promise<void>>(),
  updateReminderEmails: vi.fn<() => Promise<void>>(),
  fetchLeaderboardPage: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({
    userId: 'user-1',
    displayName: 'Nicky',
    signOut: mocks.signOut,
    refreshProfile: mocks.refreshProfile,
  }),
}))

vi.mock('../../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => ({
    status: 'ready',
    data: {
      tournament: {
        id: 'tournament-1',
        name: 'Test Euros',
        year: 2028,
        startsOn: null,
        endsOn: null,
        lockAt: null,
      },
      groups: [],
      teams: [],
      matches: [],
    },
  }),
}))

vi.mock('../../../src/app/providers/PredictionsProvider', () => ({
  usePredictions: () => ({
    ready: true,
    getPrediction: () => ({ homeScore: null, awayScore: null, joker: false }),
    tieResolutions: [],
    bracketProgression: {},
    retryInitialLoad: mocks.retryInitialLoad,
  }),
}))

vi.mock('../../../src/features/shared/useTournamentEntryLocked', () => ({
  useTournamentEntryLocked: () => false,
}))

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

vi.mock('../../../src/services/supabase/predictions', () => ({
  clearMyPredictions: mocks.clearMyPredictions,
}))

vi.mock('../../../src/services/supabase/leaderboard', () => ({
  fetchLeaderboardPage: mocks.fetchLeaderboardPage,
}))

const EMPTY_LEADERBOARD_PAGE = {
  rows: [],
  totalCount: 0,
  pageSize: 1,
  hasMore: false,
  nextCursor: null,
  you: null,
}

beforeEach(() => {
  mocks.fetchLeaderboardPage.mockResolvedValue(EMPTY_LEADERBOARD_PAGE)
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
    mocks.clearMyPredictions.mockResolvedValue(undefined)
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
    mocks.clearMyPredictions.mockResolvedValue(undefined)
  })

  it('clears predictions only after the tier-1 confirm, then reloads the entry', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Clear…' }))
    const dialog = screen.getByRole('dialog', { name: 'Clear all your predictions?' })
    expect(mocks.clearMyPredictions).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Clear everything' }))

    await waitFor(() => {
      expect(mocks.clearMyPredictions).toHaveBeenCalledWith('tournament-1')
      expect(mocks.retryInitialLoad).toHaveBeenCalled()
    })
  })

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

describe('AccountPage standings headline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the pre-results copy for a genuinely empty leaderboard', async () => {
    renderPage()

    expect(await screen.findByText('Standings update once results land')).toBeTruthy()
  })

  it('says the standings failed to load rather than claiming results are pending', async () => {
    mocks.fetchLeaderboardPage.mockRejectedValueOnce(new Error('leaderboard down'))
    renderPage()

    expect(
      await screen.findByText('Your standings couldn’t be loaded right now.'),
    ).toBeTruthy()
    expect(screen.queryByText('Standings update once results land')).toBeNull()
  })
})
