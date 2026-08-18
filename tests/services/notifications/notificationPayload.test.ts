import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_EVENT_KINDS,
  type NotificationEvent,
} from '../../../supabase/functions/_shared/notifications/notificationEvents'
import { buildNotificationPayload } from '../../../supabase/functions/_shared/notifications/notificationPayload'

/**
 * Domain event -> delivery payload.
 *
 * The mapping is pure, so these run with no provider, no network and no clock.
 */

const OCCURRED_AT = '2026-08-17T12:00:00.000Z'

function matchweekPoints(
  overrides: Partial<NotificationEvent> = {},
): NotificationEvent {
  return {
    kind: 'results.matchweek_points',
    recipientId: 'player-1',
    competitionId: 'competition-1',
    occurredAt: OCCURRED_AT,
    matchweek: 3,
    points: 12,
    basis: 'awarded',
    ...overrides,
  } as NotificationEvent
}

/** One well-formed example of every kind, so coverage is total by construction. */
const EXAMPLES: { [K in NotificationEvent['kind']]: NotificationEvent } = {
  'prediction.window_closing': {
    kind: 'prediction.window_closing',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    matchweek: 4,
    closesAt: OCCURRED_AT,
    outstandingFixtures: 2,
  },
  'prediction.entries_outstanding': {
    kind: 'prediction.entries_outstanding',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    matchweek: 4,
    outstandingFixtures: 3,
  },
  'prediction.locked': {
    kind: 'prediction.locked',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    matchweek: 4,
    entrySubmitted: true,
  },
  'matchweek.opened': {
    kind: 'matchweek.opened',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    matchweek: 5,
    closesAt: OCCURRED_AT,
    fixtureCount: 10,
  },
  'league.invitation_received': {
    kind: 'league.invitation_received',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    leagueId: 'l',
    leagueName: 'The Office',
    invitedByDisplayName: null,
  },
  'league.rank_changed': {
    kind: 'league.rank_changed',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    leagueId: 'l',
    leagueName: 'The Office',
    previousRank: 4,
    currentRank: 2,
  },
  'league.overtaken': {
    kind: 'league.overtaken',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    leagueId: 'l',
    leagueName: 'The Office',
    overtakenByDisplayName: 'Sam',
    currentRank: 3,
    pointsBehind: null,
  },
  'league.rival_moved': {
    kind: 'league.rival_moved',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    leagueId: 'l',
    rivalDisplayName: 'Sam',
    pointsGap: 2,
  },
  'social.followed_player_activity': {
    kind: 'social.followed_player_activity',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    actorDisplayName: 'Sam',
    activity: 'won_matchweek',
  },
  'social.head_to_head_moved': {
    kind: 'social.head_to_head_moved',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    opponentDisplayName: 'Sam',
    standing: 'ahead',
    pointsMargin: null,
  },
  'lms.round_opened': {
    kind: 'lms.round_opened',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    round: 2,
    closesAt: OCCURRED_AT,
  },
  'lms.selection_confirmed': {
    kind: 'lms.selection_confirmed',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    round: 2,
    selectionLabel: 'Arsenal',
  },
  'lms.survived': {
    kind: 'lms.survived',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    round: 2,
    survivorsRemaining: null,
  },
  'lms.eliminated': {
    kind: 'lms.eliminated',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    round: 2,
    selectionLabel: 'Arsenal',
  },
  'lms.next_round_available': {
    kind: 'lms.next_round_available',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    round: 3,
    closesAt: OCCURRED_AT,
  },
  'results.matchweek_points': matchweekPoints(),
  'results.exact_score': {
    kind: 'results.exact_score',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    matchweek: 3,
    fixtureLabel: 'Arsenal 2-1 Chelsea',
  },
  'results.rank_movement': {
    kind: 'results.rank_movement',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    matchweek: 3,
    previousRank: 9,
    currentRank: 5,
  },
  'results.competition_milestone': {
    kind: 'results.competition_milestone',
    recipientId: 'p',
    competitionId: 'c',
    occurredAt: OCCURRED_AT,
    milestone: 'halfway',
  },
}

