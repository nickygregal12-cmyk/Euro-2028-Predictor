import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { resolveClubIdentity } from '../../../src/domain/clubIdentity/clubIdentityTokens'
import type { CardStatus } from '../../../src/domain/season/cardSubmission'
import { MatchweekPoints } from '../../../src/features/scoring/MatchweekPoints'
import { presentMatchweekPoints } from '../../../src/features/scoring/matchweekPointsModel'
import type {
  MatchPredictorFixture,
  MatchPredictorPage,
} from '../../../src/features/season/matchPredictorModel'

/**
 * "Why did I get these points?" for a settled season matchweek.
 *
 * THE PROPERTY THESE ASSERTIONS EXIST FOR: the total on screen is the season's,
 * never a sum computed here. A breakdown that adds its own rows up and prints
 * the answer will eventually disagree with the player's own standing — after a
 * correction, after a postponement, after a rule the browser is behind on — and
 * a player told two different numbers for the same matchweek has no way to know
 * which one counts. So the rows are itemisation and the total is authority, and
 * where they do not meet, the surface says so.
 *
 * THE SECOND: the Joker is one line after the fixtures, because ADR 0012
 * doubles the MATCHWEEK. Doubling each row reaches the same total by a route the
 * rule does not take, and teaches the player a rule that is not the rule.
 */

const club = (name: string) => ({
  name,
  shortName: name,
  tokens: resolveClubIdentity({ externalId: name, name }),
})

function fixture(
  id: string,
  prediction: { home: number; away: number } | null,
  result: { home: number; away: number } | null,
  points: number | null,
  names: [string, string] = ['Dundee', 'Aberdeen'],
): MatchPredictorFixture {
  return {
    fixtureId: id,
    kickoffAt: '2026-08-08T14:00:00Z',
    home: club(names[0]),
    away: club(names[1]),
    prediction,
    result,
    points,
  }
}

function card(overrides: {
  fixtures?: MatchPredictorFixture[]
  cardStatus?: CardStatus
  settledPoints?: number | null
  jokerHere?: boolean
}): MatchPredictorPage {
  return {
    competition: { name: 'Scottish Premiership', seasonLabel: '2026/27', timeZone: 'Europe/London' },
    matchweek: { number: 5, of: 38 },
    fixtures: overrides.fixtures ?? [],
    cardStatus: overrides.cardStatus ?? 'confirmed',
    lock: {
      status: 'locked',
      locked: true,
      lockAt: '2026-08-08T14:00:00Z',
      reason: 'scope_lock_reached',
    },
    joker: {
      playedHere: overrides.jokerHere ?? false,
      remainingThisHalf: 4,
      playable: false,
    },
    settledPoints: overrides.settledPoints ?? null,
  }
}

const SETTLED = card({
  fixtures: [
    fixture('f1', { home: 2, away: 1 }, { home: 2, away: 1 }, 5),
    fixture('f2', { home: 1, away: 0 }, { home: 3, away: 0 }, 3, ['Celtic', 'Ross County']),
    fixture('f3', { home: 0, away: 2 }, { home: 1, away: 0 }, 0, ['Hearts', 'Hibernian']),
    fixture('f4', null, { home: 1, away: 1 }, 0, ['Kilmarnock', 'Motherwell']),
  ],
  settledPoints: 8,
})

describe('presentMatchweekPoints', () => {
  it('says nothing at all about a matchweek that has not settled', () => {
    const view = presentMatchweekPoints(
      card({ fixtures: [fixture('f1', { home: 2, away: 1 }, null, null)], settledPoints: null }),
    )

    expect(view.kind).toBe('unsettled')
  })

  it('takes every number from the server and never from its own arithmetic', () => {
    const view = presentMatchweekPoints(SETTLED)
    if (view.kind !== 'itemised') throw new Error('expected an itemised matchweek')

    expect(view.rows.map((row) => row.points)).toEqual([5, 3, 0, 0])
    expect(view.total).toBe(8)
    expect(view.reconciles).toBe(true)
  })

  it('names the reason from the shared authority rather than comparing again', () => {
    const view = presentMatchweekPoints(SETTLED)
    if (view.kind !== 'itemised') throw new Error('expected an itemised matchweek')

    expect(view.rows.map((row) => row.reason)).toEqual([
      'exact_score',
      'correct_result',
      'wrong',
      'unscored',
    ])
    expect(view.exact).toBe(1)
    expect(view.correctResult).toBe(1)
    expect(view.missed).toBe(1)
    expect(view.blank).toBe(1)
  })

  it('applies the Joker once to the matchweek, never per fixture', () => {
    const view = presentMatchweekPoints(
      card({ fixtures: SETTLED.fixtures.slice(), settledPoints: 16, jokerHere: true }),
    )
    if (view.kind !== 'itemised') throw new Error('expected an itemised matchweek')

    // The rows are undoubled — the doubling is a line of its own.
    expect(view.rows.map((row) => row.points)).toEqual([5, 3, 0, 0])
    expect(view.subtotal).toBe(8)
    expect(view.joker).toEqual({ doubled: 8 })
    expect(view.total).toBe(16)
    expect(view.reconciles).toBe(true)
  })

  it('refuses to reconcile when the rows do not account for the banked total', () => {
    const view = presentMatchweekPoints(
      card({ fixtures: SETTLED.fixtures.slice(), settledPoints: 11 }),
    )
    if (view.kind !== 'itemised') throw new Error('expected an itemised matchweek')

    // The total is still the server's. Nothing is adjusted to make it fit.
    expect(view.total).toBe(11)
    expect(view.subtotal).toBe(8)
    expect(view.reconciles).toBe(false)
  })

  it('treats an outstanding fixture as outstanding rather than as a discrepancy', () => {
    const view = presentMatchweekPoints(
      card({
        fixtures: [
          fixture('f1', { home: 2, away: 1 }, { home: 2, away: 1 }, 5),
          fixture('f2', { home: 1, away: 0 }, null, null, ['Celtic', 'Ross County']),
        ],
        settledPoints: 5,
      }),
    )
    if (view.kind !== 'itemised') throw new Error('expected an itemised matchweek')

    expect(view.rows).toHaveLength(1)
    expect(view.unsettled).toBe(1)
    // A postponed fixture is not a mismatch, and a warning about one would be
    // a false alarm on every rescheduled matchweek of the season.
    expect(view.reconciles).toBe(false)
  })

  it('distinguishes a card that banked nothing from one that scored zero', () => {
    const view = presentMatchweekPoints(
      card({
        fixtures: [fixture('f1', null, { home: 2, away: 1 }, 0)],
        cardStatus: 'no_submission',
        settledPoints: 0,
      }),
    )

    expect(view.kind).toBe('unbanked')
  })
})

