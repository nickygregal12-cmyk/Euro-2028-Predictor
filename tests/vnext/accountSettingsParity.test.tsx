import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextAccount } from '../../src/vnext/account/VNextAccount'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { accountScenarios, shellScenarios } from '../../src/vnext/fixtures'
import type { AccountPageModel } from '../../src/vnext/models/account'

/**
 * THE TWO SETTINGS THE CUTOVER MADE THIS PAGE RESPONSIBLE FOR.
 *
 * ============================ WHY THE DEFERRAL EXPIRED ==================
 *
 * Stage 13 built vNext Account and deliberately left two of `/account`'s
 * settings for their own stage — an email-address change and the reminder-emails
 * preference — on the reasoning that a player can live a season without either.
 * That is sound at a stage boundary.
 *
 * It stops being sound at a cutover, and the reason is a fact rather than a
 * judgement: after the cutover THIS PAGE IS `/account`. The legacy page is
 * retired, so a capability that is not here is one the product no longer has —
 * a feature disappearing because the new page looks newer, which is exactly
 * what a cutover must not do.
 *
 * ============================ AND NOTHING NEW WAS AUTHORED ==============
 *
 * `updateEmail` and `updateReminderEmails` are the same two functions the
 * legacy page calls. There is no second settings authority, no client-side
 * validation of an address the server validates, and no new read.
 */

function renderAccount(model: AccountPageModel, props: Record<string, unknown> = {}) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextAccount model={model} onIntent={vi.fn()} {...props} />
      </VNextShellProvider>
    </VNextRoot>,
  )
}

const zone = (container: HTMLElement, name: string) =>
  container.querySelector(`[data-vnext-zone="${name}"]`) as HTMLElement | null

describe('the email address', () => {
  it('shows the address the account actually uses', () => {
    const { container } = renderAccount(accountScenarios.ordinary)
    expect(zone(container, 'email')?.textContent).toContain('ada@example.com')
  })

  it('names a replacement that has not been confirmed, and says which one stands', () => {
    // Supabase applies nothing until the link in the NEW address is clicked. A
    // page showing only the old address looks as though the change failed; one
    // showing only the new one is simply wrong.
    const { container } = renderAccount(accountScenarios.pendingEmail)
    const pending = zone(container, 'pending-email')
    expect(pending?.textContent).toContain('ada@newdomain.example')
    expect(pending?.textContent).toMatch(/still uses the address above/i)
    expect(zone(container, 'email')?.textContent).toContain('ada@example.com')
  })

  it('emits the address the player typed, and nothing else', () => {
    const onIntent = vi.fn()
    const { container } = renderAccount(accountScenarios.ordinary, { onIntent })
    const field = zone(container, 'email')?.querySelector('input') as HTMLInputElement
    fireEvent.change(field, { target: { value: '  ada@newdomain.example  ' } })
    fireEvent.click(screen.getByRole('button', { name: /send confirmation/i }))

    expect(onIntent).toHaveBeenCalledWith({
      kind: 'change-email',
      email: 'ada@newdomain.example',
    })
  })

  it('cannot be submitted empty', () => {
    const onIntent = vi.fn()
    renderAccount(accountScenarios.ordinary, { onIntent })
    expect(screen.getByRole('button', { name: /send confirmation/i })).toBeDisabled()
    expect(onIntent).not.toHaveBeenCalled()
  })

  it('never claims the address has changed', () => {
    // The one sentence this write must not produce. It has not changed, and it
    // will not until somebody opens a link in another inbox.
    const { container } = renderAccount(accountScenarios.ordinary, {
      settingsNotice:
        'We have sent a confirmation to ada@newdomain.example. Your address changes when you click the link in it.',
    })
    const notice = zone(container, 'settings-notice')
    expect(notice?.textContent).toMatch(/sent a confirmation/i)
    expect(notice?.textContent).not.toMatch(/address changed|updated your email|saved/i)
    expect(notice?.getAttribute('role')).toBe('status')
  })
})

