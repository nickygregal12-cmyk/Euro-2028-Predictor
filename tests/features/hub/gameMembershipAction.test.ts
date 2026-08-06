import { describe, expect, it } from 'vitest'
import {
  decideGameMembership,
  gameMembershipRefusal,
} from '../../../src/features/hub/gameMembershipAction'
import type { CompetitionGame } from '../../../src/services/supabase/competitionGamesModel'

const SERVER_NOW = '2026-08-06T12:00:00Z'

function game(overrides: Partial<CompetitionGame> = {}): CompetitionGame {
  return {
    id: 'game-1',
    gameKey: 'main_predictor',
    active: true,
    displayName: 'Main Predictor',
    registrationOpensAt: '2026-08-01T09:00:00Z',
    registrationClosesAt: '2026-09-01T09:00:00Z',
    completedAt: null,
    allowRejoin: false,
    membership: null,
    ...overrides,
  }
}

function membership(status: string) {
  return { status, joinedAt: null, leftAt: null, disqualifiedAt: null }
}

describe('decideGameMembership', () => {
  it('offers a join inside an open window', () => {
    const decision = decideGameMembership(game(), SERVER_NOW)

    expect(decision.action).toBe('join')
    expect(decision.label).toBe('Join game')
    expect(decision.refusal).toBeNull()
    expect(decision.joined).toBe(false)
  })

  it('offers a leave to an active entrant, regardless of the entry window', () => {
    // Getting out does not depend on the window that governs getting in.
    const decision = decideGameMembership(
      game({
        membership: membership('active'),
        registrationClosesAt: '2026-08-02T09:00:00Z',
      }),
      SERVER_NOW,
    )

    expect(decision.action).toBe('leave')
    expect(decision.joined).toBe(true)
  })

  it('offers a rejoin when the caller left a game that allows it', () => {
    const decision = decideGameMembership(
      game({ membership: membership('left'), allowRejoin: true }),
      SERVER_NOW,
    )

    expect(decision.action).toBe('rejoin')
    expect(decision.label).toBe('Rejoin game')
  })

  it('refuses a rejoin the catalogue forbids, and says so', () => {
    const decision = decideGameMembership(
      game({ membership: membership('left'), allowRejoin: false }),
      SERVER_NOW,
    )

    expect(decision.action).toBeNull()
    expect(decision.refusal).toContain('cannot be rejoined')
  })

  it('never offers a disqualified entry a way back, whatever allow_rejoin says', () => {
    const decision = decideGameMembership(
      game({ membership: membership('disqualified'), allowRejoin: true }),
      SERVER_NOW,
    )

    expect(decision.action).toBeNull()
    expect(decision.refusal).toContain('disqualified')
  })

  it('distinguishes a window that has not opened from one that has closed', () => {
    const notOpen = decideGameMembership(
      game({ registrationOpensAt: '2026-09-01T09:00:00Z' }),
      SERVER_NOW,
    )
    const closed = decideGameMembership(
      game({ registrationClosesAt: '2026-08-02T09:00:00Z' }),
      SERVER_NOW,
    )

    // Opposite advice: come back, versus do not wait.
    expect(notOpen.refusal).toContain('not opened')
    expect(closed.refusal).toContain('closed')
    expect(notOpen.action).toBeNull()
    expect(closed.action).toBeNull()
  })

  it('fails closed when no opening instant is recorded', () => {
    const decision = decideGameMembership(game({ registrationOpensAt: null }), SERVER_NOW)

    expect(decision.action).toBeNull()
    expect(decision.refusal).toContain('not opened')
  })

  it('refuses a finished game, and tells an entrant they keep their standing', () => {
    const entrant = decideGameMembership(
      game({ membership: membership('active'), completedAt: '2026-08-05T21:00:00Z' }),
      SERVER_NOW,
    )
    const outsider = decideGameMembership(
      game({ completedAt: '2026-08-05T21:00:00Z' }),
      SERVER_NOW,
    )

    expect(entrant.action).toBeNull()
    expect(entrant.refusal).toContain('final standings')
    expect(outsider.refusal).toContain('finished')
  })

  it('refuses an inactive game', () => {
    const decision = decideGameMembership(game({ active: false }), SERVER_NOW)

    expect(decision.action).toBeNull()
    expect(decision.refusal).toContain('not open for entry')
  })

  it('offers nothing when the server supplied no instant, rather than using a device clock', () => {
    const decision = decideGameMembership(game(), null)

    expect(decision.action).toBeNull()
    expect(decision.refusal).toContain('could not be checked')
  })

  it('resolves against the server instant, not the machine running the test', () => {
    const open = decideGameMembership(game(), '2026-08-06T12:00:00Z')
    const closed = decideGameMembership(game(), '2026-10-06T12:00:00Z')

    expect(open.action).toBe('join')
    expect(closed.action).toBeNull()
  })
})

describe('gameMembershipRefusal', () => {
  it('claims no reason for 55000, which several rules on both writes share', () => {
    // Joining raises it for finished, not-open, closed, disqualified and
    // no-rejoin; leaving for finished, scoring started and a Cup past its draw.
    const sentence = gameMembershipRefusal({ code: '55000' })

    expect(sentence).toBe('That change is not allowed right now.')
    expect(sentence).not.toMatch(/closed|opened|finished|disqualified|scoring/i)
  })

  it('names the cases it genuinely knows', () => {
    expect(gameMembershipRefusal({ code: 'unique_violation' })).toContain('already in this game')
    expect(gameMembershipRefusal({ code: 'no_data_found' })).toContain('no longer available')
    expect(gameMembershipRefusal({ code: 'insufficient_privilege' })).toContain('Sign in')
  })

  it('falls back to safe generic copy, leaking no raw detail', () => {
    const sentence = gameMembershipRefusal(new Error('raw internal detail'))

    expect(sentence).not.toContain('raw internal detail')
    expect(sentence.length).toBeGreaterThan(0)
  })
})
