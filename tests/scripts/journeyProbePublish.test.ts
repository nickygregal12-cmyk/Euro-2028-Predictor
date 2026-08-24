import { describe, expect, it } from 'vitest'
// eslint-disable-next-line -- a .mjs script module resolved by Vitest, like its siblings
import { publishDecision, REFRESH_AFTER_HOURS } from '../../scripts/journey-probe/publishDecision.mjs'

/**
 * When a probe run is worth committing.
 *
 * The status page renders the COMMITTED record, so publishing is the only way a
 * run reaches a reader — and also the only way the repository gains noise. Both
 * naive answers are wrong, and both are tested here as the cases they are:
 * commit every run and history fills with four identical entries a day; commit
 * only on change and a stopped probe is indistinguishable from a stable system.
 */

type Step = { id: string; ok: boolean; reason?: string }
type Record = {
  checkedAt: string | null
  origin: string | null
  ok: boolean | null
  steps: Step[]
}

const never: Record = { checkedAt: null, origin: null, ok: null, steps: [] }

const healthy = (checkedAt: string): Record => ({
  checkedAt,
  origin: 'https://example.test',
  ok: true,
  steps: [
    { id: 'landing-answers', ok: true },
    { id: 'invite-unfurls', ok: true },
  ],
})

const decide = (committed: Record, fresh: Record) =>
  publishDecision(committed, fresh) as { publish: boolean; reason: string }

describe('publishDecision', () => {
  it('publishes the first check there has ever been', () => {
    const decision = decide(never, healthy('2026-08-24T00:00:00Z'))
    expect(decision.publish).toBe(true)
    expect(decision.reason).toMatch(/No check has been published before/)
  })

  it('publishes the moment the answer changes', () => {
    const broken: Record = {
      ...healthy('2026-08-24T01:00:00Z'),
      ok: false,
      steps: [
        { id: 'landing-answers', ok: true },
        { id: 'invite-unfurls', ok: false, reason: 'The invitation answered 503.' },
      ],
    }
    expect(decide(healthy('2026-08-24T00:00:00Z'), broken).publish).toBe(true)
  })

  it('publishes a RECOVERY too, not only a breakage', () => {
    const broken: Record = {
      ...healthy('2026-08-24T00:00:00Z'),
      ok: false,
      steps: [{ id: 'landing-answers', ok: false, reason: 'down' }],
    }
    // A page still showing an outage that ended is as wrong as one hiding a
    // live outage, and is the more embarrassing of the two.
    expect(decide(broken, healthy('2026-08-24T01:00:00Z')).publish).toBe(true)
  })

  it('publishes when only the REASON changed, though both runs failed', () => {
    const failing = (reason: string): Record => ({
      ...healthy('2026-08-24T00:00:00Z'),
      ok: false,
      steps: [{ id: 'landing-answers', ok: false, reason }],
    })
    const before = failing('The landing page answered 503.')
    const after = { ...failing('No answer: fetch failed'), checkedAt: '2026-08-24T01:00:00Z' }
    // Two different outages are two different facts, even though both are "down".
    expect(decide(before, after).publish).toBe(true)
  })

  describe('and does not fill the history with runs that say nothing new', () => {
    it('declines an unchanged answer checked again an hour later', () => {
      const decision = decide(healthy('2026-08-24T00:00:00Z'), healthy('2026-08-24T01:00:00Z'))
      expect(decision.publish).toBe(false)
      expect(decision.reason).toMatch(/unchanged and the published record is recent/)
    })

    it('declines every run of a quiet day, so four a day do not become four commits', () => {
      // The probe runs every six hours. Without this the repository would gain
      // four commits a day that differ only in a timestamp.
      const published = healthy('2026-08-24T00:00:00Z')
      for (const hour of ['06', '12', '18']) {
        expect(decide(published, healthy(`2026-08-24T${hour}:00:00Z`)).publish).toBe(false)
      }
    })

    it('but publishes once the published record goes stale, so a stopped probe shows', () => {
      // Silence and health must not look identical. After a day, the same answer
      // is still worth saying, because saying nothing would be the same as
      // having stopped.
      const decision = decide(healthy('2026-08-24T00:00:00Z'), healthy('2026-08-25T00:00:00Z'))
      expect(decision.publish).toBe(true)
      expect(decision.reason).toMatch(/unchanged but the published record is \d+ hours old/)
    })

    it('uses a refresh window that is a day, not a number nobody chose', () => {
      expect(REFRESH_AFTER_HOURS).toBe(24)
    })

    it('ignores timings, which move every run and mean nothing to a reader', () => {
      const withTiming = (ms: number): Record => ({
        ...healthy('2026-08-24T00:00:00Z'),
        steps: [{ id: 'landing-answers', ok: true, ...({ milliseconds: ms } as object) }],
      })
      const later = { ...withTiming(410), checkedAt: '2026-08-24T01:00:00Z' }
      expect(decide(withTiming(88), later).publish).toBe(false)
    })
  })

  describe('and refuses rather than publishing something it cannot stand behind', () => {
    it('refuses a fresh record with no moment in it', () => {
      const decision = decide(healthy('2026-08-24T00:00:00Z'), { ...healthy('x'), checkedAt: null })
      expect(decision.publish).toBe(false)
      expect(decision.reason).toMatch(/names no moment/)
    })

    it('publishes over a published record whose moment cannot be read', () => {
      // Something already went wrong; a readable record is strictly better.
      const decision = decide(
        { ...healthy('2026-08-24T00:00:00Z'), checkedAt: 'not a date' },
        healthy('2026-08-24T01:00:00Z'),
      )
      expect(decision.publish).toBe(true)
    })
  })
})