describe('the reminder preference', () => {
  it('is drawn from the server’s answer rather than a default', () => {
    const on = renderAccount(accountScenarios.ordinary)
    const onToggle = (zone(on.container, 'reminders') as HTMLElement).querySelector(
      'input',
    ) as HTMLInputElement
    expect(onToggle.checked).toBe(true)
    on.unmount()

    const off = renderAccount(accountScenarios.remindersOff)
    const offToggle = (zone(off.container, 'reminders') as HTMLElement).querySelector(
      'input',
    ) as HTMLInputElement
    expect(offToggle.checked).toBe(false)
  })

  it('emits the state the player asked for', () => {
    const onIntent = vi.fn()
    const { container } = renderAccount(accountScenarios.remindersOff, { onIntent })
    const toggle = zone(container, 'reminders')?.querySelector('input') as HTMLInputElement
    fireEvent.click(toggle)
    expect(onIntent).toHaveBeenCalledWith({ kind: 'set-reminder-emails', enabled: true })
  })

  it('says what the address is used for, so opting in is informed', () => {
    const { container } = renderAccount(accountScenarios.ordinary)
    expect(zone(container, 'reminders')?.textContent).toMatch(
      /Nothing else is ever sent to this address/i,
    )
  })
})

describe('the panel degrades on its own', () => {
  it('says the settings could not be read, and keeps the rest of the page', () => {
    const { container } = renderAccount(accountScenarios.settingsUnavailable)
    expect(zone(container, 'settings')?.textContent).toMatch(/could not read your settings/i)
    // Follows and history are untouched — the degradation model every panel
    // on this page already follows.
    expect(container.textContent).toContain('Caledonian Premiership')
  })

  it('offers no control at all where no host can perform the write', () => {
    // The lane's rule about inert controls, applied to the settings block: a
    // story or a preview with no `onIntent` gets no field and no toggle rather
    // than ones that silently do nothing.
    const { container } = render(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextAccount model={accountScenarios.ordinary} />
        </VNextShellProvider>
      </VNextRoot>,
    )
    expect(zone(container, 'settings')).toBeNull()
  })

  it('draws nothing where the host loaded no settings at all', () => {
    const model: AccountPageModel = { ...accountScenarios.ordinary, settings: null }
    const { container } = renderAccount(model)
    expect(zone(container, 'settings')).toBeNull()
  })
})

describe('one write at a time, and only its own control disabled', () => {
  it('disables the email control while an email write is out', () => {
    const { container } = renderAccount(accountScenarios.ordinary, { settingsBusy: 'email' })
    expect(zone(container, 'email')?.querySelector('input')).toBeDisabled()
    expect(zone(container, 'reminders')?.querySelector('input')).toBeEnabled()
  })

  it('disables the reminder control while a reminder write is out', () => {
    const { container } = renderAccount(accountScenarios.ordinary, {
      settingsBusy: 'reminders',
    })
    expect(zone(container, 'reminders')?.querySelector('input')).toBeDisabled()
    expect(zone(container, 'email')?.querySelector('input')).toBeEnabled()
  })
})

describe('there is no second settings authority', () => {
  it('calls the same two functions the legacy account page calls', () => {
    const screenSource = readFileSync(
      resolve(process.cwd(), 'src/vnext/integration/account/VNextAccountScreen.tsx'),
      'utf8',
    )
    expect(screenSource).toContain("services/supabase/auth")
    expect(screenSource).toContain('updateEmail')
    expect(screenSource).toContain("services/supabase/profile")
    expect(screenSource).toContain('updateReminderEmails')

    const legacy = readFileSync(
      resolve(process.cwd(), 'src/features/account/AccountPage.tsx'),
      'utf8',
    )
    expect(legacy).toContain('updateEmail')
    expect(legacy).toContain('updateReminderEmails')
  })

  it('validates no address the server validates', () => {
    // A client-side email regex is a second answer to a rule the auth provider
    // owns, and it is the copy that goes stale — the same reasoning the join
    // write follows about registration.
    const screenSource = readFileSync(
      resolve(process.cwd(), 'src/vnext/integration/account/VNextAccountScreen.tsx'),
      'utf8',
    )
    expect(screenSource).not.toMatch(/@.*\\\.|includes\('@'\)|EMAIL_PATTERN/)
  })
})
