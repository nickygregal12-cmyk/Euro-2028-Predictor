import { describe, expect, it } from 'vitest'
import { presentFixtureList } from '../../../src/features/season/fixtureListModel'
import { presentMatchCentre } from '../../../src/features/season/matchCentreModel'
import { mapSeasonFixtureList } from '../../../src/services/supabase/seasonFixtureListModel'
import { resolveClubIdentity } from '../../../src/domain/clubIdentity/clubIdentityTokens'
import type { CardStatus } from '../../../src/domain/season/cardSubmission'
import type { MatchPredictorPage } from '../../../src/features/season/matchPredictorModel'

const ZONE = 'Europe/London'

function row(overrides: Record<string, unknown> = {}) {
  const page = mapSeasonFixtureList({
    competition: { id: 'season-1', name: 'Scottish Premiership', season_key: '2026-27', time_zone: ZONE },
    window: { from: '2026-08-01T00:00:00Z', to: '2026-08-22T00:00:00Z' },
    server_now: '2026-08-08T09:00:00Z',
    fixtures: [
      {
        id: 'f1',
        kickoff_at: '2026-08-08T14:00:00Z',
        status: 'scheduled',
        round: { id: 'r5', ordinal: 5, label: 'Matchweek 5' },
        home: { name: 'Dundee', short_code: 'DUN', club_colours: 'Navy / White' },
        away: { name: 'Aberdeen', short_code: 'ABE', club_colours: 'Red / White' },
        result: null,
        live: null,
        ...overrides,
      },
    ],
  })
  const view = presentFixtureList(page, ZONE)
  const found = view.days[0]?.rows[0]
  if (!found) throw new Error('the fixture list dropped the fixture under test')
  return found
}

const club = (name: string) => ({
  name,
  shortName: name,
  tokens: resolveClubIdentity({ externalId: name, name }),
})

function card(overrides: {
  prediction?: { home: number; away: number } | null
  result?: { home: number; away: number } | null
  cardStatus?: CardStatus
  settledPoints?: number | null
  jokerHere?: boolean
}): MatchPredictorPage {
  return {
    competition: { name: 'Scottish Premiership', seasonLabel: '2026/27', timeZone: ZONE },
    matchweek: { number: 5, of: 38 },
    fixtures: [
      {
        fixtureId: 'f1',
        kickoffAt: '2026-08-08T14:00:00Z',
        home: club('Dundee'),
        away: club('Aberdeen'),
        prediction: overrides.prediction ?? null,
        result: overrides.result ?? null,
        points: null,
      },
    ],
    cardStatus: overrides.cardStatus ?? 'provisional',
    // The Match Centre reads what happened rather than what may still be
    // entered, so the lock is scenery here — every case below is the same
    // whatever it says.
    lock: { status: 'open', locked: false, lockAt: null, reason: 'before_scope_lock' },
    joker: {
      playedHere: overrides.jokerHere ?? false,
      remainingThisHalf: 4,
      playable: true,
    },
    settledPoints: overrides.settledPoints ?? null,
  }
}

