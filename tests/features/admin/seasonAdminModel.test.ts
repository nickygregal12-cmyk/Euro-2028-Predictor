import { describe, expect, it } from 'vitest'
import {
  actionsFor,
  openOutcomeMessage,
  openableGames,
  presentSeasonReadiness,
  seasonAdminRefusal,
} from '../../../src/features/admin/seasonAdminModel'
import type { SeasonFixture } from '../../../src/services/supabase/seasonFixturesModel'
import type { CompetitionGame } from '../../../src/services/supabase/competitionGamesModel'
import type { SeasonOpenOutcome } from '../../../src/services/supabase/seasonAdmin'

function fixture(overrides: Partial<SeasonFixture> = {}): SeasonFixture {
  return {
    id: 'fixture-1',
    kickoffAt: '2026-08-08T14:00:00Z',
    status: 'scheduled',
    homeName: 'Rangers',
    awayName: 'Hibernian',
    homeScore: null,
    awayScore: null,
    ...overrides,
  }
}

function outcome(overrides: Partial<SeasonOpenOutcome> = {}): SeasonOpenOutcome {
  return {
    outcome: 'opened',
    reason: null,
    gameKey: 'last_man_standing',
    setupWritten: false,
    windows: null,
    raw: {},
    ...overrides,
  }
}

function game(overrides: Partial<CompetitionGame> = {}): CompetitionGame {
  return {
    id: 'competition-1',
    gameKey: 'last_man_standing',
    active: true,
    displayName: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    completedAt: null,
    allowRejoin: false,
    membership: null,
    ...overrides,
  } as CompetitionGame
}

describe('which result controls a fixture offers', () => {
  it('offers only Confirm before there is a result', () => {
    expect(actionsFor('scheduled')).toEqual(['confirm'])
  })

  it('treats a postponed fixture as confirmable, because the server does', () => {
    // A postponed fixture that is eventually played is the ordinary case and
    // `record_season_fixture_result` accepts it. Offering nothing here would
    // hide an action the server permits.
    expect(actionsFor('postponed')).toEqual(['confirm'])
  })

  it('offers Correct and Clear once a result exists, and never Confirm again', () => {
    // Confirming over an existing result is refused so the correction's audit
    // trail cannot be lost. The control follows the rule rather than restating
    // it: the button is simply not there.
    expect(actionsFor('played')).toEqual(['correct', 'clear'])
  })

  it('offers nothing for a status it does not know', () => {
    // An unknown state is not a licence to guess. The operator still sees what
    // the server calls it.
    expect(actionsFor('abandoned')).toEqual([])
  })
})

describe('the matchweek readiness view', () => {
  const readiness = presentSeasonReadiness({
    matchweek: 2,
    matchweekCount: 38,
    fixtures: [
      fixture({ id: 'a' }),
      fixture({ id: 'b', status: 'played', homeScore: 2, awayScore: 1 }),
      fixture({ id: 'c', kickoffAt: null }),
    ],
  })

  it('counts what an operator is deciding on', () => {
    expect(readiness.fixtures).toBe(3)
    expect(readiness.withResult).toBe(1)
    expect(readiness.withoutKickoff).toBe(1)
  })

  it('requires a reason exactly where the server does', () => {
    // Confirming a first result needs none; changing or removing one that has
    // already been scored does.
    expect(readiness.rows.find((row) => row.id === 'a')?.reasonRequired).toBe(false)
    expect(readiness.rows.find((row) => row.id === 'b')?.reasonRequired).toBe(true)
  })

  it('shows a score only when the server holds both halves of one', () => {
    expect(readiness.rows.find((row) => row.id === 'b')?.score).toBe('2 - 1')
    expect(readiness.rows.find((row) => row.id === 'a')?.score).toBeNull()
  })
})

describe('the games an operator may open', () => {
  it('shows a finished competition and explains it rather than hiding it', () => {
    const [entry] = openableGames([game({ completedAt: '2027-05-24T16:00:00Z' })])
    expect(entry?.unavailable).toContain('finished')
  })

  it('offers a live one', () => {
    const [entry] = openableGames([game()])
    expect(entry?.unavailable).toBeNull()
    expect(entry?.name).toBe('Last Man Standing')
  })
})

describe('reading the opening outcome back', () => {
  it('reports what was scheduled when a calendar was created', () => {
    expect(openOutcomeMessage(outcome({ windows: 3, setupWritten: true }))).toContain(
      '3 rounds scheduled',
    )
  })

  it('does not dress "already open" as a change', () => {
    expect(openOutcomeMessage(outcome({ outcome: 'already_open' }))).toContain('Nothing was changed')
  })

  it('explains an underivable calendar in terms of the kickoffs that cause it', () => {
    expect(openOutcomeMessage(outcome({ outcome: 'no_schedulable_round' }))).toContain(
      'confirmed kickoff',
    )
  })

  it('says why a private competition is refused', () => {
    const message = openOutcomeMessage(
      outcome({ outcome: 'refused', reason: 'private_setup_not_chosen' }),
    )
    expect(message).toContain("organiser's")
  })

  it('names an outcome it has never heard of rather than swallowing it', () => {
    // A later contract adding an outcome should degrade to naming it. Silence
    // would report a write this page cannot describe as if it reported nothing.
    expect(openOutcomeMessage(outcome({ outcome: 'quiesced' }))).toContain('quiesced')
  })
})

describe('administrator refusals', () => {
  it('names the missing capability rather than telling an operator to retry', () => {
    expect(seasonAdminRefusal({ code: '42501' })).toContain('administrator capability')
  })

  it('sends a state refusal back to the fixture rather than round a retry loop', () => {
    // 23514 covers four different transition rules. Guessing which would be
    // wrong three times out of four; the fixture's current status is the answer
    // and it is one read away.
    expect(seasonAdminRefusal({ code: '23514' })).toContain('Reload the matchweek')
  })

  it('states the argument rules for a missing reason or score', () => {
    expect(seasonAdminRefusal({ code: '22023' })).toContain('reason is required')
  })

  it('falls back to safe generic copy for a code it does not know', () => {
    // No raw database, RPC or network detail may reach an operator either.
    const message = seasonAdminRefusal({ code: 'XX999', message: 'relation "x" does not exist' })
    expect(message).not.toContain('relation')
  })
})
