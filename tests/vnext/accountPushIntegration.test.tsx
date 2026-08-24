import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VNextAccountScreen } from '../../src/vnext/integration/account/VNextAccountScreen'
import { accountScenarios } from '../../src/vnext/fixtures'

const { getPushNotificationState, setPushNotifications } = vi.hoisted(() => ({
  getPushNotificationState: vi.fn(),
  setPushNotifications: vi.fn(),
}))

vi.mock('../../src/services/supabase/playerPreferences', () => ({
  fetchPlayerPreferences: vi.fn(async () => ({})),
}))
vi.mock('../../src/services/supabase/seasonHistory', () => ({
  fetchMySeasonHistory: vi.fn(async () => ({})),
}))
vi.mock('../../src/services/supabase/weeklyCatalogue', () => ({
  fetchPublishedWeeklySeasons: vi.fn(async () => []),
}))
vi.mock('../../src/services/supabase/profile', () => ({
  fetchMyAccount: vi.fn(async () => ({ reminderEmails: true })),
}))
vi.mock('../../src/services/supabase/auth', () => ({
  getSessionEmailState: vi.fn(async () => ({ email: 'ada@example.test', pendingEmail: null })),
}))
vi.mock('../../src/features/auth/authValidation', () => ({
  DISPLAY_NAME_MAX: 40,
  PASSWORD_MIN: 6,
}))
vi.mock('../../src/services/pushNotifications', () => ({
  getPushNotificationState,
  setPushNotifications,
}))
vi.mock('../../src/vnext/integration/account/buildAccountModel', () => ({
  buildAccountModel: vi.fn(() => accountScenarios.ordinary),
}))

beforeEach(() => {
  vi.clearAllMocks()
  getPushNotificationState.mockResolvedValue({ kind: 'promptable' })
  setPushNotifications.mockResolvedValue(undefined)
})

describe('connected Account push preference', () => {
  it('acquires push independently and writes through the application service boundary', async () => {
    render(
      <VNextAccountScreen userId="user-1" authLoading={false} displayName="Ada Lovelace" />,
    )

    const control = await screen.findByRole('switch', { name: /Push notifications/ })
    expect(getPushNotificationState).toHaveBeenCalledOnce()
    await userEvent.click(control)
    await waitFor(() => expect(setPushNotifications).toHaveBeenCalledWith(true))
    await waitFor(() => expect(getPushNotificationState).toHaveBeenCalledTimes(2))
  })

  it('turns a failed capability read into an explanation rather than an off switch', async () => {
    getPushNotificationState.mockRejectedValue(new Error('cannot inspect browser'))
    render(
      <VNextAccountScreen userId="user-1" authLoading={false} displayName="Ada Lovelace" />,
    )

    expect(await screen.findByText(/could not check push notifications/i)).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /Push notifications/ })).not.toBeInTheDocument()
  })

  it('renders the rest of Account while push capability is still unresolved', async () => {
    getPushNotificationState.mockImplementation(() => new Promise(() => {}))

    render(
      <VNextAccountScreen userId="user-1" authLoading={false} displayName="Ada Lovelace" />,
    )

    expect(await screen.findByRole('heading', { name: 'Your details' })).toBeInTheDocument()
    expect(screen.getByText(/could not check push notifications/i)).toBeInTheDocument()
  })
})
