// @vitest-environment node
//
// WHAT A LOCKED PHONE MAY SHOW A STRANGER.
//
// This is the surface with the widest unintended audience in the product. An
// email is opened by the person it was sent to; a push notification is rendered
// by the operating system on a locked screen in front of whoever is in the
// room. Contract 151 spent a whole boundary keeping one player's predictions
// away from another before the matchweek locks, and a single helpful
// notification would hand them over.
//
// So the assertions here are mostly about what is ABSENT, and the exhaustive
// one runs against every event the taxonomy defines rather than against the two
// this module currently handles — a third kind wired up later has to face it.
import { describe, expect, it } from 'vitest'
import type { NotificationEvent } from '../../../supabase/functions/_shared/notifications/notificationEvents'
import { buildPushPayload } from '../../../supabase/functions/_shared/push/pushPayload'

const BASE = {
  recipientId: '11111111-1111-1111-1111-111111111111',
  competitionId: '22222222-2222-2222-2222-222222222222',
  occurredAt: '2026-08-24T09:00:00.000Z',
} as const

function closing(outstandingFixtures: number | null): NotificationEvent {
  return {
    ...BASE,
    kind: 'prediction.window_closing',
    matchweek: 4,
    closesAt: '2026-08-24T18:00:00.000Z',
    outstandingFixtures,
  }
}

function lastCall(outstandingFixtures: number): NotificationEvent {
  return { ...BASE, kind: 'prediction.entries_outstanding', matchweek: 4, outstandingFixtures }
}

describe('the two reminders the ledger actually schedules', () => {
  it('names the matchweek and how many are left', () => {
    const result = buildPushPayload(closing(3))
    expect(result.ok).toBe(true)
    expect(result.ok && result.payload).toEqual({
      title: 'Matchweek 4 closes soon',
      body: '3 predictions still to make before it locks.',
      url: '/',
      tag: 'matchweek-4',
    })
  })

  it('says a plain nudge when the count is unknown rather than inventing zero', () => {
    // `null` is a real state: the ledger does not always count. "0 predictions
    // still to make" would be both false and a reason not to open the app.
    const result = buildPushPayload(closing(null))
    expect(result.ok && result.payload.body).toBe('Get your predictions in before it locks.')
  })

  it('does not say a count of zero even if one arrives', () => {
    const result = buildPushPayload(closing(0))
    expect(result.ok && result.payload.body).not.toMatch(/\b0\b/)
  })

  it('gets the singular right, because "1 predictions" is what a bot writes', () => {
    const nudge = buildPushPayload(closing(1))
    const call = buildPushPayload(lastCall(1))
    expect(nudge.ok && nudge.payload.body).toBe('1 prediction still to make before it locks.')
    expect(call.ok && call.payload.body).toBe('1 prediction still to make.')
  })

  it('gives the last call the SAME tag, so it replaces the nudge it follows', () => {
    // Two live notices about one matchweek read as two deadlines, and a player
    // clearing one is left looking at the other.
    const first = buildPushPayload(closing(3))
    const second = buildPushPayload(lastCall(2))
    expect(first.ok && first.payload.tag).toBe(second.ok && second.payload.tag)
  })

  it('sends a tap to a path this application actually serves', () => {
    // The event carries a competition uuid, and the route needs two slugs. A
    // guessed deep link opens a 404 from a notification.
    for (const event of [closing(3), lastCall(2)]) {
      const result = buildPushPayload(event)
      expect(result.ok && result.payload.url).toBe('/')
    }
  })
})

describe('what a locked phone may never show', () => {
  const payloads = [closing(3), closing(null), lastCall(2), lastCall(1)].map((event) => {
    const result = buildPushPayload(event)
    if (!result.ok) throw new Error('these two kinds must be supported')
    return JSON.stringify(result.payload)
  })

  it('carries no player identity of any kind', () => {
    // The device already knows whose phone it is. Everything else is a
    // disclosure to whoever is looking at it.
    for (const text of payloads) {
      expect(text).not.toContain(BASE.recipientId)
      expect(text).not.toContain(BASE.competitionId)
      expect(text.toLowerCase()).not.toMatch(/@|\bemail\b/)
    }
  })

  it('carries no prediction, pick, score, rank or result', () => {
    // Contract 151's pre-lock boundary in one assertion: a competitor reading
    // this over a shoulder learns nothing they could act on.
    for (const text of payloads) {
      expect(text.toLowerCase()).not.toMatch(
        /\b(score|scoreline|joker|pick|selection|rank|points|won|lost|beat|vs\.?|v\b)/,
      )
    }
  })

  it('states no time of day, because nothing here knows which timezone the player is in', () => {
    // A deadline rendered in the wrong zone is worse than none: it is specific,
    // credible and wrong.
    for (const text of payloads) {
      expect(text).not.toMatch(/\d{1,2}[:.]\d{2}/)
      expect(text).not.toContain('2026-08-24')
      expect(text.toLowerCase()).not.toMatch(/\b(am|pm|utc|gmt)\b/)
    }
  })

  it('stays short enough that a lock screen shows all of it', () => {
    for (const text of payloads) {
      const payload = JSON.parse(text) as { title: string; body: string }
      expect(payload.title.length).toBeLessThanOrEqual(50)
      expect(payload.body.length).toBeLessThanOrEqual(120)
    }
  })
})

describe('an event with no push wording is refused, not guessed at', () => {
  const OTHER_KINDS: readonly NotificationEvent[] = [
    { ...BASE, kind: 'prediction.locked', matchweek: 4, entrySubmitted: true },
    {
      ...BASE,
      kind: 'matchweek.opened',
      matchweek: 5,
      closesAt: '2026-08-31T18:00:00.000Z',
      fixtureCount: 10,
    },
  ]

  it.each(OTHER_KINDS.map((event) => [event.kind, event] as const))(
    'refuses %s by name',
    (kind, event) => {
      const result = buildPushPayload(event)
      expect(result.ok).toBe(false)
      expect(!result.ok && result.reason).toBe(`unsupported-push-kind:${kind}`)
    },
  )
})
