import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VNextAccount } from '../../src/vnext/account/VNextAccount'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { accountScenarios, shellScenarios } from '../../src/vnext/fixtures'

/**
 * THE INTERFACE MAY NOT OFFER A NOTIFICATION THE BACKEND CANNOT SEND.
 *
 * ============================ THE FAILURE THIS PREVENTS =================
 *
 * `docs/ops/notification-delivery.md` names nineteen event kinds in five
 * categories. Two of them can be delivered: `prediction.window_closing` and
 * `prediction.entries_outstanding`, both from `reminder_deliveries`, which is
 * the only thing in this platform that schedules a notification at all. The
 * other seventeen are either generated as action items the dispatch loop
 * refuses as `unsupported-action-type`, or have no emitter whatsoever.
 *
 * A preference screen with five category switches would therefore be four
 * promises the product cannot keep — and worse than a missing feature, because
 * a player who turns one on has no way to discover that nothing happened. The
 * account surface offers ONE switch, for the one thing that is scheduled, and
 * this is what stops a second appearing before a second is deliverable.
 *
 * ============================ AND PUSH IS NOT MENTIONED =================
 *
 * There is no service worker, no push subscription, no VAPID key and nowhere to
 * store one. Offering a browser-push preference would be the interface
 * inventing a channel, which is the same defect one level up.
 */

function renderAccount() {
  return render(
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <VNextAccount
        model={accountScenarios.ordinary}
        onIntent={() => {}}
        actions={{
          setDisplayName: async () => ({ ok: true }),
          setPassword: async () => ({ ok: true }),
          setEmail: async () => ({ ok: true }),
          setReminderEmails: async () => ({ ok: true }),
        }}
      />
    </VNextShellProvider>,
  )
}

describe('the account offers only the notification it can actually send', () => {
  it('draws exactly one notification preference', () => {
    renderAccount()
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(1)
    expect(switches[0]).toHaveAccessibleName(/Reminder emails/)
  })

  it('says what the reminder is FOR rather than which channel it uses', () => {
    // "A nudge before your predictions lock" is the deadline the ledger
    // actually schedules — `reminder_kind` `deadline` and `final_call`, both on
    // `matchweek_predictions_due`. It promises no other moment.
    renderAccount()
    const row = document.querySelector('[data-vnext-zone="reminder-emails"]') as HTMLElement
    expect(within(row).getByText(/before your predictions lock/i)).toBeInTheDocument()
  })

  it('offers no control for a channel that does not exist', () => {
    const { container } = renderAccount()
    const words = container.textContent ?? ''
    for (const absent of ['push', 'notification', 'alerts', 'SMS']) {
      expect(
        words.toLowerCase().includes(absent.toLowerCase()),
        `the account offers or mentions "${absent}", which no backend can honour`,
      ).toBe(false)
    }
  })

  it('never claims a notification was sent', () => {
    // Three switches must all be open before anything sends — the caller key,
    // the ledger's own `dry_run`, and `NOTIFICATIONS_DELIVERY` — and none of
    // them is visible from a browser. A surface that reported delivery would be
    // reporting something it cannot know.
    const { container } = renderAccount()
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
    // The document's whole classification hangs off this one constant. If the
    // loop grows a second supported action type and the table does not, the
    // table becomes the wrong answer about what the product can tell a player.
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

    const unclassified = kinds.filter((kind) => !doc.includes(`\`${kind}\``))
    expect(
      unclassified,
      'these notification kinds exist and the delivery document does not say whether they can be sent',
    ).toEqual([])
  })
})