describe('the matchweek points disclosure', () => {
  it('renders nothing before the matchweek settles', () => {
    const { container } = render(
      <MatchweekPoints
        card={card({ fixtures: [fixture('f1', { home: 2, away: 1 }, null, null)] })}
      />,
    )

    expect(container.textContent).toBe('')
  })

  it('summarises without being opened, and itemises when it is', () => {
    render(<MatchweekPoints card={SETTLED} />)

    expect(screen.getByText('Why 8 points')).toBeInTheDocument()
    expect(screen.getByText('1 exact · 1 right result · 1 wrong · 1 left blank')).toBeInTheDocument()
    expect(screen.queryByText('Dundee v Aberdeen')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Why 8 points/ }))

    expect(screen.getByText('Dundee v Aberdeen')).toBeInTheDocument()
    expect(screen.getByText(/Exact score · you 2 - 1, finished 2 - 1/)).toBeInTheDocument()
    expect(screen.getByText(/No prediction · no prediction, finished 1 - 1/)).toBeInTheDocument()
  })

  it('shows the Joker as a line after the fixtures, not as doubled rows', () => {
    render(
      <MatchweekPoints
        card={card({ fixtures: SETTLED.fixtures.slice(), settledPoints: 16, jokerHere: true })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Why 16 points/ }))

    expect(screen.getByText('Joker · doubles the whole matchweek')).toBeInTheDocument()
    expect(screen.getByText('+8')).toBeInTheDocument()
    expect(screen.getByText('+5')).toBeInTheDocument() // the exact score, undoubled
  })

  it('prints the banked total and admits the itemisation when they disagree', () => {
    render(<MatchweekPoints card={card({ fixtures: SETTLED.fixtures.slice(), settledPoints: 11 })} />)
    fireEvent.click(screen.getByRole('button', { name: /Why 11 points/ }))

    expect(screen.getByText(/11 is the total that counts/)).toBeInTheDocument()
    expect(screen.getByText(/the itemisation above is incomplete/)).toBeInTheDocument()
  })

  it('explains an outstanding fixture rather than warning about a discrepancy', () => {
    render(
      <MatchweekPoints
        card={card({
          fixtures: [
            fixture('f1', { home: 2, away: 1 }, { home: 2, away: 1 }, 5),
            fixture('f2', { home: 1, away: 0 }, null, null, ['Celtic', 'Ross County']),
          ],
          settledPoints: 5,
        })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Why 5 points/ }))

    expect(screen.getByText(/1 fixture on this matchweek has not been settled yet/)).toBeInTheDocument()
    expect(screen.queryByText(/the itemisation above is incomplete/)).toBeNull()
  })

  it('says a card banked nothing rather than itemising a card that was never entered', () => {
    render(
      <MatchweekPoints
        card={card({
          fixtures: [fixture('f1', null, { home: 2, away: 1 }, 0)],
          cardStatus: 'no_submission',
          settledPoints: 0,
        })}
      />,
    )

    expect(screen.getByText(/nothing was banked and it scored 0/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('keeps a hostile club name inside the row rather than truncating the fixture', () => {
    render(
      <MatchweekPoints
        card={card({
          fixtures: [
            fixture(
              'f1',
              { home: 2, away: 1 },
              { home: 2, away: 1 },
              5,
              ['Borussia Mönchengladbach Reserves Under-21', 'Inverness Caledonian Thistle'],
            ),
          ],
          settledPoints: 5,
        })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Why 5 points/ }))

    expect(
      screen.getByText(
        'Borussia Mönchengladbach Reserves Under-21 v Inverness Caledonian Thistle',
      ),
    ).toBeInTheDocument()
  })
})
