import { render, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { VNextHome } from '../../src/vnext/home/VNextHome'
import { homeScenarios, shellScenarios } from '../../src/vnext/fixtures'
import type { HomeModel, MatchweekRecap } from '../../src/vnext/models/home'

/**
 * THE MATCHWEEK RECAP, RESTORED — and kept apart from the zone above it.
 *
 * The Hub told a player what their last settled matchweek was worth. The
 * Competition Deck did not. Bringing it back raises one design risk worth
 * holding in a test: it sits near "Since you were last here", and the two must
 * not become the same thing. One says which matches FINISHED and carries no
 * points; the other says what those results were WORTH and carries nothing
 * about individual matches.
 *
 * The rest of these hold the rule every nullable figure on this surface obeys:
 * a figure the application cannot state is OMITTED, never printed as zero and
 * never printed as a word standing in for a number.
 */

function renderHome(model: HomeModel) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextHome model={model} />
      </VNextShellProvider>
    </VNextRoot>,
  )
}

function zone(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-vnext-zone="recap"]')
}

const RECAP: MatchweekRecap = {
  matchweekLabel: 'Matchweek 4',
  matchweekOrdinal: 4,
  points: 14,
  jokerPlayed: false,
  seasonPoints: 133,
  seasonRank: 1102,
  fieldSize: 12490,
  exactScores: 10,
  correctOutcomes: 15,
  leagues: [],
}

describe('after a matchweek settles', () => {
  it('says what the matchweek was worth', () => {
    const { container } = renderHome(homeScenarios.returning)
    const recap = zone(container)

    expect(recap).not.toBeNull()
    expect(
      within(recap as HTMLElement).getByRole('heading', { name: /Matchweek 4/ }),
    ).toBeInTheDocument()
    expect(within(recap as HTMLElement).getByText('14')).toBeInTheDocument()
  })

  it('names a joker in words rather than by a mark alone', () => {
    const { container } = renderHome(homeScenarios.returning)

    expect(within(zone(container) as HTMLElement).getByText(/Joker played/)).toBeInTheDocument()
  })

  it('says which way a private league moved, in words', () => {
    const { container } = renderHome(homeScenarios.returning)
    const recap = zone(container) as HTMLElement

    expect(within(recap).getByText('The Work League')).toBeInTheDocument()
    // A climb is never carried by an arrow or a colour alone.
    expect(within(recap).getByText('Up 2')).toBeInTheDocument()
  })

  it('does not repeat the results the zone above already listed', () => {
    const { container } = renderHome(homeScenarios.returning)
    const recap = zone(container) as HTMLElement
    const since = container.querySelector('[data-vnext-zone="since"]') as HTMLElement

    // The pair is "what finished" then "what it was worth". Each is useless if
    // it is the other one again.
    expect(since).not.toBeNull()
    expect(within(since).queryByText(/pts|points/i)).toBeNull()
    expect(within(recap).queryByText(/Your call/)).toBeNull()
  })
})

describe('before anything has settled', () => {
  it('shows no recap at all', () => {
    const { container } = renderHome(homeScenarios.newSeason)

    expect(zone(container)).toBeNull()
  })

  it('takes up no space when there is nothing to say', () => {
    const { container } = renderHome(homeScenarios.newSeason)
    const band = container.querySelector('[data-vnext-zone="recap-band"]')

    // Present as a wrapper, empty of content. `:empty` collapses it; the
    // assertion here is that nothing was drawn inside it.
    expect(band?.childElementCount ?? 0).toBe(0)
  })
})

describe('a figure the application cannot state', () => {
  it('is omitted rather than printed as zero', () => {
    const { container } = renderHome({
      ...homeScenarios.returning,
      matchweekRecap: {
        ...RECAP,
        seasonPoints: null,
        seasonRank: null,
        fieldSize: null,
        exactScores: null,
        correctOutcomes: null,
      },
    })
    const recap = zone(container) as HTMLElement

    expect(within(recap).getByText('Matchweek points')).toBeInTheDocument()
    expect(within(recap).queryByText('Season total')).toBeNull()
    expect(within(recap).queryByText('Season rank')).toBeNull()
    expect(within(recap).queryByText('Exact scores')).toBeNull()
    // The specific failure this forbids: an unknown rank rendered as a rank.
    expect(within(recap).queryByText(/0th|unranked/i)).toBeNull()
  })

  it('still shows the exact-score count when the outcome count is missing', () => {
    const { container } = renderHome({
      ...homeScenarios.returning,
      matchweekRecap: { ...RECAP, correctOutcomes: null },
    })
    const recap = zone(container) as HTMLElement

    expect(within(recap).getByText('Exact scores')).toBeInTheDocument()
    expect(within(recap).queryByText(/right result/)).toBeNull()
  })
})
