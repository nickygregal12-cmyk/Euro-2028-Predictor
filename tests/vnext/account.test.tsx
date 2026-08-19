import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { VNextAccount } from '../../src/vnext/account/VNextAccount'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import {
  accountScenarioNames,
  accountScenarios,
} from '../../src/vnext/fixtures/account/scenarios'
import { shellScenarios } from '../../src/vnext/fixtures/shell/scenarios'
import type { AccountPageModel } from '../../src/vnext/models/account'

function renderAccount(
  model: AccountPageModel,
  props: {
    onRetry?: () => void
    refreshing?: boolean
    onIntent?: (intent: { kind: string }) => void
  } = {},
) {
  return render(
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <VNextAccount model={model} {...props} />
    </VNextShellProvider>,
  )
}

const zone = (name: string) =>
  document.querySelector(`[data-vnext-zone="${name}"]`) as HTMLElement | null

describe('every world is a page', () => {
  it.each(accountScenarioNames)('%s has one main and one h1', (name) => {
    renderAccount(accountScenarios[name])
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  /**
   * EVERY WORLD MUST BE A STATE `buildAccountModel` CAN PRODUCE.
   *
   * These are the pairing rules the mapper enforces, asserted over all the
   * worlds at once so a new one cannot be added in an impossible state.
   */
  it.each(accountScenarioNames)('%s pairs its panels lawfully', (name) => {
    const world = accountScenarios[name]

    if (world.follows.kind === 'follows') {
      // `empty` is the mapper's answer to no follows, so a `follows` panel is
      // never empty.
      expect(world.follows.competitions.length).toBeGreaterThan(0)
      for (const competition of world.follows.competitions) {
        // A NAMED FOLLOW CARRIES BOTH NAMES. The mapper has no path that
        // produces one without the other.
        if (competition.identity.kind === 'named') {
          expect(competition.identity.competitionName).toBeTruthy()
          expect(competition.identity.seasonName).toBeTruthy()
        }
        // AN UNNAMED FOLLOW CARRIES NO ROUTE, because a route comes from a read
        // that would also have supplied a name.
        if (competition.identity.kind === 'unnamed') {
          expect(Object.keys(competition.identity)).toEqual(['kind'])
        }
      }
    }

    if (world.history.kind === 'seasons') {
      expect(world.history.seasons.length).toBeGreaterThan(0)
      // THE SERVER'S PAGING IS CONSISTENT WITH ITSELF: it never sends more rows
      // than it counts, and `hasMore` and the total agree.
      expect(world.history.seasons.length).toBeLessThanOrEqual(world.history.total)
      if (world.history.hasMore) {
        expect(world.history.total).toBeGreaterThan(world.history.seasons.length)
      }
      for (const season of world.history.seasons) {
        // BOTH HALVES OF AN ADDRESS OR NEITHER.
        if (season.route !== null) {
          expect(season.route.competitionSlug).toBeTruthy()
          expect(season.route.seasonKey).toBeTruthy()
        }
      }
    }
  })
})

describe('a follow the page cannot name', () => {
  it('says so in a sentence rather than showing an id', () => {
    const { container } = renderAccount(accountScenarios.unnameableFollow)
    expect(screen.getByText('A competition you follow')).toBeInTheDocument()
    expect(container.textContent).toMatch(/cannot show its name/i)
    // The tournament id must not have reached the page.
    expect(container.textContent).not.toContain('t-gone')
  })

  it('offers no way to open a competition it cannot name', () => {
    const { container } = renderAccount(accountScenarios.unnameableFollow)
    const row = container.querySelector('[data-vnext-follow="unnamed"]') as HTMLElement
    expect(within(row).queryByRole('button')).toBeNull()
  })

  it('never renders a uuid on any world', () => {
    for (const name of accountScenarioNames) {
      const { container, unmount } = renderAccount(accountScenarios[name])
      // The fixture ids are `t-…`; none of them is a thing to show a player.
      expect(container.textContent, name).not.toMatch(/\bt-[a-z0-9]+\b/)
      unmount()
    }
  })
})

describe('the favourite club is a fact, never a club', () => {
  it('says a favourite is picked without naming one', () => {
    renderAccount(accountScenarios.favouriteSet)
    expect(zone('favourite')?.textContent).toMatch(/picked a favourite club/i)
  })

  it('says nothing at all where no favourite is set', () => {
    renderAccount(accountScenarios.ordinary)
    expect(zone('favourite')).toBeNull()
  })
})

describe('a season is openable only where the server supplied an address', () => {
  it('offers a button for a routable season', () => {
    const onIntent = vi.fn()
    renderAccount(accountScenarios.ordinary, { onIntent })
    const buttons = screen.getAllByRole('button', { name: /open/i })
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement)
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'open-season',
      competitionSlug: 'caledonian',
      seasonKey: '2027-28',
    })
  })

  it('offers no button for an archived season, and says archived', () => {
    const { container } = renderAccount(accountScenarios.archivedSeason)
    const row = container.querySelector('[data-vnext-season="t-arch"]') as HTMLElement
    expect(within(row).queryByRole('button')).toBeNull()
    expect(zone('archived')?.textContent).toMatch(/archived/i)
  })
})

