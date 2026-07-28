import { describe, it, expect } from 'vitest'
import { resolveCompetitionStatus } from '../../../src/domain/competitions/resolveCompetitionStatus'
import type {
  CompetitionEntrant,
  CompetitionRecord,
  CompetitionWindow,
  WindowFixtureAggregate,
} from '../../../src/domain/competitions/competitionModel'

const T = (iso: string) => new Date(iso)

const NOTHING_PLAYED: WindowFixtureAggregate = {
  total: 8,
  live: 0,
  awaitingConfirmation: 0,
  confirmed: 0,
}

function competition(overrides: Partial<CompetitionRecord> = {}): CompetitionRecord {
  return {
    id: 'comp-ko',
    gameKey: 'ko_predictor',
    tournamentId: 'euro-2028',
    published: true,
    registrationOpensAt: '2028-06-26T00:00:00Z',
    registrationClosesAt: null, // rolling entry — the KO Predictor's decided rule
    drawRequired: false,
    drawCompletedAt: null,
    completedAt: null,
    ...overrides,
  }
}

function window(overrides: Partial<CompetitionWindow> = {}): CompetitionWindow {
  return {
    id: 'win-r16',
    competitionId: 'comp-ko',
    sequence: 1,
    label: 'Round of 16',
    opensAt: '2028-06-26T12:00:00Z',
    locksAt: '2028-06-28T17:00:00Z',
    settlesAt: '2028-06-30T23:00:00Z',
    requiresTieBreakInput: false,
    fixtures: { ...NOTHING_PLAYED },
    ...overrides,
  }
}

function entrant(overrides: Partial<CompetitionEntrant> = {}): CompetitionEntrant {
  return {
    competitionId: 'comp-ko',
    userId: 'user-1',
    joinedAt: '2028-06-26T09:00:00Z',
    outcome: 'active',
    pendingInputs: 0,
    ...overrides,
  }
}

describe('resolveCompetitionStatus — non-entrant registration view', () => {
  it('reports not_open while the competition is unpublished', () => {
    const result = resolveCompetitionStatus({
      competition: competition({ published: false }),
      windows: [window()],
      entrant: null,
      now: T('2028-06-27T12:00:00Z'),
    })
    expect(result.state).toBe('not_open')
    expect(result.entered).toBe(false)
  })

  it('reports not_open before registration opens, even when published', () => {
    const result = resolveCompetitionStatus({
      competition: competition(),
      windows: [window()],
      entrant: null,
      now: T('2028-06-25T23:59:59Z'),
    })
    expect(result.state).toBe('not_open')
  })

  it('opens registration exactly at the opening instant (inclusive boundary)', () => {
    const result = resolveCompetitionStatus({
      competition: competition(),
      windows: [window()],
      entrant: null,
      now: T('2028-06-26T00:00:00Z'),
    })
    expect(result.state).toBe('registration_open')
  })

  it('surfaces the registration close as the next deadline when one exists', () => {
    const result = resolveCompetitionStatus({
      competition: competition({ registrationClosesAt: '2028-06-28T17:00:00Z' }),
      windows: [window()],
      entrant: null,
      now: T('2028-06-27T12:00:00Z'),
    })
    expect(result.state).toBe('registration_open')
    expect(result.nextDeadline).toBe('2028-06-28T17:00:00Z')
  })

  it('reports registration_closed after the close instant', () => {
    const result = resolveCompetitionStatus({
      competition: competition({ registrationClosesAt: '2028-06-28T17:00:00Z' }),
      windows: [window()],
      entrant: null,
      now: T('2028-06-28T17:00:01Z'),
    })
    expect(result.state).toBe('registration_closed')
  })

  it('keeps rolling entry open indefinitely when no close instant is set', () => {
    const result = resolveCompetitionStatus({
      competition: competition(),
      windows: [window()],
      entrant: null,
      now: T('2028-07-05T12:00:00Z'),
    })
    expect(result.state).toBe('registration_open')
    expect(result.nextDeadline).toBeNull()
  })
})

