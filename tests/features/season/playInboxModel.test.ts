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
    // This is what separates Play from Overview: Overview is the competition,
    // Play is yours.
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

  it('sends each joined game to its own surface', () => {
    const inbox = presentPlayInbox(
      [joined('last_man_standing', 'lms'), joined('predictor_cup', 'cup')],
      BASE,
    )

    expect(inbox.entries.map((entry) => entry.href)).toEqual([
      `${BASE}/last-man-standing`,
      `${BASE}/championship`,
    ])
  })

  it('lists a joined game with no surface, but gives it no link', () => {
    // Hiding it would misreport what the player has joined; linking it would be
    // a dead link. It is listed and inert.
    const inbox = presentPlayInbox([joined('main_predictor')], BASE)

    expect(inbox.entries).toHaveLength(1)
    expect(inbox.entries[0]).toMatchObject({ name: 'Main Predictor', href: null })
  })

  it('takes the Match Predictor destination from the caller, not from itself', () => {
    // Its route is flag-gated, and this model cannot read a flag without
    // becoming impure — so the flag stays the one place that decision is made.
    const inbox = presentPlayInbox([joined('main_predictor')], BASE, {
      main_predictor: `${BASE}/main-predictor`,
    })

    expect(inbox.entries[0].href).toBe(`${BASE}/main-predictor`)
  })

  it('reports an empty inbox rather than an empty list', () => {
    const inbox = presentPlayInbox([game(), game({ gameKey: 'predictor_cup' })], BASE)

    expect(inbox.empty).toBe(true)
    expect(inbox.entries).toEqual([])
  })

  it('names games as the interface names them, not as the database does', () => {
    const inbox = presentPlayInbox([joined('predictor_cup')], BASE)

    // ADR 0020 renames the Cup in the interface; the game_key never changed.
    expect(inbox.entries[0].name).toBe('Predictor Championship')
  })
})