describe('one fixture, and what it did to the player', () => {
  it('awards the exact-score points from the settled result', () => {
    const view = presentMatchCentre(
      row(),
      card({ prediction: { home: 2, away: 1 }, result: { home: 2, away: 1 } }),
    )

    expect(view.outcome).toEqual({ kind: 'scored', points: 5, exact: true })
    expect(view.explanation).toMatch(/Exact score/)
  })

  it('awards the correct-result points without stacking the exact bonus', () => {
    const view = presentMatchCentre(
      row(),
      card({ prediction: { home: 3, away: 0 }, result: { home: 2, away: 1 } }),
    )

    expect(view.outcome).toEqual({ kind: 'scored', points: 3, exact: false })
  })

  it('awards nothing for the wrong result and says so as a result rather than an error', () => {
    const view = presentMatchCentre(
      row(),
      card({ prediction: { home: 0, away: 2 }, result: { home: 2, away: 1 } }),
    )

    expect(view.outcome).toEqual({ kind: 'scored', points: 0, exact: false })
    expect(view.explanation).toMatch(/Wrong result/)
  })

  it('NEVER scores a provisional score, however exactly it matches', () => {
    // The whole point of this surface. A provider reporting 2-1 against a
    // predicted 2-1 is five very tempting points, and the platform has not
    // settled the fixture — the provider's number can move or be withdrawn.
    const view = presentMatchCentre(
      row({
        status: 'live',
        live: { kind: 'in_play', home: 2, away: 1, observed_at: '2026-08-08T15:40:00Z' },
      }),
      card({ prediction: { home: 2, away: 1 } }),
    )

    expect(view.outcome).toEqual({ kind: 'pending' })
    expect(view.result).toBeNull()
    expect(view.provisional?.score).toBe('2 - 1')
    expect(view.explanation).toMatch(/not a result/)
  })

  it('keeps the provisional score out of the result field once a result exists', () => {
    // Two fields, and the settled one wins. A provider still reporting 1-1 on a
    // fixture the platform settled 2-1 must not show both as scores.
    const view = presentMatchCentre(
      row({
        status: 'played',
        result: { home: 2, away: 1 },
        live: { kind: 'full_time', home: 1, away: 1, observed_at: '2026-08-08T15:40:00Z' },
      }),
      card({ prediction: { home: 2, away: 1 }, result: { home: 2, away: 1 } }),
    )

    expect(view.result).toBe('2 - 1')
    expect(view.provisional).toBeNull()
  })

  it('scores nothing for a card the player never entered', () => {
    // Unbanked at lock. Printing "5 pts" beside a perfect prediction that
    // banked nothing would be the cruellest thing this surface could say.
    const view = presentMatchCentre(
      row({ status: 'played', result: { home: 2, away: 1 } }),
      card({
        prediction: { home: 2, away: 1 },
        result: { home: 2, away: 1 },
        cardStatus: 'no_submission',
      }),
    )

    expect(view.outcome).toEqual({ kind: 'unbanked' })
    expect(view.explanation).toMatch(/did not enter this matchweek/)
  })

  it('distinguishes a blank fixture on an entered card from an unentered card', () => {
    const view = presentMatchCentre(
      row({ status: 'played', result: { home: 2, away: 1 } }),
      card({ prediction: null, result: { home: 2, away: 1 }, cardStatus: 'provisional' }),
    )

    expect(view.outcome).toEqual({ kind: 'blank' })
    expect(view.explanation).toMatch(/left this fixture blank/)
  })

  it('says the Joker doubles the matchweek and never the fixture', () => {
    // A per-fixture "doubled" would invite the player to double it themselves
    // and disagree with the server's total.
    const view = presentMatchCentre(
      row({ status: 'played', result: { home: 2, away: 1 } }),
      card({
        prediction: { home: 2, away: 1 },
        result: { home: 2, away: 1 },
        settledPoints: 34,
        jokerHere: true,
      }),
    )

    expect(view.outcome).toEqual({ kind: 'scored', points: 5, exact: true })
    expect(view.matchweekPoints).toBe(34)
    expect(view.jokerNote).toMatch(/never one fixture/)
  })

  it('says nothing about the Joker where it changes nothing', () => {
    const view = presentMatchCentre(row(), card({ prediction: { home: 1, away: 0 } }))
    expect(view.jokerNote).toBeNull()
  })

  it('is honest about a fixture the card does not carry', () => {
    // A rescheduled fixture can be read from a window whose matchweek card no
    // longer lists it. No prediction, no result, no guess.
    const view = presentMatchCentre(row(), {
      ...card({}),
      fixtures: [],
    })

    expect(view.prediction).toBeNull()
    expect(view.outcome).toEqual({ kind: 'pending' })
  })
})
