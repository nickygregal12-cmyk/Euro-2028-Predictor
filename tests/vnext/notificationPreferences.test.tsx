import { readFileSync } from 'node:fs'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  VNextAccount,
  type AccountActions,
  type AccountPushNotifications,
} from '../../src/vnext/account/VNextAccount'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { accountScenarios, shellScenarios } from '../../src/vnext/fixtures'

function renderAccount(
  pushNotifications: AccountPushNotifications = { kind: 'promptable' },
  action: AccountActions['setPushNotifications'] = async () => ({ ok: true }),
) {
  return render(
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <VNextAccount
        model={accountScenarios.ordinary}
        pushNotifications={pushNotifications}
        onIntent={() => {}}
        actions={{
          setDisplayName: async () => ({ ok: true }),
          setPassword: async () => ({ ok: true }),
          setEmail: async () => ({ ok: true }),
          setReminderEmails: async () => ({ ok: true }),
          setPushNotifications: action,
        }}
      />
    </VNextShellProvider>,
  )
}

describe('the account offers exactly the notification controls that can work', () => {
  it('offers email and promptable push for the one scheduled reminder', () => {
    renderAccount()
    expect(screen.getAllByRole('switch')).toHaveLength(2)
    expect(screen.getByRole('switch', { name: /Reminder emails/ })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Push notifications/ })).toBeInTheDocument()
  })

  it('states the deadline purpose and push-first channel preference', () => {
    renderAccount()
    const row = document.querySelector('[data-vnext-zone="reminder-emails"]') as HTMLElement
    expect(within(row).getByText(/before your predictions lock/i)).toBeInTheDocument()
    expect(within(row).getByText(/push on, the nudge goes there first/i)).toBeInTheDocument()
  })

  it.each([
    ['unconfigured', /not configured on this deployment/i],
    ['unsupported', /browser does not support/i],
    ['ios-tab', /add this site to your home screen/i],
    ['denied', /cannot ask for permission again/i],
    ['unavailable', /could not check push notifications/i],
  ] as const)('draws an explanation and no push switch for %s', (kind, explanation) => {
    renderAccount({ kind })
    expect(screen.getByText(explanation)).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /Push notifications/ })).not.toBeInTheDocument()
  })

  it('draws promptable push off and reports pending then successful persistence', async () => {
    let finish: ((result: { ok: true }) => void) | undefined
    const action = vi.fn(() => new Promise<{ ok: true }>((resolve) => { finish = resolve }))
    renderAccount({ kind: 'promptable' }, action)
    const control = screen.getByRole('switch', { name: /Push notifications/ })

    expect(control).not.toBeChecked()
    await userEvent.click(control)
    expect(action).toHaveBeenCalledWith(true)
    expect(control).toBeChecked()
    expect(control).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent(/saving push preference/i)

    finish?.({ ok: true })
    await waitFor(() => expect(control).toHaveAttribute('aria-busy', 'false'))
    expect(screen.getByRole('status')).toHaveTextContent(/push preference saved/i)
  })

  it('draws a subscription on and calls the action to turn it off', async () => {
    const action = vi.fn(async () => ({ ok: true } as const))
    renderAccount({ kind: 'subscribed' }, action)
    const control = screen.getByRole('switch', { name: /Push notifications/ })
    expect(control).toBeChecked()
    await userEvent.click(control)
    expect(action).toHaveBeenCalledWith(false)
    expect(control).not.toBeChecked()
  })

  it('returns to the stored position and explains a refusal', async () => {
    const action = vi.fn(async () => ({ ok: false, message: 'Push could not be saved.' } as const))
    renderAccount({ kind: 'promptable' }, action)
    const control = screen.getByRole('switch', { name: /Push notifications/ })
    await userEvent.click(control)
    await waitFor(() => expect(control).not.toBeChecked())
    expect(screen.getByRole('alert')).toHaveTextContent('Push could not be saved.')
    expect(screen.queryByText(/push preference saved/i)).not.toBeInTheDocument()
  })

  it('never claims a notification was sent or delivered', () => {
    const { container } = renderAccount({ kind: 'subscribed' })
    expect(container.textContent ?? '').not.toMatch(/\b(sent|delivered|we emailed)\b/i)
  })
})

describe('the classification stays in step with what actually emits', () => {
  const doc = readFileSync('docs/ops/notification-delivery.md', 'utf8')
  const dispatch = readFileSync(
    'supabase/functions/notification-dispatch/reminderEvents.ts',
    'utf8',
  )

  it('names exactly the action type the dispatch loop supports', () => {
    const supported = dispatch.match(/const SUPPORTED_ACTION_TYPE = '([a-z_]+)'/)?.[1]
    expect(supported).toBe('matchweek_predictions_due')
    expect(doc).toContain('matchweek_predictions_due')
  })

  it('classifies every kind the taxonomy declares', () => {
    const kinds = [
      ...readFileSync(
        'supabase/functions/_shared/notifications/notificationEvents.ts',
        'utf8',
      ).matchAll(/^\s+'([a-z_]+\.[a-z_]+)': '/gm),
    ].map((match) => match[1] as string)

    expect(kinds.length).toBeGreaterThanOrEqual(19)
    expect(kinds.filter((kind) => !doc.includes(`\`${kind}\``))).toEqual([])
  })
})