describe('resolveCompetitionStatus — entrant round states', () => {
  it('reports entered before the first window opens', () => {
    const result = resolveCompetitionStatus({
      competition: competition(),
      windows: [window()],
      entrant: entrant(),
      now: T('2028-06-26T09:30:00Z'),
    })
    expect(result.state).toBe('entered')
  })

  it('reports action_required while inputs are owed in an open window', () => {
    const result = resolveCompetitionStatus({
      competition: competition(),
      windows: [window()],
      entrant: entrant({ pendingInputs: 3 }),
      now: T('2028-06-27T12:00:00Z'),
    })
    expect(result.state).toBe('action_required')
    expect(result.nextDeadline).toBe('2028-06-28T17:00:00Z')
  })

  it('reports waiting_for_round when the window is open and nothing is owed', () => {
    const result = resolveCompetitionStatus({
      competition: competition(),
      windows: [window()],
      entrant: entrant(),
      now: T('2028-06-27T12:00:00Z'),
    })
    expect(result.state).toBe('waiting_for_round')
  })

  it('stops requiring action once the window has locked, even with inputs owed', () => {
    const result = resolveCompetitionStatus({
      competition: competition(),
      windows: [window()],
      entrant: entrant({ pendingInputs: 3 }),
      now: T('2028-06-28T17:00:01Z'),
    })
    expect(result.state).not.toBe('action_required')
    expect(result.state).toBe('waiting_for_round')
  })

  it('reports round_live while a fixture in the window is in play', () => {
    const result = resolveCompetitionStatus({
      competition: competition(),
      windows: [window({ fixtures: { total: 8, live: 1, awaitingConfirmation: 0, confirmed: 3 } })],
      entrant: entrant(),
      now: T('2028-06-29T19:00:00Z'),
    })
    expect(result.state).toBe('round_live')
  })

  it('prefers a live fixture over an unconfirmed one', () => {
    const result = resolveCompetitionStatus({
      competition: competition(),
      windows: [window({ fixtures: { total: 8, live: 1, awaitingConfirmation: 2, confirmed: 5 } })],
      entrant: entrant(),
      now: T('2028-06-29T19:00:00Z'),
    })
    expect(result.state).toBe('round_live')
  })

  it('reports round_awaiting_confirmation for played-but-unconfirmed fixtures', () => {
    const result = resolveCompetitionStatus({
      competition: competition(),
      windows: [window({ fixtures: { total: 8, live: 0, awaitingConfirmation: 2, confirmed: 6 } })],
      entrant: entrant(),
      now: T('2028-06-30T22:00:00Z'),
    })
    expect(result.state).toBe('round_awaiting_confirmation')
  })

  it('never settles a window on provisional results, so it does not advance early', () => {
    // Every fixture has finished but two are unconfirmed and the settle instant
    // has passed. Nothing may be scored or progressed from this.
    const result = resolveCompetitionStatus({
      competition: competition(),
      windows: [
        window({ fixtures: { total: 8, live: 0, awaitingConfirmation: 2, confirmed: 6 } }),
        window({ id: 'win-qf', sequence: 2, label: 'Quarter-finals', opensAt: '2028-07-03T12:00:00Z', locksAt: '2028-07-04T17:00:00Z', settlesAt: '2028-07-05T23:00:00Z' }),
      ],
      entrant: entrant(),
      now: T('2028-07-01T09:00:00Z'),
    })
    expect(result.state).toBe('round_awaiting_confirmation')
    expect(result.activeWindow?.id).toBe('win-r16')
  })

  it('moves to the next window once the previous one is confirmed and settled', () => {
    const result = resolveCompetitionStatus({
      competition: competition(),
      windows: [
        window({ fixtures: { total: 8, live: 0, awaitingConfirmation: 0, confirmed: 8 } }),
        window({ id: 'win-qf', sequence: 2, label: 'Quarter-finals', opensAt: '2028-07-03T12:00:00Z', locksAt: '2028-07-04T17:00:00Z', settlesAt: '2028-07-05T23:00:00Z' }),
      ],
      entrant: entrant({ pendingInputs: 4 }),
      now: T('2028-07-03T13:00:00Z'),
    })
    expect(result.state).toBe('action_required')
    expect(result.activeWindow?.id).toBe('win-qf')
  })
})

