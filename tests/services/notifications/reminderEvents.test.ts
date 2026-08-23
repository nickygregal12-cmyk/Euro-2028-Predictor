import { describe, expect, it } from 'vitest'
import {
  mapReminderToEvent,
  sendingIsPermitted,
  type ActionItem,
  type ClaimedReminder,
} from '../../../supabase/functions/notification-dispatch/reminderEvents'

/**
 * The reminder -> event mapping the dispatch loop makes.
 *
 * Pure, so every case runs with no database, no Deno and no provider. The
 * cases that matter are the refusals: this is the layer where a missing field
 * could become a plausible guess, and a reminder naming the wrong matchweek is
 * worse than one that never went out, because the second gets retried and the
 * first gets believed.
 */

const OCCURRED_AT = '2026-08-17T12:00:00.000Z'

function reminder(overrides: Partial<ClaimedReminder> = {}): ClaimedReminder {
  return {
    id: 'reminder-1',
    user_id: 'player-1',
    email: 'player@example.test',
    action_key: 'matchweek:3:predictions',
    reminder_kind: 'deadline',
    deadline_at: '2026-08-18T11:00:00.000Z',
    attempts: 0,
    dry_run: false,
    // Contract 217. The claim stamps this from the player's live subscriptions;
    // `email` is what a player with no device gets, and this module's decisions
    // are the same either way — it maps a reminder to an event, not to a
    // channel.
    channel: 'email',
    ...overrides,
  }
}

function actionItem(overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    action_type: 'matchweek_predictions_due',
    tournament_id: 'tournament-1',
    competition_id: null,
    context: { matchweek: 3 },
    ...overrides,
  }
}

describe('mapReminderToEvent', () => {
  it('maps a deadline reminder onto the window-closing event', () => {
    const result = mapReminderToEvent(reminder(), actionItem(), OCCURRED_AT)

    expect(result).toEqual({
      ok: true,
      event: {
        kind: 'prediction.window_closing',
        recipientId: 'player-1',
        competitionId: 'tournament-1',
        occurredAt: OCCURRED_AT,
        matchweek: 3,
        closesAt: '2026-08-18T11:00:00.000Z',
        outstandingFixtures: null,
      },
    })
  })

  it('maps a final call onto the entries-outstanding event', () => {
    const result = mapReminderToEvent(
      reminder({ reminder_kind: 'final_call' }),
      actionItem({ context: { matchweek: 3, outstandingFixtures: 2 } }),
      OCCURRED_AT,
    )

    expect(result).toMatchObject({
      ok: true,
      event: {
        kind: 'prediction.entries_outstanding',
        matchweek: 3,
        outstandingFixtures: 2,
      },
    })
  })

  it('prefers the bonus competition over the tournament when there is one', () => {
    const result = mapReminderToEvent(
      reminder(),
      actionItem({ competition_id: 'competition-9' }),
      OCCURRED_AT,
    )
    expect(result.ok && result.event.competitionId).toBe('competition-9')
  })

  it('carries an uncounted fixture total as null rather than zero', () => {
    // The ledger does not count outstanding fixtures. `0` would tell the player
    // they have nothing left to do, which is the opposite of why they are being
    // reminded.
    const result = mapReminderToEvent(reminder(), actionItem(), OCCURRED_AT)
    expect(result.ok && result.event).toMatchObject({ outstandingFixtures: null })
  })

  it('reads a matchweek that arrived as a JSON string', () => {
    const result = mapReminderToEvent(
      reminder(),
      actionItem({ context: { matchweek: '7' } }),
      OCCURRED_AT,
    )
    expect(result.ok && result.event).toMatchObject({ matchweek: 7 })
  })

  describe('refuses rather than guessing', () => {
    it('when no action item matches the reminder', () => {
      expect(mapReminderToEvent(reminder(), null, OCCURRED_AT)).toEqual({
        ok: false,
        reason: 'action-item-missing',
      })
    })

    it.each([
      'lms_pick_due',
      'cup_penalty_number_due',
      'matchweek_settled',
      'game_consequence',
      'league_invitation',
    ])('when the action type is %s, which is not wired', (action_type) => {
      // Each has a plausible-looking home in the taxonomy. None is wired,
      // because a plausible mapping is still a guess about what to tell a
      // player.
      expect(
        mapReminderToEvent(reminder(), actionItem({ action_type }), OCCURRED_AT),
      ).toEqual({ ok: false, reason: `unsupported-action-type:${action_type}` })
    })

    it('when the context carries no matchweek', () => {
      expect(
        mapReminderToEvent(reminder(), actionItem({ context: {} }), OCCURRED_AT),
      ).toEqual({ ok: false, reason: 'matchweek-unavailable' })
    })

    it('when the context is absent entirely', () => {
      expect(
        mapReminderToEvent(reminder(), actionItem({ context: null }), OCCURRED_AT),
      ).toEqual({ ok: false, reason: 'matchweek-unavailable' })
    })

    it.each([['' as const], ['not-a-number'], [true], [{ nested: 1 }], [-1], [1.5]])(
      'when the matchweek is %o, which is not a usable integer',
      (matchweek) => {
        // `Number('')` is 0. Coercing here would invent matchweek zero and the
        // notification would be sent, not refused.
        expect(
          mapReminderToEvent(
            reminder(),
            actionItem({ context: { matchweek } }),
            OCCURRED_AT,
          ),
        ).toEqual({ ok: false, reason: 'matchweek-unavailable' })
      },
    )

    it('when a final call has no outstanding count to state', () => {
      expect(
        mapReminderToEvent(
          reminder({ reminder_kind: 'final_call' }),
          actionItem({ context: { matchweek: 3 } }),
          OCCURRED_AT,
        ),
      ).toEqual({ ok: false, reason: 'matchweek-unavailable' })
    })

    it('when the reminder kind is outside the ledger contract', () => {
      expect(
        mapReminderToEvent(
          reminder({ reminder_kind: 'weekly_digest' }),
          actionItem(),
          OCCURRED_AT,
        ),
      ).toEqual({
        ok: false,
        reason: 'unsupported-reminder-kind:weekly_digest',
      })
    })
  })

  it('never reads a clock', async () => {
    // The caller supplies occurredAt. A mapper that read the clock could not be
    // asserted against an exact payload, and two runs of the same row would
    // produce two different idempotency keys downstream.
    const source = await import('node:fs').then(({ readFileSync }) =>
      readFileSync(
        'supabase/functions/notification-dispatch/reminderEvents.ts',
        'utf8',
      ),
    )
    expect(source).not.toMatch(/Date\.now\(\)|new Date\(\)/)
  })
})

describe('sendingIsPermitted', () => {
  it('refuses a row the ledger marked dry run', () => {
    expect(sendingIsPermitted(reminder({ dry_run: true }))).toBe(false)
  })

  it('permits a row the ledger cleared', () => {
    expect(sendingIsPermitted(reminder({ dry_run: false }))).toBe(true)
  })

  it('treats a missing flag as dry run', () => {
    // Strict equality against false, so an absent or unexpected value fails
    // towards not sending.
    expect(
      sendingIsPermitted({ ...reminder(), dry_run: undefined as unknown as boolean }),
    ).toBe(false)
  })
})
