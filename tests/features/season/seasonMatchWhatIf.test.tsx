import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SeasonMatchWhatIf } from '../../../src/features/season/SeasonMatchWhatIf'
import type { WhatIfInput } from '../../../src/features/season/whatIfModel'

/**
 * `INNOV-001` on screen. The rendering test exists for one reason above all
 * others: every figure has to read as a projection, and the panel must vanish
 * rather than explain itself when there is nothing to project.
 */

const input: WhatIfInput = {
  fixtureId: 'fx-1',
  homeName: 'Liverpool',
  awayName: 'Arsenal',
  prediction: { home: 2, away: 1 },
  result: null,
  live: { home: 1, away: 1 },
  league: {
    leagueName: 'The Office',
    memberCount: 2,
    fixtures: [
      { id: 'fx-1', result: null },
      { id: 'fx-2', result: null },
    ],
    members: [
      {
        userId: 'u-me',
        displayName: 'You',
        isSelf: true,
        jokerPlayed: false,
        points: null,
        predictions: { 'fx-1': { home: 2, away: 1 } },
      },
      {
        userId: 'u-craig',
        displayName: 'Craig',
        isSelf: false,
        jokerPlayed: false,
        points: null,
        predictions: { 'fx-1': { home: 1, away: 2 } },
      },
    ],
    seasonPointsBefore: { 'u-me': 40, 'u-craig': 43 },
  },
}

describe('SeasonMatchWhatIf', () => {
  it('renders nothing at all for a settled fixture', () => {
    const { container } = render(
      <SeasonMatchWhatIf input={{ ...input, result: { home: 2, away: 1 } }} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing at all when no provider score has been reported', () => {
    const { container } = render(<SeasonMatchWhatIf input={{ ...input, live: null }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('names all three branches and labels every figure as projected', () => {
    render(<SeasonMatchWhatIf input={input} />)

    expect(screen.getByRole('heading', { name: 'Projection' })).toBeInTheDocument()
    expect(screen.getByText('As it stands')).toBeInTheDocument()
    expect(screen.getByText('If Liverpool score')).toBeInTheDocument()
    expect(screen.getByText('If Arsenal score')).toBeInTheDocument()
    expect(screen.getAllByText(/projected pts?$/).length).toBeGreaterThanOrEqual(3)
    expect(
      screen.getByText(/Projected, never awarded/),
    ).toBeInTheDocument()
  })

  it('marks an exact branch with a word and not only a colour', () => {
    render(<SeasonMatchWhatIf input={input} />)
    expect(screen.getByText('Exact')).toBeInTheDocument()
    expect(
      screen.getByText('Your prediction would be exact — 5 projected points.'),
    ).toBeInTheDocument()
  })

  it('projects a league position and states what it could not account for', () => {
    render(<SeasonMatchWhatIf input={input} />)
    expect(screen.getAllByText('The Office').length).toBe(3)
    expect(screen.getAllByText(/Projected 1st of 2/).length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getAllByText(/1 other fixture is not settled/).length,
    ).toBe(3)
  })

  it('says the player has no prediction rather than showing them a zero', () => {
    render(<SeasonMatchWhatIf input={{ ...input, prediction: null, league: null }} />)
    expect(screen.getByText(/You have no prediction on this fixture\./)).toBeInTheDocument()
  })
})