describe('buildNotificationPayload', () => {
  it('maps every declared event kind to a distinct workflow', () => {
    const workflows = new Set<string>()

    for (const kind of NOTIFICATION_EVENT_KINDS) {
      const event = EXAMPLES[kind]
      expect(event, `no example for ${kind}`).toBeDefined()

      const result = buildNotificationPayload(event)
      expect(result.ok, `${kind} did not map`).toBe(true)
      if (!result.ok) continue

      expect(result.payload.category).toBe(NOTIFICATION_CATEGORIES[kind])
      // A shared workflow id would deliver one event's template for another.
      expect(workflows.has(result.payload.workflowId)).toBe(false)
      workflows.add(result.payload.workflowId)
    }

    expect(workflows.size).toBe(NOTIFICATION_EVENT_KINDS.length)
  })

  it('carries the event fields through as template data', () => {
    const result = buildNotificationPayload(matchweekPoints())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload.recipientId).toBe('player-1')
    expect(result.payload.occurredAt).toBe(OCCURRED_AT)
    expect(result.payload.data).toMatchObject({
      competitionId: 'competition-1',
      matchweek: 3,
      points: 12,
      basis: 'awarded',
    })
  })

  it('does not repeat the recipient inside the template data', () => {
    // Two homes for one fact is two things to keep in step.
    const result = buildNotificationPayload(matchweekPoints())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.data).not.toHaveProperty('recipientId')
    expect(result.payload.data).not.toHaveProperty('kind')
  })

  it('preserves null as null rather than turning it into zero', () => {
    // The whole point: "not available" and "zero" are different claims, and
    // rendering the first as the second tells the player something untrue.
    const result = buildNotificationPayload(EXAMPLES['league.overtaken'])
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload.data.pointsBehind).toBeNull()
    expect(result.payload.data.pointsBehind).not.toBe(0)
  })

  it('preserves a provisional basis rather than presenting it as settled', () => {
    const result = buildNotificationPayload(
      matchweekPoints({ basis: 'provisional' } as Partial<NotificationEvent>),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.data.basis).toBe('provisional')
  })

  it('produces a stable transaction id for the same fact', () => {
    // Two schedulers seeing the same fact must collapse to one notification.
    const first = buildNotificationPayload(matchweekPoints())
    const second = buildNotificationPayload(matchweekPoints())
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.payload.transactionId).toBe(second.payload.transactionId)
  })

  it('produces different transaction ids for different players and matchweeks', () => {
    const mine = buildNotificationPayload(matchweekPoints())
    const theirs = buildNotificationPayload(
      matchweekPoints({ recipientId: 'player-2' } as Partial<NotificationEvent>),
    )
    const later = buildNotificationPayload(
      matchweekPoints({ matchweek: 4 } as Partial<NotificationEvent>),
    )
    expect(mine.ok && theirs.ok && later.ok).toBe(true)
    if (!mine.ok || !theirs.ok || !later.ok) return

    expect(mine.payload.transactionId).not.toBe(theirs.payload.transactionId)
    expect(mine.payload.transactionId).not.toBe(later.payload.transactionId)
  })

  describe('rejects a malformed event rather than half-building one', () => {
    it('with an unknown kind', () => {
      const result = buildNotificationPayload({
        ...matchweekPoints(),
        kind: 'results.something_invented',
      } as unknown as NotificationEvent)
      expect(result).toEqual({ ok: false, reason: 'unknown-kind' })
    })

    it('with no recipient', () => {
      const result = buildNotificationPayload(
        matchweekPoints({ recipientId: '  ' } as Partial<NotificationEvent>),
      )
      expect(result).toEqual({ ok: false, reason: 'missing-recipient' })
    })

    it('with no competition', () => {
      const result = buildNotificationPayload(
        matchweekPoints({ competitionId: '' } as Partial<NotificationEvent>),
      )
      expect(result).toEqual({ ok: false, reason: 'missing-competition' })
    })

    it('with an unparseable timestamp', () => {
      const result = buildNotificationPayload(
        matchweekPoints({ occurredAt: 'last Tuesday' } as Partial<NotificationEvent>),
      )
      expect(result).toEqual({ ok: false, reason: 'invalid-timestamp' })
    })
  })
})
