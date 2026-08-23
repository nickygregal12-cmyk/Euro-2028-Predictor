import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SubmissionReceipt } from '../../../src/features/season/SubmissionReceipt'
import type { MatchPredictorPage } from '../../../src/features/season/matchPredictorModel'

/**
 * `INNOV-017`. The receipt's whole job is trust. Contract 214 lets it print a
 * server confirmation instant and compact reference, but it must still say no
 * more than the server supplied and must never call that evidence cryptographic.
 */

const club = (name: string) => ({
  name,
  shortName: name.slice(0, 3).toUpperCase(),
  tokens: { monogram: name.slice(0, 3).toUpperCase(), primary: '#000000' },
})

function cardOf(overrides: Partial<MatchPredictorPage> = {}): MatchPredictorPage {
  return {
    competition: { name: 'Scottish Premiership', seasonLabel: '2026/27', timeZone: 'Europe/London' },
    matchweek: { number: 5, of: 38 },
    fixtures: [
      {
        fixtureId: 'fx-1',
        kickoffAt: '2026-08-15T14:00:00Z',
        home: club('Celtic'),
        away: club('Rangers'),
        prediction: { home: 2, away: 1 },
        result: null,
        points: null,
      },
      {
        fixtureId: 'fx-2',
        kickoffAt: '2026-08-15T14:00:00Z',
        home: club('Hearts'),
        away: club('Hibernian'),
        prediction: null,
        result: null,
        points: null,
      },
    ],
    cardStatus: 'provisional',
    lock: { state: 'open', locksAt: '2026-08-15T14:00:00Z', reason: 'matchweek' } as never,
    joker: { playedHere: false, remainingThisHalf: 5, playable: true },
    settledPoints: null,
    ...overrides,
  }
}

describe('SubmissionReceipt', () => {
  it('renders nothing where nothing has been entered', () => {
    const { container } = render(
      <SubmissionReceipt
        card={cardOf({
          fixtures: cardOf().fixtures.map((fixture) => ({ ...fixture, prediction: null })),
        })}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('states what was entered, out of how many', () => {
    render(<SubmissionReceipt card={cardOf()} />)
    expect(screen.getByText(/Matchweek 5 · 1 of 2 fixtures entered/)).toBeInTheDocument()
  })

  it('keeps saved and confirmed apart', () => {
    const saved = render(<SubmissionReceipt card={cardOf()} />)
    expect(screen.getByRole('heading', { name: 'Saved on the server' })).toBeInTheDocument()
    saved.unmount()

    render(<SubmissionReceipt card={cardOf({ cardStatus: 'confirmed' })} />)
    expect(screen.getByRole('heading', { name: 'Predictions submitted' })).toBeInTheDocument()
  })

  it('says the server holds it, not the device', () => {
    render(<SubmissionReceipt card={cardOf({ cardStatus: 'confirmed' })} />)
    expect(screen.getByText(/held by the server, not by this device/)).toBeInTheDocument()
  })

  it('prints the server confirmation evidence when Contract 214 supplied it', () => {
    render(
      <SubmissionReceipt
        card={cardOf({
          cardStatus: 'confirmed',
          confirmedAt: '2026-08-20T12:34:00Z',
          confirmationReference: 'MW5-1A2B3C4D',
        })}
      />,
    )

    expect(screen.getByText(/Ref MW5-1A2B3C4D/)).toBeInTheDocument()
    expect(screen.getByText(/Confirmed .*12:34|Confirmed .*13:34/)).toBeInTheDocument()
  })

  it('invents no evidence during the hosted rollout gap and makes no cryptographic claim', () => {
    const { container } = render(<SubmissionReceipt card={cardOf({ cardStatus: 'confirmed' })} />)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\bRef\b/)
    expect(text).not.toMatch(/cryptograph/i)
    expect(text).not.toMatch(/verified/i)
    expect(text).not.toMatch(/\d{1,2}:\d{2}/)
  })

  it('mentions a Joker only where one was played', () => {
    const without = render(<SubmissionReceipt card={cardOf()} />)
    expect(without.container.textContent).not.toContain('Joker')
    without.unmount()

    render(
      <SubmissionReceipt
        card={cardOf({ joker: { playedHere: true, remainingThisHalf: 4, playable: true } })}
      />,
    )
    expect(screen.getByText(/Joker played/)).toBeInTheDocument()
  })
})