describe('resolveCompetitionStatus — terminal and outcome states', () => {
  it('reports complete once the competition is finished, whatever the user outcome', () => {
    const result = resolveCompetitionStatus({
      competition: competition({ completedAt: '2028-07-09T23:00:00Z' }),
      windows: [window({ fixtures: { total: 8, live: 2, awaitingConfirmation: 0, confirmed: 6 } })],
      entrant: entrant({ outcome: 'qualified', pendingInputs: 5 }),
      now: T('2028-07-10T09:00:00Z'),
    })
    expect(result.state).toBe('complete')
  })

  it('reports champion ahead of any round activity', () => {
    const result = resolveCompetitionStatus({
      competition: competition(),
      windows: [window({ fixtures: { total: 8, live: 1, awaitingConfirmation: 0, confirmed: 7 } })],
      entrant: entrant({ outcome: 'champion' }),
      now: T('2028-07-09T20:00:00Z'),
    })
    expect(result.state).toBe('champion')
  })

  it('never shows an eliminated user a live round as though it were theirs', () => {
    const result = resolveCompetitionStatus({
      competition: competition(),
      windows: [window({ fixtures: { total: 8, live: 1, awaitingConfirmation: 0, confirmed: 3 } })],
      entrant: entrant({ outcome: 'eliminated', pendingInputs: 2 }),
      now: T('2028-06-29T19:00:00Z'),
    })
    expect(result.state).toBe('eliminated')
    expect(result.nextDeadline).toBeNull()
  })

  it('carries qualified between rounds when nothing is owed', () => {
    const result = resolveCompetitionStatus({
      competition: competition({ gameKey: 'predictor_cup', drawRequired: true, drawCompletedAt: '2028-06-20T12:00:00Z' }),
      windows: [window({ opensAt: '2028-06-26T12:00:00Z', locksAt: '2028-06-28T17:00:00Z', fixtures: { total: 8, live: 0, awaitingConfirmation: 0, confirmed: 8 } })],
      entrant: entrant({ outcome: 'qualified' }),
      now: T('2028-06-27T12:00:00Z'),
    })
    expect(result.state).toBe('qualified')
  })

  it('carries survived between rounds for Last Man Standing', () => {
    const result = resolveCompetitionStatus({
      competition: competition({ gameKey: 'last_man_standing' }),
      windows: [window({ fixtures: { total: 8, live: 0, awaitingConfirmation: 0, confirmed: 8 } })],
      entrant: entrant({ outcome: 'survived' }),
      now: T('2028-06-27T12:00:00Z'),
    })
    expect(result.state).toBe('survived')
  })

  it('lets an owed input outrank a standing qualified outcome', () => {
    const result = resolveCompetitionStatus({
      competition: competition({ gameKey: 'predictor_cup', drawRequired: true, drawCompletedAt: '2028-06-20T12:00:00Z' }),
      windows: [window()],
      entrant: entrant({ outcome: 'qualified', pendingInputs: 1 }),
      now: T('2028-06-27T12:00:00Z'),
    })
    expect(result.state).toBe('action_required')
  })
})

describe('resolveCompetitionStatus — draw and provisional data', () => {
  it('reports waiting_for_draw when the structure is not yet drawn', () => {
    const result = resolveCompetitionStatus({
      competition: competition({ gameKey: 'predictor_cup', drawRequired: true, drawCompletedAt: null }),
      windows: [window({ opensAt: null, locksAt: null, settlesAt: null })],
      entrant: entrant(),
      now: T('2028-06-27T12:00:00Z'),
    })
    expect(result.state).toBe('waiting_for_draw')
  })

  it('treats an unscheduled window as not yet open rather than open', () => {
    // Dates are provisional until UEFA confirms them; a null instant must never
    // be read as "now".
    const result = resolveCompetitionStatus({
      competition: competition(),
      windows: [window({ opensAt: null, locksAt: null, settlesAt: null })],
      entrant: entrant({ pendingInputs: 8 }),
      now: T('2028-06-27T12:00:00Z'),
    })
    expect(result.state).toBe('entered')
    expect(result.nextDeadline).toBeNull()
  })

  it('ignores an unparseable instant rather than guessing a boundary', () => {
    const result = resolveCompetitionStatus({
      competition: competition({ registrationOpensAt: 'not-a-date' }),
      windows: [window()],
      entrant: null,
      now: T('2028-06-27T12:00:00Z'),
    })
    expect(result.state).toBe('not_open')
  })

  it('resolves each competition independently for the same user', () => {
    const now = T('2028-06-27T12:00:00Z')
    const ko = resolveCompetitionStatus({
      competition: competition(),
      windows: [window()],
      entrant: entrant({ pendingInputs: 8 }),
      now,
    })
    const lms = resolveCompetitionStatus({
      competition: competition({ id: 'comp-lms', gameKey: 'last_man_standing' }),
      windows: [],
      entrant: null,
      now,
    })
    expect(ko.state).toBe('action_required')
    expect(lms.state).toBe('registration_open')
    expect(lms.entered).toBe(false)
  })
})