describe('a result is the stored snapshot, printed as sent', () => {
  it('prints points, rank and field size where all three exist', () => {
    renderAccount(accountScenarios.finishedSeason)
    const result = zone('result')?.textContent ?? ''
    expect(result).toContain('412')
    expect(result).toContain('3')
    expect(result).toContain('28')
    expect(result).toContain('38 matchweeks')
  })

  it('prints no rank at all where the snapshot has none', () => {
    renderAccount(accountScenarios.resultWithoutRank)
    const result = zone('result')?.textContent ?? ''
    expect(result).toContain('88')
    expect(result).not.toMatch(/finished/i)
  })

  it('shows no result for a season still in progress', () => {
    renderAccount(accountScenarios.ordinary)
    expect(zone('result')).toBeNull()
  })
})

describe('the two panels are independent', () => {
  it('keeps the history when the follows read failed', () => {
    renderAccount(accountScenarios.followsUnavailable)
    expect(screen.getByText(/could not load what you follow/i)).toBeInTheDocument()
    expect(zone('history')).not.toBeNull()
    expect(screen.queryByText(/could not load your seasons/i)).toBeNull()
  })

  it('keeps the follows when the history read failed', () => {
    renderAccount(accountScenarios.historyUnavailable)
    expect(screen.getByText(/could not load your seasons/i)).toBeInTheDocument()
    expect(screen.queryByText(/could not load what you follow/i)).toBeNull()
  })

  it('distinguishes an empty account from a failed read, in words', () => {
    renderAccount(accountScenarios.newAccount)
    expect(screen.getByText(/not following any competitions yet/i)).toBeInTheDocument()
    expect(screen.getByText(/have not played a season yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/could not load/i)).toBeNull()
  })

  it('offers a retry on each failed panel, and only where one was given', () => {
    const onRetry = vi.fn()
    renderAccount(accountScenarios.bothUnavailable, { onRetry })
    const retries = screen.getAllByRole('button', { name: /try again/i })
    expect(retries).toHaveLength(2)
    fireEvent.click(retries[0] as HTMLElement)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('offers no retry when the host supplied none', () => {
    renderAccount(accountScenarios.bothUnavailable)
    expect(screen.queryAllByRole('button', { name: /try again/i })).toHaveLength(0)
  })
})

describe('order, grouping and paging are the server’s', () => {
  it('groups by whether a season finished, keeping each group’s order', () => {
    renderAccount(accountScenarios.mixedHistory)
    const ongoing = zone('ongoing')?.textContent ?? ''
    const finished = zone('finished')?.textContent ?? ''
    expect(ongoing.indexOf('Season A')).toBeLessThan(ongoing.indexOf('Season C'))
    expect(finished).toContain('Season B')
    expect(ongoing).not.toContain('Season B')
  })

  it('says how many seasons exist rather than truncating quietly', () => {
    renderAccount(accountScenarios.pagedHistory)
    expect(zone('has-more')?.textContent).toMatch(/1 of 9/)
  })

  it('says nothing about paging when there is no more', () => {
    renderAccount(accountScenarios.ordinary)
    expect(zone('has-more')).toBeNull()
  })
})

describe('the page never invents an identity', () => {
  it('renders without a display name rather than inventing one', () => {
    const { container } = renderAccount(accountScenarios.noDisplayName)
    expect(container.textContent).not.toMatch(/Ada Lovelace/)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})
