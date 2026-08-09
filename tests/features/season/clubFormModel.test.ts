import { describe, expect, it } from 'vitest'
import {
  summariseClubForm,
  summariseHeadToHead,
} from '../../../src/features/season/clubFormModel'
import {
  mapClubHeadToHead,
  mapSeasonClubForm,
} from '../../../src/services/supabase/seasonClubFormModel'

function formPayload(clubs: Record<string, unknown>[], matches = 6) {
  return { server_now: '2026-08-09T12:00:00Z', matches, clubs }
}

function club(overrides: Record<string, unknown> = {}) {
  return {
    team_id: 't-celtic',
    name: 'Celtic',
    short_code: 'CEL',
    club_colours: 'Green / White',
    played: 6,
    won: 4,
    drawn: 1,
    lost: 1,
    goals_for: 13,
    goals_against: 6,
    form: ['W', 'W', 'D', 'L', 'W', 'W'],
    ...overrides,
  }
}

describe('decoding contract 141’s club form', () => {
  it('keeps the server’s outcome letters rather than re-deriving them from goals', () => {
    // W/D/L is computed server-side from the settled score. Re-deriving it here
    // would be a second opinion about who won a match.
    const table = mapSeasonClubForm(formPayload([club()]))
    expect(table.clubs[0]?.form).toEqual(['W', 'W', 'D', 'L', 'W', 'W'])
  })

  it('resolves club identity from the stored code and colours', () => {
    const table = mapSeasonClubForm(formPayload([club()]))
    expect(table.clubs[0]?.tokens.monogram).toBe('CEL')
  })

  it('drops anything in the form array that is not one of the three letters', () => {
    // A form string is only readable because every character means one of
    // three things.
    const table = mapSeasonClubForm(formPayload([club({ form: ['W', 'X', null, 'L'] })]))
    expect(table.clubs[0]?.form).toEqual(['W', 'L'])
  })

  it('drops a club with no team id, which is the key the head-to-head needs', () => {
    const table = mapSeasonClubForm(formPayload([club({ team_id: null })]))
    expect(table.clubs).toHaveLength(0)
  })

  it('reads a season with no clubs without inventing one', () => {
    expect(mapSeasonClubForm(formPayload([])).clubs).toEqual([])
    expect(mapSeasonClubForm(null).clubs).toEqual([])
  })
})

describe('what recent form says', () => {
  it('states the record over the matches actually played, not the window asked for', () => {
    // A club four matches into a six-match window has a record over four.
    // "of the last 6" would be counting matches that do not exist.
    const table = mapSeasonClubForm(
      formPayload([club({ played: 4, won: 3, drawn: 0, lost: 1, form: ['W', 'W', 'L', 'W'] })]),
    )
    const summary = summariseClubForm(table.clubs[0] ?? null)

    expect(summary.record).toBe('Won 3, drawn 0, lost 1 of the last 4')
  })

  it('signs the goal difference so a positive one reads as positive', () => {
    expect(summariseClubForm(mapSeasonClubForm(formPayload([club()])).clubs[0] ?? null)
      .goalDifference).toBe('+7')
    expect(
      summariseClubForm(
        mapSeasonClubForm(formPayload([club({ goals_for: 3, goals_against: 9 })])).clubs[0] ??
          null,
      ).goalDifference,
    ).toBe('-6')
  })

  it('says a club with nothing settled has no form, rather than showing a bad run', () => {
    // At Matchweek 1 this is every club in the competition, and an empty row of
    // pills reads as six defeats.
    const table = mapSeasonClubForm(
      formPayload([club({ played: 0, won: 0, drawn: 0, lost: 1, form: [] })]),
    )
    const summary = summariseClubForm(table.clubs[0] ?? null)

    expect(summary.record).toBeNull()
    expect(summary.letters).toEqual([])
    expect(summary.played).toBe(0)
  })

  it('says the same for a club the form read does not name at all', () => {
    expect(summariseClubForm(null).record).toBeNull()
  })
})

function headPayload(meetings: Record<string, unknown>[], summary: Record<string, unknown>) {
  return {
    server_now: '2026-08-09T12:00:00Z',
    team: { team_id: 't-celtic', name: 'Celtic' },
    opponent: { team_id: 't-hibs', name: 'Hibernian' },
    summary: { played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, ...summary },
    meetings,
  }
}

describe('what this season’s meetings say', () => {
  it('says the two have not met rather than showing an empty list', () => {
    const summary = summariseHeadToHead(mapClubHeadToHead(headPayload([], {})))
    expect(summary?.headline).toBe('Celtic and Hibernian have not met yet this season.')
    expect(summary?.meetings).toEqual([])
  })

  it('scopes the headline to the season, because the read is', () => {
    // Carrying meetings from previous seasons needs a competition-lineage
    // decision the contract has no authority to make; a headline without "this
    // season" would quietly claim a longer history.
    const summary = summariseHeadToHead(
      mapClubHeadToHead(headPayload([], { played: 2, won: 1, drawn: 0, lost: 1 })),
    )
    expect(summary?.headline).toContain('this season')
    expect(summary?.headline).toContain('met 2 times')
  })

  it('uses the singular for one meeting', () => {
    const summary = summariseHeadToHead(
      mapClubHeadToHead(headPayload([], { played: 1, won: 1 })),
    )
    expect(summary?.headline).toContain('met once this season')
  })

  it('prints the scoreline this club’s goals first, matching the verb beside it', () => {
    // Home-first would make "won 1 - 2" possible, which is nonsense.
    const summary = summariseHeadToHead(
      mapClubHeadToHead(
        headPayload(
          [
            {
              season_fixture_id: 'f1',
              kickoff_at: '2026-08-02T14:00:00Z',
              at_home: false,
              goals_for: 2,
              goals_against: 1,
              outcome: 'W',
              round: 'Matchweek 2',
            },
          ],
          { played: 1, won: 1, goals_for: 2, goals_against: 1 },
        ),
      ),
    )

    // The club name comes from the READ, not from whichever fixture row the
    // panel happens to be rendering: two names for one result is how a panel
    // ends up saying "Rangers won 2 - 0" under a Celtic-and-Hibernian headline.
    expect(summary?.meetings[0]?.text).toBe('Celtic · Matchweek 2 · won 2 - 1 · away')
    expect(summary?.meetings[0]?.outcome).toBe('W')
  })

  it('drops a meeting with no outcome rather than printing a blank line', () => {
    const head = mapClubHeadToHead(
      headPayload([{ season_fixture_id: 'f1', outcome: null }], { played: 1 }),
    )
    expect(head.meetings).toHaveLength(0)
  })
})
