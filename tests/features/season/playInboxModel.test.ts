import { describe, expect, it } from 'vitest'
import { presentPlayInbox } from '../../../src/features/season/playInboxModel'
import type { CompetitionGame } from '../../../src/services/supabase/competitionGamesModel'

const BASE = '/competitions/premier-league/2026-27'

function game(overrides: Partial<CompetitionGame> = {}): CompetitionGame {
  return {
    id: 'game-1',
    gameKey: 'main_predictor',
    active: true,
    displayName: 'Main Predictor',
    registrationOpensAt: null,
    registrationClosesAt: null,
    completedAt: null,
    allowRejoin: false,
    membership: null,
    ...overrides,
  }
}

function joined(gameKey: CompetitionGame['gameKey'], id = 'game-1'): CompetitionGame {
  return game({
    id,
    gameKey,
    membership: { status: 'active', joinedAt: null, leftAt: null, disqualifiedAt: null },
  })
}

describe('presentPlayInbox', () => {
  it('lists only the games the caller has actually joined', () => {
    const inbox = presentPlayInbox(
      [joined('last_man_standing', 'lms'), game({ gameKey: 'predictor_cup', id: 'cup' })],
      BASE,
    )

    expect(inbox.entries.map((entry) => entry.gameKey)).toEqual(['last_man_standing'])
    expect(inbox.empty).toBe(false)
  })

  it('counts only an active membership as joined', () => {
    const left = game({
      gameKey: 'last_man_standing',
      membership: { status: 'left', joinedAt: null, leftAt: null, disqualifiedAt: null },
    })

    expect(presentPlayInbox([left], BASE).empty).toBe(true)
  })

  it('sends each joined game to its canonical Games child', () => {
    const inbox = presentPlayInbox(
      [joined('last_man_standing', 'lms'), joined('predictor_cup', 'cup')],
      BASE,
    )

    expect(inbox.entries.map((entry) => entry.href)).toEqual([
      `${BASE}/games/lms`,
      `${BASE}/games/championship`,
    ])
  })

  it('lists a joined Match Predictor with no enabled surface, but gives it no link', () => {
    const inbox = presentPlayInbox([joined('main_predictor')], BASE)

    expect(inbox.entries).toHaveLength(1)
    expect(inbox.entries[0]).toMatchObject({ name: 'Match Predictor', href: null })
  })

  it('uses the caller only as the Match Predictor enable signal, then builds the canonical route', () => {
    const inbox = presentPlayInbox([joined('main_predictor')], BASE, {
      main_predictor: 'enabled',
    })

    expect(inbox.entries[0].href).toBe(`${BASE}/games/match-predictor`)
  })

  it('reports an empty inbox rather than an empty list', () => {
    const inbox = presentPlayInbox([game(), game({ gameKey: 'predictor_cup' })], BASE)

    expect(inbox.empty).toBe(true)
    expect(inbox.entries).toEqual([])
  })

  it('names games as the public interface names them, not as the database does', () => {
    const inbox = presentPlayInbox([joined('predictor_cup')], BASE)

    expect(inbox.entries[0].name).toBe('Predictor Championship')
  })
})
