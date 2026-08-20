import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { VNextHome } from '../../src/vnext/home/VNextHome'
import { homeScenarios, shellScenarios } from '../../src/vnext/fixtures'
import type { HomeModel } from '../../src/vnext/models/home'

/**
 * "SINCE YOU WERE LAST HERE", RESTORED — AND THE THREE WAYS IT GOES WRONG.
 *
 * The capability existed in the Hub and did not survive the cutover to the
 * Competition Deck. Bringing it back is easy; bringing it back CORRECTLY means
 * three rules, and each one is the difference between a useful zone and one a
 * player learns to scroll past:
 *
 *   • a first visit shows NOTHING. There is no marker to measure from, and a
 *     summary of the whole season dressed as "what changed" is the worst
 *     possible first impression of the feature;
 *   • it never states more than it knows. A capped list says it is capped;
 *   • it is settled results only, because the server settled them — never a
 *     match worked out to be finished from a clock.
 *
 * The mapper's own half of this — what `buildHomeModel` does with a marker, a
 * missing marker and an unreadable one — is in `homeIntegration.test.ts` beside
 * the source builder it needs.
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
  return container.querySelector('[data-vnext-zone="since"]')
}

describe('the returning player', () => {
  it('is told what finished while they were away', () => {
    const { container } = renderHome(homeScenarios.returning)
    const since = zone(container)

    expect(since).not.toBeNull()
    expect(
      within(since as HTMLElement).getByRole('heading', {
        name: 'Since you were last here',
      }),
    ).toBeInTheDocument()
  })

  it('says how much of the weekend it is not showing', () => {
    const { container } = renderHome(homeScenarios.returning)

    // A cap nobody can see reads as "we covered everything".
    expect(within(zone(container) as HTMLElement).getByText(/and 2 more/)).toBeInTheDocument()
  })

  it('reads each result aloud as one sentence, with the reader’s own call', () => {
    const { container } = renderHome(homeScenarios.returning)
    const rows = within(zone(container) as HTMLElement).getAllByRole('article')

    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const label = row.getAttribute('aria-label') ?? ''
      expect(label, label).toMatch(/your call \d+–\d+|you did not predict this one/)
    }
  })
})

describe('the player who has not been away', () => {
  it('sees nothing at all on a first visit', () => {
    // `competition` is the same world with no marker behind it.
    const { container } = renderHome(homeScenarios.competition)

    expect(zone(container)).toBeNull()
    expect(screen.queryByText('Since you were last here')).toBeNull()
  })

  it('sees nothing when the marker exists but nothing has finished since', () => {
    const { container } = renderHome({
      ...homeScenarios.returning,
      sinceLastVisit: { results: [], more: 0 },
    })

    expect(zone(container)).toBeNull()
  })
})
