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
 * ============================ AND PUSH IS NOT MENTIONED YET =============
 *
 * THIS PARAGRAPH USED TO SAY there was no service worker, no push subscription,
 * no VAPID key and nowhere to store one. Contract 217 changed three of those
 * four: `public.push_subscriptions` exists, the Edge Function signs and
 * encrypts RFC 8291 payloads, and the worker renders them. The account surface
 * still offers no push control, and the reason is now a different one that has
 * to be written down accurately rather than left reading as the old one.
 *
 * `TYPE-001` closed the untyped Supabase client: every call from `src/` is
 * checked against `src/services/supabase/database.types.ts`, which is generated
 * from hosted Development. Development trails the repository, so
 * `save_push_subscription` is not in that file, and a switch that called it
 * would not compile. The repository states that ordering as a feature — an RPC
 * has to exist on Development before a browser is written against it — and the
 * gate below is what stops this file's guarantee quietly rotting in the
 * meantime.
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

  it('offers no control for a channel the browser cannot yet reach', () => {
    const { container } = renderAccount()
    const words = container.textContent ?? ''
    for (const absent of ['push', 'notification', 'alerts', 'SMS']) {
      expect(
        words.toLowerCase().includes(absent.toLowerCase()),
        `the account offers or mentions "${absent}", which this browser build cannot honour`,
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

describe('the push switch is owed the moment the browser can be written for it', () => {
  it('fails as soon as the generated types know about save_push_subscription', () => {
    // AN EXECUTABLE REMINDER, NOT A TODO. Contract 217 built the whole push
    // channel — the subscription table, the VAPID signing, the aes128gcm
    // encryption, the service worker's `push` and `notificationclick` handlers
    // — and every part of it is inert until a player can turn it on. The only
    // thing in the way is that `database.types.ts` is generated from hosted
    // Development, which trails the repository, so the two writes the switch
    // needs would not compile.
    //
    // WHEN THIS TEST FAILS, THAT IS THE SIGNAL AND NOT A FAULT. It means
    // contract 217 reached Development and the types were regenerated, so the
    // account surface can now offer:
    //
    //   * a second switch, drawn ONLY where push genuinely works;
    //   * an explanation instead of a switch on iOS in a Safari tab, where
    //     adding to the Home Screen is what makes it work — the one "off" a
    //     player can do something about and will never guess;
    //   * an explanation instead of a switch where the permission is denied,
    //     because the prompt cannot be shown again from a page;
    //   * a note on the email row saying where the nudge actually goes, since
    //     contract 217's claim prefers push wherever a device exists.
    //
    // Delete this case when that switch exists, and replace it with the states
    // above. Do not delete it to make a build green.
    const types = readFileSync('src/services/supabase/database.types.ts', 'utf8')
    expect(
      types.includes('save_push_subscription'),
      'The generated types now know contract 217. Build the account push switch ' +
        'and replace this case with its states — see the comment above.',
    ).toBe(false)
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
